# OpenTelemetry AI Chatbot 🤖

An intelligent chatbot application designed to help developers with OpenTelemetry integration and instrumentation. Built with Node.js, React, and powered by AWS Bedrock (Claude 3.5 Sonnet) with RAG (Retrieval Augmented Generation) capabilities.

## ✨ Features

- **AWS Bedrock Integration**: Powered by Claude 3.5 Sonnet for intelligent responses
- **RAG-Powered Responses**: Uses vector search to provide contextually relevant answers from OpenTelemetry documentation
- **OpenTelemetry Expertise**: Pre-loaded with comprehensive OpenTelemetry documentation
- **Modern Web Interface**: Clean, responsive React-based chat interface
- **Source Attribution**: Shows which documents were used to generate responses with relevance scores
- **Dual Deployment**: ChromaDB for local development, OpenSearch for production on AWS
- **Automated Infrastructure**: Pulumi-managed AWS deployment with automated Docker builds
- **Secure Configuration**: Pulumi ESC for secrets and configuration management

## 🏗️ Architecture

### Local Development Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   React Client  │────│  Express API    │────│   AWS Bedrock    │
│   (Port 3000)   │    │   (Port 3001)   │    │ Claude 3.5 Sonnet│
│                 │    │                 │    └──────────────────┘
│  - Chat UI      │    │  - Chat Routes  │
│  - Message      │    │  - Admin Routes │
│    Display      │    │  - RAG Service  │
└─────────────────┘    └─────────────────┘
                                │
                       ┌────────────────────┐
                       │   ChromaDB         │
                       │   (Port 8000)      │
                       │                    │
                       │  - OTel Docs       │
                       │  - Vector Search   │
                       │  - k=4 retrieval   │
                       └────────────────────┘
```

### AWS Production Architecture
```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Internet   │────│   ALB (Port 80) │────│  ECS Fargate     │
│    Users     │    │                 │    │                  │
└──────────────┘    │  - Health Check │    │  - React + API   │
                    │  - /api/* →     │    │  - Single        │
                    │    Backend      │    │    Container     │
                    │  - /* →         │    │                  │
                    │    Frontend     │    └──────────────────┘
                    └─────────────────┘              │
                                                     │
                           ┌─────────────────────────┴───────────┐
                           │                                     │
                    ┌──────▼──────┐                    ┌────────▼────────┐
                    │  AWS Bedrock│                    │   OpenSearch    │
                    │  Claude 3.5 │                    │   (k-NN Index)  │
                    │   Sonnet    │                    │                 │
                    │  - IAM Role │                    │  - VPC Private  │
                    │    Auth     │                    │  - 1536 dims    │
                    └─────────────┘                    │  - HNSW algo    │
                                                       └─────────────────┘
                           │
                    ┌──────▼──────────┐
                    │  Pulumi ESC     │
                    │                 │
                    │  - Secrets      │
                    │  - Config       │
                    │  - AWS Creds    │
                    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Python 3.8+ (for ChromaDB)
- AWS credentials with Bedrock access
- Pulumi CLI installed (for deployment)
- Pulumi ESC environment configured with AWS credentials

### Local Development Setup

#### Option 1: Quick Start Script (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd ai-workshop

# Run quick start script (handles everything)
scripts/quick-start.sh
```

The quick start script automatically:
- Checks and installs all required dependencies
- Sets up ChromaDB
- Ingests OpenTelemetry documentation
- Starts the application (client, server, and ChromaDB)

**Note**: First-time ChromaDB startup may timeout. Simply re-run the script if this occurs.

#### Option 2: Manual Setup

1. **Install dependencies**
   ```bash
   npm run install-all
   # Or manually:
   npm install && cd client && npm install && cd ..
   ```

2. **Configure AWS credentials using Pulumi ESC**

   This project uses Pulumi ESC for all secrets and configuration. To connect to AWS:
   ```bash
   # Run any AWS CLI command through Pulumi ESC
   pulumi env run <esc-environment> -i -- <command>

   # Example: Check AWS identity
   pulumi env run honeycomb-pulumi-workshop/ws -i -- aws sts get-caller-identity
   ```

   The ESC environment is specified in `Pulumi.<stack>.yaml` file.

3. **Set up ChromaDB**
   ```bash
   pip install chromadb
   npm run start:chroma
   # ChromaDB runs on localhost:8000
   ```

4. **Ingest OpenTelemetry documentation**
   ```bash
   npm run setup-data
   ```

5. **Start the application**
   ```bash
   # Start everything (recommended)
   npm run start:all

   # Or start components individually
   npm run dev              # Server only (port 3001)
   npm run start:client     # Client only (port 3000)
   npm run start:chroma     # ChromaDB only (port 8000)
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - API: http://localhost:3001/api
   - Health check: http://localhost:3001/api/health

7. **Stop the application**
   ```bash
   npm run stop:all
   ```
## 📖 Usage

### Chat Interface

1. Open the web application in your browser
2. Ask questions about OpenTelemetry integration:
   - "How do I set up auto-instrumentation for Express?"
   - "What's the difference between manual and automatic instrumentation?"
   - "How can I create custom spans?"
   - "How can I instrument a React web application?"
   - "What are the best practices for OpenTelemetry context propagation?"

The chatbot uses RAG to retrieve relevant documentation and provides responses with source attribution and relevance scores.

### API Endpoints

#### Chat API
- `POST /api/chat` - Send a chat message (uses AWS Bedrock)
  ```bash
  curl -X POST http://localhost:3001/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "How do I instrument Express.js?"}'
  ```

- `GET /api/chat/context` - Retrieve context without generating response
- `GET /api/chat/providers` - List available providers (returns `['bedrock']`)
- `POST /api/chat/test-provider` - Test Bedrock provider connection

#### Admin API
- `POST /api/admin/ingest` - Add documents to knowledge base
  ```bash
  curl -X POST http://localhost:3001/api/admin/ingest \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Custom OTel Guide",
      "content": "Your documentation...",
      "source": "internal-docs"
    }'
  ```

- `GET /api/admin/vector-store/info` - Get vector store statistics
- `POST /api/admin/search` - Search documents directly
- `DELETE /api/admin/vector-store` - Reset knowledge base (use with caution)

## 🔧 Configuration

### Pulumi ESC for Secrets Management

This project uses **Pulumi ESC (Environments, Secrets, and Configuration)** for managing all secrets and configuration:

- **No `.env` files**: All secrets are managed through Pulumi ESC
- **Secure AWS access**: AWS credentials are injected via ESC environment
- **Environment-specific configs**: Different configurations for dev/staging/prod

To run commands with Pulumi ESC:
```bash
# General pattern
pulumi env run <esc-environment> -i -- <command>

# Example: List ECS services
pulumi env run honeycomb-pulumi-workshop/ws -i -- aws ecs list-services --cluster my-cluster

# Example: Run local development with ESC credentials
pulumi env run honeycomb-pulumi-workshop/ws -i -- npm run dev
```

The ESC environment name is specified in your `Pulumi.<stack>.yaml` file.

### Environment Variables (Managed by Pulumi ESC)

#### AWS Bedrock Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region for Bedrock | us-east-1 |
| `BEDROCK_MODEL` | Bedrock model ID | anthropic.claude-3-5-sonnet-20240620-v1:0 |
| `AWS_ACCESS_KEY_ID` | AWS access key (local dev) | From Pulumi ESC |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (local dev) | From Pulumi ESC |
| `AWS_SESSION_TOKEN` | AWS session token (optional) | From Pulumi ESC |

#### Application Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `TEMPERATURE` | LLM temperature | 0.7 |
| `MAX_TOKENS` | Max response tokens | 2000 |

#### Vector Store Configuration (Local)
| Variable | Description | Default |
|----------|-------------|---------|
| `CHROMA_URL` | ChromaDB URL | http://localhost:8000 |
| `CHROMA_COLLECTION_NAME` | Collection name | otel_knowledge |

#### Vector Store Configuration (AWS Production)
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENSEARCH_ENDPOINT` | OpenSearch HTTPS endpoint | From Pulumi output |
| `OPENSEARCH_USERNAME` | OpenSearch user | admin |
| `OPENSEARCH_PASSWORD` | OpenSearch password | From Secrets Manager |
| `OPENSEARCH_INDEX` | Index name | otel_knowledge |

### Adding Custom Documentation

Add your own documentation to the knowledge base via the admin API:

```bash
curl -X POST http://localhost:3001/api/admin/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Custom OTel Guide",
    "content": "Your documentation content here...",
    "source": "internal-docs",
    "metadata": {
      "type": "guide",
      "version": "1.0"
    }
  }'
```

## 🧪 Development

### Project Structure

```
ai-workshop/
├── server/                      # Backend Express.js application
│   ├── config/                 # Configuration and logging
│   │   ├── index.js           # Centralized config with validation
│   │   └── logger.js          # Winston logger
│   ├── middleware/            # Express middleware
│   │   ├── auth.js           # Rate limiting, API key validation
│   │   └── validation.js     # Request validation
│   ├── routes/               # API route handlers
│   │   ├── chat.js          # Chat endpoints (Bedrock)
│   │   └── admin.js         # Admin/knowledge base management
│   ├── services/            # Business logic services
│   │   ├── llmProvider.js  # AWS Bedrock integration
│   │   ├── vectorStore.js  # ChromaDB integration (local)
│   │   ├── vectorStoreOpenSearch.js  # OpenSearch integration (AWS)
│   │   └── ragService.js   # RAG pipeline orchestration
│   └── index.js            # Server entry point
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/    # React components (Chat UI)
│   │   ├── services/      # API service layer (Axios)
│   │   └── App.js         # Main app component
│   └── public/            # Static assets
├── pulumi/                # Infrastructure as Code
│   ├── index.ts          # Main Pulumi program (~470 lines)
│   ├── package.json      # Pulumi dependencies
│   ├── AUTOMATED_BUILD.md # Docker build automation guide
│   └── README.md         # Deployment guide
├── scripts/              # Utility scripts
│   ├── quick-start.sh   # One-command setup
│   └── ingest-data.js   # Data ingestion for OTel docs
├── data/                # ChromaDB persistence directory
├── docs/                # Documentation
│   ├── AWS_DEPLOYMENT.md
│   └── OPENSEARCH_MIGRATION.md
├── Dockerfile           # Production container build
└── CLAUDE.md           # Claude Code project instructions
```

### Key Design Patterns

#### Service Initialization Order
The server follows a strict initialization sequence (server/index.js:36-59):
1. Configuration validation
2. Service initialization (LLM provider → Vector store)
3. Middleware setup
4. Route registration
5. Error handling

#### RAG Pipeline (LangChain RunnableSequence)
The RAG service uses a three-stage pipeline:
1. **Vector Search**: Query ChromaDB/OpenSearch for relevant documents
2. **Context Formatting**: Format results with source and relevance score
3. **LLM Generation**: Send prompt + context to Bedrock → parse response

#### AWS Bedrock Integration
- Fixed to use Claude 3.5 Sonnet exclusively (anthropic.claude-3-5-sonnet-20240620-v1:0)
- Local development: AWS credentials from Pulumi ESC
- ECS/Production: IAM role credentials (automatic)

### Running Tests

```bash
npm test
```

### Building for Production

```bash
# Build the React client
npm run build

# Start in production mode
NODE_ENV=production npm start
```

## ☁️ AWS Deployment with Pulumi

The `pulumi/` directory contains complete infrastructure-as-code for deploying to AWS.

### Automated Deployment Features

- **Automated Docker Builds**: Pulumi builds and pushes Docker images automatically to ECR
- **Single Container Architecture**: Both React frontend and Express API in one container
- **OpenSearch Vector Store**: Replaces ChromaDB with Amazon OpenSearch Service (k-NN enabled)
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: Serves both frontend (on `/`) and backend API (on `/api/*`)
- **Pulumi ESC Integration**: All secrets and AWS credentials managed through ESC
- **IAM Role Authentication**: No hardcoded credentials in production

### Quick Deployment

```bash
cd pulumi

# Install Pulumi dependencies
npm install

# Initialize stack (if needed)
pulumi stack init dev

# Configure AWS region
pulumi config set aws:region us-east-1

# Set OpenSearch master password (stored securely)
pulumi config set --secret opensearchMasterPassword <strong-password>

# Deploy everything (builds Docker image automatically)
pulumi up

# Get the application URL
pulumi stack output albUrl
```

**First deployment takes ~15-20 minutes** due to Docker build and OpenSearch domain creation.

### Infrastructure Components

| Component | Description | Configuration |
|-----------|-------------|---------------|
| **ECR Repository** | Private container registry | Vulnerability scanning enabled |
| **Docker Image** | Automated build & push | Multi-stage build (Node.js 18) |
| **VPC** | Network isolation | 2 AZs, public/private subnets |
| **OpenSearch** | Vector database with k-NN | t3.small.search, 10GB storage |
| **ECS Fargate** | Container orchestration | 0.5 vCPU, 1GB memory |
| **ALB** | Load balancer | HTTP (port 80), health checks |
| **Secrets Manager** | API keys storage | OpenSearch password |
| **CloudWatch Logs** | Application logs | 7-day retention |

### Using Pulumi ESC in Deployment

```bash
# Deploy with Pulumi ESC credentials
pulumi env run honeycomb-pulumi-workshop/ws -i -- pulumi up

# Check ECS service status
pulumi env run honeycomb-pulumi-workshop/ws -i -- aws ecs list-services \
  --cluster $(pulumi stack output ecsClusterName) \
  --region us-east-1

# View ECS task logs
pulumi env run honeycomb-pulumi-workshop/ws -i -- aws logs tail \
  /aws/ecs/otel-ai-chatbot-logs \
  --follow

# Update ECS service (force new deployment)
pulumi env run honeycomb-pulumi-workshop/ws -i -- aws ecs update-service \
  --cluster $(pulumi stack output ecsClusterName) \
  --service $(pulumi stack output ecsServiceName) \
  --force-new-deployment
```

### OpenSearch Data Ingestion

After deployment, ingest OpenTelemetry documentation to OpenSearch:

```bash
# Set environment variables
export USE_OPENSEARCH=true
export OPENSEARCH_ENDPOINT=$(cd pulumi && pulumi stack output opensearchEndpoint)
export OPENSEARCH_USERNAME=admin
export OPENSEARCH_PASSWORD=<your-opensearch-password>

# Run ingestion script with Pulumi ESC
pulumi env run honeycomb-pulumi-workshop/ws -i -- node scripts/ingest-data.js
```

### Monitoring and Debugging

- **Application URL**: `pulumi stack output albUrl`
- **ECS Service**: `pulumi stack output ecsServiceName`
- **CloudWatch Logs**: `/aws/ecs/otel-ai-chatbot-logs`
- **Health Check**: `http://<alb-url>/api/health`
- **OpenSearch Dashboards**: Accessible via VPN/bastion (private subnet)

### Cost Estimation

| Service | Configuration | Estimated Monthly Cost |
|---------|--------------|----------------------|
| ECS Fargate | 0.5 vCPU, 1GB, 24/7 | ~$15 |
| OpenSearch | t3.small.search, 10GB | ~$40 |
| ALB | Basic usage | ~$18 |
| NAT Gateway | Single gateway | ~$32 |
| ECR | ~10 images | ~$0.30 |
| CloudWatch Logs | 7-day retention | ~$5 |
| **Total** | | **~$110/month** |

### Useful Pulumi Commands

```bash
# View all outputs
pulumi stack output

# Preview changes
pulumi up --diff

# Destroy infrastructure
pulumi destroy

# View logs
pulumi logs --follow

# Export stack state
pulumi stack export > backup.json
```

For detailed deployment instructions, see:
- `pulumi/README.md` - Comprehensive deployment guide
- `pulumi/AUTOMATED_BUILD.md` - Docker build automation details
- `docs/AWS_DEPLOYMENT.md` - Step-by-step deployment walkthrough
- `docs/OPENSEARCH_MIGRATION.md` - ChromaDB to OpenSearch migration guide

## 🛠️ Troubleshooting

### Common Issues

#### Local Development

1. **AWS Bedrock authentication errors**
   - Ensure you're using Pulumi ESC to inject credentials:
     ```bash
     pulumi env run <esc-environment> -i -- npm run dev
     ```
   - Verify your AWS credentials have Bedrock access
   - Check that `AWS_REGION` is set correctly (default: us-east-1)
   - Test with: `pulumi env run <esc-environment> -i -- aws bedrock list-foundation-models`

2. **ChromaDB connection issues**
   - Ensure ChromaDB is running: `curl http://localhost:8000/api/v1/heartbeat`
   - Start ChromaDB: `npm run start:chroma` or `chroma run --host localhost --port 8000`
   - Check collection exists: View server logs for "Vector store initialized"
   - Reset if needed: `DELETE http://localhost:3001/api/admin/vector-store`
   - First-time ChromaDB timeout: Re-run `scripts/quick-start.sh`

3. **Frontend can't reach API**
   - Verify proxy configuration in `client/package.json` (should proxy to `http://localhost:3001`)
   - Check backend is running on port 3001
   - Look for CORS issues in browser console
   - Verify `CODESPACE_NAME` env var if using GitHub Codespaces

4. **Missing dependencies**
   - Run `npm run install-all` to install both server and client dependencies
   - Check Node.js version (requires 18+)
   - Check Python version for ChromaDB (requires 3.8+)

#### AWS Production Deployment

1. **Pulumi deployment fails**
   - Check Pulumi ESC environment is accessible:
     ```bash
     pulumi env run <esc-environment> -i -- aws sts get-caller-identity
     ```
   - Verify OpenSearch password is set: `pulumi config get opensearchMasterPassword`
   - Check Docker is running (required for automated builds)
   - Review Pulumi logs: `pulumi up --logtostderr -v=9`

2. **OpenSearch connection errors**
   - Verify OpenSearch domain is healthy in AWS Console
   - Check security group allows ECS tasks to access OpenSearch (port 443)
   - Verify credentials in Secrets Manager
   - OpenSearch domain creation takes 10-15 minutes on first deployment

3. **ECS tasks failing health checks**
   - Check CloudWatch Logs: `/aws/ecs/otel-ai-chatbot-logs`
   - Verify health endpoint responds: `curl http://<alb-url>/api/health`
   - Check environment variables in ECS task definition
   - Verify IAM role has Bedrock and OpenSearch permissions

4. **Docker build failures**
   - Ensure Dockerfile is at repository root
   - Check Docker daemon is running
   - Verify ECR repository exists and is accessible
   - Review build logs in Pulumi output
   - See `pulumi/AUTOMATED_BUILD.md` for troubleshooting

5. **Application returns 503/504 errors**
   - Check ECS service has running tasks: `aws ecs describe-services`
   - Verify target group health in ALB console
   - Check CloudWatch logs for application errors
   - Verify Bedrock model access in your AWS region

### Debug Mode

Enable debug logging:
```bash
# Local development
NODE_ENV=development npm run dev

# With Pulumi ESC credentials
pulumi env run <esc-environment> -i -- NODE_ENV=development npm run dev

# Check specific components
curl http://localhost:3001/api/health              # Health check
curl http://localhost:3001/api/chat/providers      # Available providers
curl http://localhost:8000/api/v1/heartbeat        # ChromaDB status
```

### Useful Diagnostic Commands

```bash
# Check Pulumi ESC environment
pulumi env run <esc-environment> -i -- env | grep AWS

# View ECS task logs
pulumi env run <esc-environment> -i -- aws logs tail \
  /aws/ecs/otel-ai-chatbot-logs --follow

# Check OpenSearch cluster health
curl -u admin:<password> https://<opensearch-endpoint>/_cluster/health

# List vector store collections
curl http://localhost:8000/api/v1/collections      # ChromaDB
curl http://localhost:3001/api/admin/vector-store/info  # Via API

# Test Bedrock access
pulumi env run <esc-environment> -i -- aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-5-sonnet-20240620-v1:0 \
  --body '{"anthropic_version":"bedrock-2023-05-31","messages":[{"role":"user","content":"Hello"}],"max_tokens":100}' \
  output.json
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the existing code style
4. Add tests if applicable
5. Ensure all tests pass (`npm test`)
6. Update documentation as needed
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Development Guidelines

- Use ES6 modules (`import`/`export`)
- Follow the existing service initialization order
- Use Winston logger for all logging
- Add JSDoc comments for new functions
- Update CLAUDE.md for architectural changes
- Test locally before deploying to AWS

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **OpenTelemetry Community** for comprehensive documentation and best practices
- **AWS Bedrock** for providing Claude 3.5 Sonnet API access
- **LangChain** for the excellent RAG framework and LLM orchestration
- **Pulumi** for infrastructure-as-code and secrets management (ESC)
- **ChromaDB** and **OpenSearch** for vector database capabilities

## 📚 Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [LangChain Documentation](https://js.langchain.com/docs/)
- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [Pulumi ESC Documentation](https://www.pulumi.com/docs/pulumi-cloud/esc/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Amazon OpenSearch Documentation](https://docs.aws.amazon.com/opensearch-service/)

## 🆘 Support

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: Check the `docs/` directory for detailed guides
- **Examples**: See example queries and use cases in the chat interface

---

**Ready to get started?** Run `scripts/quick-start.sh` and ask the chatbot about OpenTelemetry! 🚀
