import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import logger from '../config/logger.js';

const tracer = trace.getTracer('llm-provider', '1.0.0');

/**
 * Wrap an LLM call with OpenTelemetry tracing
 * Following Honeycomb LLM Observability best practices
 *
 * @param {string} providerName - Name of the LLM provider (openai, anthropic, bedrock)
 * @param {string} modelName - Model identifier
 * @param {Function} fn - Async function that makes the LLM call
 * @param {Object} metadata - Additional metadata to attach
 * @returns {Promise<any>} - Result from the LLM call
 */
export async function traceLLMCall(providerName, modelName, fn, metadata = {}) {
  return tracer.startActiveSpan(
    `llm.${providerName}.call`,
    {
      attributes: {
        'llm.provider': providerName,
        'llm.model': modelName,
        'llm.request_type': 'completion',
        ...metadata
      }
    },
    async (span) => {
      const startTime = Date.now();

      try {
        // Execute the LLM call
        const result = await fn();

        const duration = Date.now() - startTime;

        // Extract token usage if available (varies by provider)
        const usage = extractTokenUsage(result, providerName);

        // Set standard LLM attributes
        span.setAttributes({
          'llm.duration_ms': duration,
          'llm.response.success': true
        });

        // Add token usage attributes if available
        if (usage) {
          span.setAttributes({
            'llm.usage.prompt_tokens': usage.promptTokens || 0,
            'llm.usage.completion_tokens': usage.completionTokens || 0,
            'llm.usage.total_tokens': usage.totalTokens || 0
          });
        }

        // Add response metadata
        if (result.content) {
          span.setAttributes({
            'llm.response.length': result.content.length
          });
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;

        span.setAttributes({
          'llm.duration_ms': duration,
          'llm.response.success': false,
          'llm.error.type': error.name || 'Error',
          'llm.error.message': error.message
        });

        // Check for rate limiting
        if (error.status === 429 || error.message?.includes('rate limit')) {
          span.setAttributes({
            'llm.error.rate_limited': true
          });
        }

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        span.recordException(error);
        span.end();

        throw error;
      }
    }
  );
}

/**
 * Extract token usage from LLM response
 * Different providers return usage data in different formats
 */
function extractTokenUsage(result, providerName) {
  try {
    // OpenAI format
    if (result.response?.usage) {
      return {
        promptTokens: result.response.usage.prompt_tokens,
        completionTokens: result.response.usage.completion_tokens,
        totalTokens: result.response.usage.total_tokens
      };
    }

    // LangChain format (common across providers)
    if (result.llmOutput?.tokenUsage) {
      return {
        promptTokens: result.llmOutput.tokenUsage.promptTokens,
        completionTokens: result.llmOutput.tokenUsage.completionTokens,
        totalTokens: result.llmOutput.tokenUsage.totalTokens
      };
    }

    // Anthropic format
    if (result.usage) {
      return {
        promptTokens: result.usage.input_tokens,
        completionTokens: result.usage.output_tokens,
        totalTokens: (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0)
      };
    }

    // Bedrock format
    if (result['amazon-bedrock-invocationMetrics']) {
      const metrics = result['amazon-bedrock-invocationMetrics'];
      return {
        promptTokens: metrics.inputTokenCount,
        completionTokens: metrics.outputTokenCount,
        totalTokens: (metrics.inputTokenCount || 0) + (metrics.outputTokenCount || 0)
      };
    }

    return null;
  } catch (error) {
    logger.debug('Could not extract token usage:', error);
    return null;
  }
}

/**
 * Add LLM prompt and response as span events
 * Useful for debugging but be mindful of data sensitivity
 *
 * @param {Object} span - OpenTelemetry span
 * @param {string} prompt - User prompt
 * @param {string} response - LLM response
 * @param {boolean} includeContent - Whether to include full content (default: false for production)
 */
export function addLLMEvents(span, prompt, response, includeContent = false) {
  try {
    if (includeContent) {
      span.addEvent('llm.prompt', {
        'llm.prompt.text': prompt,
        'llm.prompt.length': prompt.length
      });

      span.addEvent('llm.response', {
        'llm.response.text': response,
        'llm.response.length': response.length
      });
    } else {
      // In production, only log lengths for privacy
      span.addEvent('llm.prompt', {
        'llm.prompt.length': prompt.length
      });

      span.addEvent('llm.response', {
        'llm.response.length': response.length
      });
    }
  } catch (error) {
    logger.debug('Error adding LLM events:', error);
  }
}

/**
 * Create a span for embedding generation
 */
export async function traceEmbeddingGeneration(providerName, fn, metadata = {}) {
  return tracer.startActiveSpan(
    `llm.${providerName}.embedding`,
    {
      attributes: {
        'llm.provider': providerName,
        'llm.request_type': 'embedding',
        ...metadata
      }
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const result = await fn();
        const duration = Date.now() - startTime;

        span.setAttributes({
          'llm.duration_ms': duration,
          'llm.response.success': true
        });

        if (Array.isArray(result)) {
          span.setAttribute('llm.embedding.count', result.length);
        }

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;

        span.setAttributes({
          'llm.duration_ms': duration,
          'llm.response.success': false,
          'llm.error.message': error.message
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        span.recordException(error);
        span.end();

        throw error;
      }
    }
  );
}

export default {
  traceLLMCall,
  addLLMEvents,
  traceEmbeddingGeneration
};
