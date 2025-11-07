# Migrating from ChromaDB to Amazon OpenSearch

This guide explains how to migrate the OpenTelemetry AI Chatbot from ChromaDB to Amazon OpenSearch Service for vector storage.

## Why OpenSearch?

Amazon OpenSearch Service offers several advantages over self-hosted ChromaDB:

- **Fully Managed**: No need to maintain ChromaDB containers or infrastructure
- **Scalability**: Easy to scale up/down based on demand
- **High Availability**: Built-in replication and automatic failover
- **Security**: VPC isolation, encryption at rest/in transit, IAM integration
- **Enterprise Features**: Monitoring, alerting, and backup/restore
- **k-NN Plugin**: Native k-nearest neighbor vector search support

## Prerequisites

1. AWS Account with OpenSearch Service access
2. OpenSearch domain deployed (via Pulumi or manually)
3. Network connectivity from your application to OpenSearch

## Migration Steps

### 1. Install OpenSearch Client

```bash
npm install @opensearch-project/opensearch
```

### 2. Update Environment Variables

Add OpenSearch configuration to your `.env` file:

```env
# OpenSearch Configuration
OPENSEARCH_ENDPOINT=https://your-opensearch-domain.region.es.amazonaws.com
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=your-secure-password
OPENSEARCH_INDEX=otel_knowledge

# Keep existing ChromaDB settings for fallback
CHROMA_DB_PATH=./data/chroma_db
CHROMA_COLLECTION_NAME=otel_knowledge
```

### 3. Switch Vector Store Implementation

The new OpenSearch vector store is available at `server/services/vectorStoreOpenSearch.js`.

**Option A: Replace the existing vector store**

```bash
# Backup the original
mv server/services/vectorStore.js server/services/vectorStoreChroma.js

# Use OpenSearch version
mv server/services/vectorStoreOpenSearch.js server/services/vectorStore.js
```

**Option B: Use environment variable to switch**

Modify `server/index.js` to conditionally load the vector store:

```javascript
// Import based on configuration
const useOpenSearch = process.env.USE_OPENSEARCH === 'true';
const vectorStore = useOpenSearch
  ? await import('./services/vectorStoreOpenSearch.js')
  : await import('./services/vectorStore.js');

export default vectorStore.default;
```

Then set in `.env`:
```env
USE_OPENSEARCH=true
```

### 4. Update Configuration

Modify `server/config/index.js` to include OpenSearch settings:

```javascript
export const config = {
  // ... existing config

  // Vector Database Configuration
  vectorDb: {
    type: process.env.VECTOR_DB_TYPE || 'chromadb', // 'chromadb' or 'opensearch'
    chromaDbPath: process.env.CHROMA_DB_PATH || './data/chroma_db',
    collectionName: process.env.CHROMA_COLLECTION_NAME || 'otel_knowledge',
    opensearch: {
      endpoint: process.env.OPENSEARCH_ENDPOINT,
      username: process.env.OPENSEARCH_USERNAME || 'admin',
      password: process.env.OPENSEARCH_PASSWORD,
      index: process.env.OPENSEARCH_INDEX || 'otel_knowledge',
    },
  },
};
```

### 5. Migrate Data from ChromaDB to OpenSearch

Create a migration script `scripts/migrate-to-opensearch.js`:

```javascript
import chromadb from '../server/services/vectorStoreChroma.js';
import opensearch from '../server/services/vectorStoreOpenSearch.js';
import logger from '../server/config/logger.js';

async function migrateData() {
  try {
    logger.info('Starting migration from ChromaDB to OpenSearch...');

    // Initialize both stores
    await chromadb.initialize();
    await opensearch.initialize();

    // Get all documents from ChromaDB
    // Note: ChromaDB doesn't have a "get all" method, so you'll need to
    // query with a broad search or iterate through known document IDs

    logger.info('Migration completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
```

**Alternative: Re-ingest Data**

Since ingesting data is a one-time operation, it's often easier to re-run the ingestion script:

```bash
# Make sure OPENSEARCH_* env vars are set
node scripts/ingest-data.js
```

### 6. Update Docker Configuration

If using Docker, update the Dockerfile to include OpenSearch connectivity:

```dockerfile
# Dockerfile already created - no changes needed
```

Update `docker-compose.yml` if you're running OpenSearch locally:

```yaml
version: '3.8'
services:
  opensearch:
    image: opensearchproject/opensearch:2.11.0
    environment:
      - discovery.type=single-node
      - OPENSEARCH_INITIAL_ADMIN_PASSWORD=YourStrongPassword123!
      - plugins.security.disabled=false
    ports:
      - "9200:9200"
      - "9600:9600"
    volumes:
      - opensearch-data:/usr/share/opensearch/data

  backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      - OPENSEARCH_ENDPOINT=http://opensearch:9200
      - OPENSEARCH_USERNAME=admin
      - OPENSEARCH_PASSWORD=YourStrongPassword123!
    depends_on:
      - opensearch

volumes:
  opensearch-data:
```

### 7. Deploy with Pulumi

If using the Pulumi infrastructure:

```bash
cd pulumi

# Install dependencies
npm install

# Configure stack
pulumi stack init prod
pulumi config set --secret opensearchMasterPassword <strong-password>

# Deploy infrastructure
pulumi up

# Note the OpenSearch endpoint from outputs
pulumi stack output openSearchEndpoint
```

### 8. Testing

Test the OpenSearch integration:

```bash
# Test connection
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I set up OpenTelemetry?"}'

# Check vector store info
curl http://localhost:3001/api/admin/vector-store/info
```

## Key Differences

### API Differences

| Feature | ChromaDB | OpenSearch |
|---------|----------|------------|
| Client Library | `chromadb` | `@opensearch-project/opensearch` |
| Connection | HTTP URL + port | HTTPS endpoint + auth |
| Collection/Index | Collection | Index |
| Vector Search | Built-in | k-NN plugin |
| Embedding Storage | Automatic | Manual (field in document) |

### Code Changes

**ChromaDB:**
```javascript
const vectorStore = await Chroma.fromDocuments(
  documents,
  embeddings,
  { collectionName: 'otel_knowledge' }
);
```

**OpenSearch:**
```javascript
// Create index with k-NN mapping
await client.indices.create({
  index: 'otel_knowledge',
  body: {
    mappings: {
      properties: {
        embedding: {
          type: 'knn_vector',
          dimension: 1536,
        },
      },
    },
  },
});

// Add documents with embeddings
await client.bulk({ body: bulkBody });
```

### Search Differences

**ChromaDB:**
```javascript
const results = await vectorStore.similaritySearch(query, k);
```

**OpenSearch:**
```javascript
const results = await client.search({
  index: 'otel_knowledge',
  body: {
    query: {
      knn: {
        embedding: {
          vector: queryEmbedding,
          k: k,
        },
      },
    },
  },
});
```

## Performance Considerations

### OpenSearch Tuning

For better performance, adjust these settings:

```javascript
// In vectorStoreOpenSearch.js
method: {
  name: 'hnsw',  // Hierarchical Navigable Small World
  space_type: 'l2',  // Euclidean distance
  engine: 'nmslib',  // Fast library
  parameters: {
    ef_construction: 128,  // Higher = better recall, slower indexing
    m: 24,  // Higher = better recall, more memory
  },
}
```

### Index Settings

```javascript
settings: {
  index: {
    knn: true,
    "knn.algo_param.ef_search": 100,  // Search-time recall/latency tradeoff
  },
}
```

## Rollback Plan

If issues occur, rollback is simple:

```bash
# Option 1: Switch back to ChromaDB via environment variable
export USE_OPENSEARCH=false
# or in .env: USE_OPENSEARCH=false

# Option 2: Restore original vector store
mv server/services/vectorStoreChroma.js server/services/vectorStore.js

# Restart application
npm start
```

## Monitoring

Monitor OpenSearch performance:

1. **OpenSearch Dashboards**: Access at `https://<domain>/_dashboards`
2. **CloudWatch Metrics**: Monitor cluster health, search latency, indexing rate
3. **Application Logs**: Check `server/config/logger.js` for OpenSearch operations

### Key Metrics to Watch

- **Search Latency**: Should be < 100ms for most queries
- **Indexing Rate**: Documents per second
- **Cluster Health**: Should be "green"
- **JVM Memory**: Should be < 75% usage

## Troubleshooting

### Connection Errors

```
Error: connect ECONNREFUSED
```

**Solution**: Verify OpenSearch endpoint and security group rules allow traffic.

### Authentication Errors

```
Error: [security_exception] Authentication failed
```

**Solution**: Check OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD are correct.

### k-NN Search Not Working

```
Error: field [embedding] is not a knn_vector field
```

**Solution**: Recreate index with proper k-NN mapping (see `createIndexIfNotExists()`).

### Slow Search Performance

**Solutions**:
- Increase `ef_search` parameter
- Scale up OpenSearch instance type
- Enable caching
- Reduce `k` (number of results)

## Cost Comparison

### ChromaDB (Self-Hosted)
- EC2 instance: ~$10-30/month
- Storage: ~$1/GB/month
- Management overhead: High

### OpenSearch Service
- t3.small.search: ~$40/month
- Storage: ~$0.10/GB/month
- Management overhead: Low

**Total Cost of Ownership**: OpenSearch is often cheaper when factoring in management time.

## Additional Resources

- [OpenSearch k-NN Documentation](https://opensearch.org/docs/latest/search-plugins/knn/index/)
- [AWS OpenSearch Service Guide](https://docs.aws.amazon.com/opensearch-service/)
- [OpenSearch JavaScript Client](https://github.com/opensearch-project/opensearch-js)
- [LangChain OpenSearch Integration](https://js.langchain.com/docs/integrations/vectorstores/opensearch)

## Next Steps

After successful migration:

1. **Remove ChromaDB dependencies** from `package.json`
2. **Delete ChromaDB data** (`./data/chroma_db`)
3. **Update documentation** to reference OpenSearch
4. **Set up monitoring** for OpenSearch cluster
5. **Configure backups** using OpenSearch snapshots
6. **Optimize index settings** based on query patterns
