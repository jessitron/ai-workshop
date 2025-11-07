# Deployment Summary

This document summarizes the Pulumi infrastructure setup for deploying the OpenTelemetry AI Chatbot to AWS.

## What Was Created

### 1. Pulumi Project Structure

```
pulumi/
├── index.ts              # Main infrastructure definition (440+ lines)
├── package.json          # Pulumi dependencies
├── tsconfig.json         # TypeScript configuration
├── Pulumi.yaml           # Stack configuration
├── README.md             # Comprehensive deployment guide
└── DEPLOYMENT_SUMMARY.md # This file
```

### 2. AWS Infrastructure (via index.ts)

The Pulumi program creates a complete production-ready infrastructure:

#### Networking
- **VPC** with 10.0.0.0/16 CIDR
- **2 Public Subnets** (for ALB) across 2 availability zones
- **2 Private Subnets** (for ECS and OpenSearch)
- **1 NAT Gateway** for private subnet internet access
- **Internet Gateway** for public subnet access
- **Security Groups** for ALB, ECS, and OpenSearch with least-privilege access

#### Compute
- **ECS Cluster** with Container Insights enabled
- **ECS Task Definition**:
  - Fargate launch type (serverless containers)
  - 0.5 vCPU, 1GB memory
  - Container: Express.js backend (Node 18)
  - Health check: `/api/health`
  - Environment variables pre-configured for OpenSearch
  - Secrets from AWS Secrets Manager
- **ECS Service**:
  - Desired count: 1
  - Auto-configured load balancer integration
  - Private subnet deployment

#### Load Balancing
- **Application Load Balancer**:
  - Internet-facing
  - HTTP listener on port 80
  - Health check: `/api/health` every 30 seconds
- **Target Group**:
  - Target type: IP (for Fargate)
  - Health check configuration optimized for startup time

#### Database
- **Amazon OpenSearch Domain**:
  - Version: OpenSearch 2.11
  - Instance: t3.small.search (cost-optimized)
  - Storage: 10 GB EBS (gp3)
  - k-NN enabled for vector search
  - VPC deployment (private subnet)
  - Fine-grained access control enabled
  - Encryption at rest and in transit
  - Master user credentials stored in Secrets Manager

#### Frontend Hosting
- **S3 Bucket** for static React build
- **CloudFront Distribution**:
  - Origin: S3 bucket
  - HTTPS redirect enabled
  - Custom error response for SPA routing (404 → index.html)
  - Origin Access Control for secure S3 access
- **Bucket Policy** allowing CloudFront access only

#### Security
- **Secrets Manager Secret**: Stores API keys (OpenAI, Anthropic, AWS)
- **IAM Roles**:
  - ECS Task Execution Role: Pull images, read secrets
  - ECS Task Role: Access OpenSearch, call LLM APIs
- **Security Groups**: Network isolation between components

#### Monitoring
- **CloudWatch Log Group**: 7-day retention for ECS logs
- **Container Insights**: Enabled for ECS metrics
- **ALB Access Logs**: Can be enabled if needed

### 3. Backend Integration

#### New OpenSearch Vector Store
**File**: `server/services/vectorStoreOpenSearch.js`

- Full replacement for ChromaDB
- Uses `@opensearch-project/opensearch` client
- k-NN vector search with HNSW algorithm
- Supports 1536-dimension embeddings (OpenAI)
- Bulk document indexing
- Compatible with existing RAG service

**Key Methods**:
- `initialize()`: Connect to OpenSearch, create k-NN index
- `addDocuments()`: Chunk text, generate embeddings, bulk index
- `similaritySearch()`: k-NN query for relevant documents
- `similaritySearchWithScore()`: k-NN with relevance scores
- `getCollectionInfo()`: Index statistics

### 4. Container Setup

#### Dockerfile
**File**: `Dockerfile` (root directory)

- Multi-stage build for optimization
- Stage 1: Build React frontend
- Stage 2: Production image with backend
- Non-root user for security
- Health check for ECS
- Optimized layer caching

#### .dockerignore
**File**: `.dockerignore`

- Excludes node_modules, git files, local data
- Reduces build context size
- Faster builds and smaller images

### 5. Documentation

#### Migration Guide
**File**: `docs/OPENSEARCH_MIGRATION.md`

Comprehensive guide covering:
- Why migrate from ChromaDB to OpenSearch
- Step-by-step migration process
- Code differences between ChromaDB and OpenSearch
- Performance tuning recommendations
- Troubleshooting common issues
- Cost comparison

#### Deployment Guide
**File**: `docs/AWS_DEPLOYMENT.md`

Complete deployment walkthrough:
- Prerequisites and tool installation
- Step-by-step deployment process
- Post-deployment configuration
- Monitoring and logging
- Update procedures
- Cleanup instructions
- Troubleshooting tips

#### Pulumi README
**File**: `pulumi/README.md`

Detailed infrastructure documentation:
- Architecture diagram
- Prerequisites
- Configuration options
- Deployment steps
- Cost optimization tips
- Useful commands
- Security considerations

### 6. Updated Files

#### package.json
Added dependency:
```json
"@opensearch-project/opensearch": "^2.5.0"
```

#### CLAUDE.md
Added new section:
- AWS Deployment with Pulumi overview
- Infrastructure components
- Quick deployment commands
- OpenSearch integration details
- Container build process
- Important Pulumi details
- Monitoring and debugging tips

## Resource Outputs

After deployment, Pulumi provides these outputs:

```
vpcId                          # VPC identifier
albDnsName                     # Load balancer DNS name
albUrl                         # Complete backend API URL (http://...)
cloudFrontUrl                  # Frontend URL (https://...)
openSearchEndpoint             # OpenSearch domain endpoint
openSearchDashboard            # OpenSearch Dashboards URL
ecsClusterName                 # ECS cluster name
frontendBucketName             # S3 bucket name
secretsManagerSecretArn        # Secrets Manager ARN
uploadFrontendCommand          # Command to upload frontend
invalidateCloudFrontCommand    # Command to invalidate CDN cache
```

## Cost Estimate

Monthly costs for the default configuration:

| Service | Configuration | Estimated Cost |
|---------|--------------|----------------|
| OpenSearch | t3.small.search, 10GB | $40 |
| ECS Fargate | 0.5 vCPU, 1GB, low traffic | $15 |
| NAT Gateway | Single instance | $32 |
| Application Load Balancer | Standard | $16 |
| CloudFront | Pay-as-you-go | $1-5 |
| S3 | < 1GB storage | < $1 |
| CloudWatch Logs | 7-day retention | $1-2 |
| Secrets Manager | 1 secret | $0.40 |
| **Total** | | **~$105-115/month** |

## Next Steps

### Immediate
1. **Install dependencies**: `cd pulumi && npm install`
2. **Build container**: Build and push Docker image to ECR
3. **Configure secrets**: Set OpenSearch password and API keys
4. **Deploy infrastructure**: Run `pulumi up`
5. **Deploy frontend**: Upload React build to S3
6. **Ingest data**: Load OpenTelemetry docs into OpenSearch

### Optional Enhancements
1. **Custom domain**: Add Route 53 and ACM certificates
2. **HTTPS on ALB**: Configure SSL/TLS termination
3. **Auto-scaling**: Add ECS service auto-scaling policies
4. **Monitoring**: Set up CloudWatch dashboards and alarms
5. **CI/CD**: Integrate with GitHub Actions or AWS CodePipeline
6. **WAF**: Add AWS WAF to CloudFront and ALB
7. **Backup**: Configure OpenSearch snapshots to S3
8. **Multi-region**: Deploy to additional regions for DR

## Architecture Decisions

### Why OpenSearch over ChromaDB?
- **Managed service**: No infrastructure to maintain
- **Scalability**: Easy to scale without operational overhead
- **High availability**: Built-in replication and failover
- **Production-ready**: Enterprise features (monitoring, backups)
- **Cost-effective**: Lower TCO when including operational costs

### Why ECS Fargate over EC2?
- **Serverless**: No servers to patch or maintain
- **Cost-efficient**: Pay only for task runtime
- **Fast scaling**: Scale tasks in seconds
- **Simpler**: No cluster management required

### Why CloudFront over S3 Static Hosting?
- **Performance**: Global CDN for low latency
- **HTTPS**: Free SSL/TLS certificates
- **Security**: Origin Access Control, WAF integration
- **Caching**: Reduced S3 costs through caching

### Why Application Load Balancer?
- **Layer 7**: HTTP/HTTPS routing and health checks
- **Integration**: Native ECS integration
- **SSL termination**: Can add HTTPS easily
- **Path-based routing**: Future expansion to microservices

## Deployment Checklist

- [ ] AWS account with appropriate permissions
- [ ] Pulumi CLI installed and configured
- [ ] AWS CLI installed and configured
- [ ] Docker installed for building images
- [ ] Node.js 18+ installed
- [ ] Repository cloned and dependencies installed
- [ ] ECR repository created
- [ ] Docker image built and pushed to ECR
- [ ] Pulumi stack initialized
- [ ] Secrets configured (OpenSearch password, API keys)
- [ ] Backend image URL set in Pulumi config
- [ ] Infrastructure deployed (`pulumi up`)
- [ ] Deployment successful (check outputs)
- [ ] Backend health check passing
- [ ] React frontend built
- [ ] Frontend uploaded to S3
- [ ] CloudFront cache invalidated
- [ ] Documentation ingested to OpenSearch
- [ ] Application tested end-to-end
- [ ] Monitoring and logging verified
- [ ] Cost alerts configured (optional)

## Support and Resources

- **Pulumi Documentation**: https://www.pulumi.com/docs/
- **AWS ECS Guide**: https://docs.aws.amazon.com/ecs/
- **OpenSearch Service**: https://docs.aws.amazon.com/opensearch-service/
- **LangChain OpenSearch**: https://js.langchain.com/docs/integrations/vectorstores/opensearch

For issues or questions:
1. Check `pulumi/README.md` for common issues
2. Review `docs/AWS_DEPLOYMENT.md` troubleshooting section
3. Check application logs in CloudWatch
4. Review Pulumi stack state: `pulumi stack`

## Summary

This Pulumi infrastructure provides a **production-ready, scalable, and secure** deployment of the OpenTelemetry AI Chatbot on AWS. The setup includes:

✅ Complete AWS infrastructure with VPC, ECS, OpenSearch, ALB, S3, CloudFront
✅ OpenSearch vector store implementation replacing ChromaDB
✅ Production-optimized Docker container
✅ Comprehensive documentation for deployment and migration
✅ Cost-optimized configuration (~$100-120/month)
✅ Security best practices (VPC isolation, encryption, least-privilege IAM)
✅ Monitoring and logging with CloudWatch
✅ Easy deployment process with Pulumi
✅ Updated CLAUDE.md for future development

The infrastructure is ready to deploy with `pulumi up` after minimal configuration.
