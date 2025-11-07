# Automated Container Build with Pulumi

This Pulumi infrastructure automatically builds and pushes your Docker container to Amazon ECR during deployment. No manual Docker commands required!

## How It Works

When you run `pulumi up`, the following happens automatically:

1. **ECR Repository Creation**: Creates a private container registry in AWS
2. **ECR Authentication**: Obtains temporary credentials to push images
3. **Docker Build**: Builds your container image from the Dockerfile
4. **Image Push**: Pushes the built image to ECR
5. **ECS Deployment**: Deploys the new image to ECS Fargate

## Architecture

```typescript
// ECR Repository
aws.ecr.Repository
  ├─ Encryption enabled (AES256)
  ├─ Vulnerability scanning on push
  └─ Lifecycle policy (keep last 10 images)

// Docker Build & Push (automated)
docker.Image
  ├─ Context: ../ (project root)
  ├─ Dockerfile: ../Dockerfile
  ├─ Platform: linux/amd64
  ├─ Registry: ECR repository
  └─ Authentication: Automatic via authToken

// ECS Task Definition
aws.ecs.TaskDefinition
  └─ Container image: image.repoDigest (automatic reference)
```

## What Gets Built

The Docker build process:

1. **Build Context**: Project root directory (`../`)
2. **Dockerfile**: Multi-stage production Dockerfile
3. **Platform**: linux/amd64 (x86_64 architecture for Fargate)
4. **Build Args**: NODE_ENV=production
5. **Result**: Optimized production container with:
   - Node.js 18 Alpine base
   - Backend server code
   - Built React frontend
   - Non-root user for security
   - Health check endpoint

## Deployment Process

### First-Time Deployment

```bash
cd pulumi

# Install dependencies
npm install

# Initialize stack
pulumi stack init dev

# Configure secrets
pulumi config set --secret opensearchMasterPassword "YourStrongPass123!"
pulumi config set --secret openaiApiKey "sk-..."

# Deploy everything (builds and deploys container automatically)
pulumi up
```

**What happens during `pulumi up`:**

1. ✅ Creates ECR repository
2. ✅ Builds Docker image from your code
3. ✅ Pushes image to ECR
4. ✅ Creates all AWS infrastructure (VPC, ECS, OpenSearch, etc.)
5. ✅ Deploys container to ECS with the built image

**Duration**: ~15-20 minutes
- Docker build: ~2-5 minutes
- Infrastructure creation: ~10-15 minutes (OpenSearch takes longest)

### Updating the Application

When you make code changes and want to redeploy:

```bash
cd pulumi

# Simply run pulumi up again
pulumi up
```

Pulumi will:
1. Detect code changes
2. Rebuild Docker image
3. Push new image to ECR
4. Update ECS service with new image

**No manual Docker commands needed!**

## Image Management

### Automatic Lifecycle Policy

The ECR repository has an automatic lifecycle policy:

```json
{
  "rules": [{
    "rulePriority": 1,
    "description": "Keep last 10 images",
    "selection": {
      "tagStatus": "any",
      "countType": "imageCountMoreThan",
      "countNumber": 10
    },
    "action": {
      "type": "expire"
    }
  }]
}
```

This automatically cleans up old images to save storage costs.

### Image Tagging

Images are tagged with the stack name:
- `dev` stack → `otel-ai-chatbot-backend:dev`
- `staging` stack → `otel-ai-chatbot-backend:staging`
- `prod` stack → `otel-ai-chatbot-backend:prod`

### Vulnerability Scanning

Every pushed image is automatically scanned for vulnerabilities. Check scan results:

```bash
aws ecr describe-image-scan-findings \
  --repository-name otel-ai-chatbot-backend \
  --image-id imageTag=dev
```

## Manual Docker Operations (Optional)

While Pulumi handles everything automatically, you can still use Docker manually:

### Login to ECR

```bash
# Use Pulumi output for login command
pulumi stack output ecrLoginCommand | bash

# Or manually
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(pulumi stack output ecrRepositoryUrl)
```

### Build and Push Manually

```bash
# Use Pulumi output for build command
pulumi stack output dockerBuildCommand | bash

# Or manually
ECR_URL=$(pulumi stack output ecrRepositoryUrl)
docker build -t $ECR_URL:latest ../
docker push $ECR_URL:latest
```

### Force ECS Deployment

```bash
# After manual push, force ECS to pull new image
aws ecs update-service \
  --cluster $(pulumi stack output ecsClusterName) \
  --service otel-ai-chatbot-service \
  --force-new-deployment
```

## Troubleshooting

### Build Fails: "Cannot connect to Docker daemon"

**Problem**: Docker daemon not running or not accessible

**Solution**:
```bash
# Start Docker Desktop (macOS/Windows)
# Or start Docker service (Linux)
sudo systemctl start docker

# Verify Docker is running
docker ps
```

### Build Fails: "ERRO context canceled"

**Problem**: Docker build timeout (large image or slow connection)

**Solution**:
```bash
# Increase Pulumi timeout
pulumi up --timeout 30m
```

### Push Fails: "authentication required"

**Problem**: ECR authentication token expired

**Solution**: Pulumi handles this automatically, but if you see this error, just run `pulumi up` again.

### Image Not Updating in ECS

**Problem**: ECS using cached image

**Solution**:
```bash
# Force ECS to pull latest image
aws ecs update-service \
  --cluster $(pulumi stack output ecsClusterName) \
  --service otel-ai-chatbot-service \
  --force-new-deployment
```

### "no space left on device"

**Problem**: Docker build cache full

**Solution**:
```bash
# Clean up Docker
docker system prune -a

# Then retry
pulumi up
```

## Build Optimization

### Faster Builds

The Dockerfile uses multi-stage builds and layer caching for speed:

```dockerfile
# Stage 1: Builder (cached)
FROM node:18-alpine AS builder
# Dependencies and build

# Stage 2: Production (smaller, faster)
FROM node:18-alpine
# Only production artifacts
```

### Build Cache

Pulumi preserves Docker layer cache between builds:
- First build: ~5 minutes
- Subsequent builds (no code changes): ~30 seconds
- Subsequent builds (code changes): ~1-2 minutes

### Reducing Build Time

1. **Use .dockerignore**: Already configured to exclude unnecessary files
2. **Minimize layers**: Dockerfile optimized with combined RUN commands
3. **Multi-stage build**: Separates build and runtime stages
4. **Layer order**: Dependencies copied before code (better caching)

## Build Outputs

After deployment, check build information:

```bash
# View ECR repository
pulumi stack output ecrRepositoryUrl
# Output: 123456789012.dkr.ecr.us-east-1.amazonaws.com/otel-ai-chatbot-backend

# View image digest (unique per build)
pulumi stack output containerImageDigest
# Output: 123456789012.dkr.ecr.us-east-1.amazonaws.com/otel-ai-chatbot-backend@sha256:abc123...

# List all images in ECR
aws ecr describe-images \
  --repository-name otel-ai-chatbot-backend \
  --query 'imageDetails[*].[imageTags[0],imagePushedAt,imageSizeInBytes]' \
  --output table
```

## Security Features

### ECR Repository Security

- ✅ **Encryption at rest**: AES256 encryption
- ✅ **Vulnerability scanning**: Automatic on push
- ✅ **Private registry**: Not publicly accessible
- ✅ **IAM authentication**: AWS credentials required
- ✅ **Lifecycle policy**: Automatic cleanup

### Container Security

- ✅ **Non-root user**: Runs as nodejs:1001
- ✅ **Minimal base**: Alpine Linux (small attack surface)
- ✅ **No secrets**: Secrets loaded from AWS Secrets Manager
- ✅ **Read-only**: Production dependencies only
- ✅ **Health checks**: Built-in health endpoint

## Cost Implications

### ECR Costs

- **Storage**: $0.10/GB/month
  - Typical image size: ~200-300 MB
  - Cost: ~$0.02-0.03/month per image
  - Lifecycle policy keeps 10 images max: ~$0.20-0.30/month

- **Data Transfer**:
  - Pull from same region: Free (ECS → ECR in same region)
  - Cross-region: $0.09/GB (avoid by deploying in same region)

### Build Process Costs

- **No additional cost**: Pulumi builds on your local machine
- **Alternative**: Use AWS CodeBuild (~$0.005/minute) for CI/CD

## Comparison: Manual vs Automated

| Aspect | Manual Process | Automated with Pulumi |
|--------|----------------|----------------------|
| **Setup** | Configure ECR, Docker login | Automatic |
| **Build** | Run docker build manually | Automatic on `pulumi up` |
| **Push** | Run docker push manually | Automatic |
| **Deploy** | Update ECS service manually | Automatic |
| **Rollback** | Manual image revert | `pulumi stack select` + `pulumi up` |
| **Consistency** | Prone to human error | Guaranteed consistent |
| **CI/CD Integration** | Requires scripting | Built-in |
| **Multi-environment** | Manual tag management | Automatic per stack |

## Advanced: Custom Build Configuration

### Build for Different Platforms

```typescript
const image = new docker.Image(`${appName}-image`, {
    imageName: pulumi.interpolate`${ecrRepository.repositoryUrl}:${environment}`,
    build: {
        context: "../",
        dockerfile: "../Dockerfile",
        platform: "linux/arm64", // For ARM-based Fargate (Graviton)
        // or
        platform: "linux/amd64", // For x86_64 Fargate (default)
    },
    // ...
});
```

### Build Arguments

```typescript
const image = new docker.Image(`${appName}-image`, {
    imageName: pulumi.interpolate`${ecrRepository.repositoryUrl}:${environment}`,
    build: {
        context: "../",
        dockerfile: "../Dockerfile",
        platform: "linux/amd64",
        args: {
            NODE_ENV: "production",
            BUILD_VERSION: pulumi.getStack(),
            ENABLE_FEATURES: "true",
        },
    },
    // ...
});
```

### Skip Build on Preview

```typescript
const image = new docker.Image(`${appName}-image`, {
    imageName: pulumi.interpolate`${ecrRepository.repositoryUrl}:${environment}`,
    buildOnPreview: false, // Don't build during `pulumi preview`
    // ...
});
```

## Next Steps

- ✅ **Automated builds working**: No manual Docker steps needed
- 📝 **CI/CD Pipeline**: Add GitHub Actions for automated deployments
- 🔍 **Image Scanning**: Review vulnerability scan results
- 📊 **Monitoring**: Set up CloudWatch Container Insights
- 🔄 **Blue/Green Deployments**: Implement zero-downtime deployments

## Resources

- [Pulumi Docker Provider](https://www.pulumi.com/registry/packages/docker/)
- [Amazon ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [ECS Task Definition Parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
