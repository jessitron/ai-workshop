# AWS Deployment Guide

This guide walks you through deploying the OpenTelemetry AI Chatbot to AWS using Pulumi.

**✨ New Feature**: Docker builds are now fully automated! Pulumi automatically builds and pushes your container images - no manual Docker commands needed.

## Architecture Overview

**Simplified Architecture**: The container serves both the React frontend and backend API. No separate S3/CloudFront needed!

```
┌─────────────────────────────────────────────────────────────────┐
│                          AWS Cloud                              │
│                                                                 │
│  ┌──────────────┐                                              │
│  │     ALB      │────────┐ Serves frontend & backend          │
│  │   (Port 80)  │        │                                     │
│  └──────────────┘        │                                     │
│         │                │                                     │
│  ┌──────┴────────────────┴─────────────────┐                  │
│  │              VPC                         │                  │
│  │                                          │                  │
│  │  ┌──────────────┐      ┌─────────────┐  │                  │
│  │  │ ECS Fargate  │─────▶│ OpenSearch  │  │                  │
│  │  │   Container  │      │   Domain    │  │                  │
│  │  │              │      └─────────────┘  │                  │
│  │  │ - Backend    │                       │                  │
│  │  │ - Frontend   │      ┌─────────────┐  │                  │
│  │  │   (static)   │      │   Secrets   │  │                  │
│  │  └──────┬───────┘      │   Manager   │  │                  │
│  │         └──────────────▶└─────────────┘  │                  │
│  └──────────────────────────────────────────┘                  │
│                    │                                            │
│                    ▼                                            │
│  External LLM APIs (OpenAI, Anthropic, Bedrock)               │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. Tools Installation

```bash
# Install Pulumi CLI
curl -fsSL https://get.pulumi.com | sh

# Install AWS CLI
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installations
pulumi version
aws --version
```

### 2. AWS Configuration

```bash
# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity
```

### 3. Pulumi Account

```bash
# Option 1: Use Pulumi Cloud (free tier available)
pulumi login

# Option 2: Use local state storage
pulumi login --local
```

## Deployment Steps

### Step 1: Prepare the Project

```bash
cd ai-workshop

# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install Pulumi dependencies
cd pulumi
npm install
cd ..
```

### Step 2: Configure Pulumi Stack

**✨ New**: Docker builds are now fully automated! No manual ECR or Docker commands needed.

```bash
cd pulumi

# Initialize stack
pulumi stack init dev

# Set AWS region
pulumi config set aws:region us-east-1

# Set OpenSearch master password (required)
pulumi config set --secret opensearchMasterPassword "YourStrongPassword123!"

# Optional: Set API keys (can be set in Secrets Manager later)
pulumi config set --secret openaiApiKey "sk-..."
pulumi config set --secret anthropicApiKey "sk-ant-..."

# Optional: Set OpenSearch master user (defaults to 'admin')
pulumi config set opensearchMasterUser admin
```

**Note**: The `backendImage` config is no longer needed - Pulumi builds and pushes Docker images automatically!

### Step 3: Deploy Infrastructure (with Automated Build)

```bash
# Ensure Docker is running (required for automated builds)
docker ps

# Preview the deployment
pulumi preview

# Deploy (this will take 15-20 minutes)
# Includes: Docker build ~2-5 min + Infrastructure ~10-15 min
pulumi up

# Select 'yes' when prompted
```

**What happens during deployment:**
1. ✅ Creates ECR repository
2. ✅ Builds Docker image from your code
3. ✅ Pushes image to ECR
4. ✅ Creates all AWS infrastructure
5. ✅ Deploys container to ECS

**Expected output:**
```
Updating (dev)

View Live: https://app.pulumi.com/...

     Type                              Name                          Status
 +   pulumi:pulumi:Stack              otel-ai-chatbot-infra-dev     created
 +   ├─ aws:ecr:Repository            otel-ai-chatbot-backend       created
 +   ├─ aws:ecr:LifecyclePolicy       otel-ai-chatbot-lifecycle     created
 +   ├─ docker:Image                  otel-ai-chatbot-image         created
 +   ├─ awsx:ec2:Vpc                  otel-ai-chatbot-vpc           created
 +   ├─ aws:ecs:Cluster               otel-ai-chatbot-cluster       created
 +   ├─ aws:opensearch:Domain         otel-ai-chatbot-opensearch    created
 +   ├─ aws:lb:LoadBalancer           otel-ai-chatbot-alb           created
 +   └─ aws:ecs:Service               otel-ai-chatbot-service       created

Outputs:
    albUrl                : "http://otel-ai-chatbot-alb-123456.us-east-1.elb.amazonaws.com"
    openSearchEndpoint    : "vpc-otel-ai-chatbot-dev-abc123.us-east-1.es.amazonaws.com"
    ecrRepositoryUrl      : "123456.dkr.ecr.us-east-1.amazonaws.com/otel-ai-chatbot-backend"
    containerImageDigest  : "123456.dkr.ecr.us-east-1.amazonaws.com/...@sha256:abc..."

Resources:
    + 40 created (simplified architecture - no S3/CloudFront)

Duration: 18m45s
```

### Step 5: Verify Backend Deployment

```bash
# Get ALB URL
ALB_URL=$(pulumi stack output albUrl)

# Test health endpoint
curl $ALB_URL/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-01-07T...",
#   "environment": "dev",
#   "availableProviders": ["openai"]
# }
```

### Step 6: Configure Backend Environment

The backend container is already configured with OpenSearch. You just need to update API keys in Secrets Manager:

**Update Secrets Manager with your API keys:**

```bash
# Get secret ARN
SECRET_ARN=$(pulumi stack output secretsManagerSecretArn)

# Update secrets with your actual API keys
aws secretsmanager put-secret-value \
  --secret-id $SECRET_ARN \
  --secret-string '{
    "OPENAI_API_KEY": "sk-your-actual-key",
    "ANTHROPIC_API_KEY": "sk-ant-your-actual-key"
  }'

# Force new ECS deployment to pick up new secrets
aws ecs update-service \
  --cluster $(pulumi stack output ecsClusterName) \
  --service otel-ai-chatbot-service \
  --force-new-deployment
```

### Step 7: Ingest Documentation

```bash
# Get OpenSearch endpoint and credentials
OPENSEARCH_ENDPOINT=$(pulumi stack output openSearchEndpoint)
OPENSEARCH_PASSWORD=$(pulumi config get opensearchMasterPassword --show-secrets)

# Run ingestion script locally pointing to OpenSearch
cd ..
cat > .env.aws << EOF
OPENSEARCH_ENDPOINT=https://$OPENSEARCH_ENDPOINT
OPENSEARCH_USERNAME=admin
OPENSEARCH_PASSWORD=$OPENSEARCH_PASSWORD
OPENSEARCH_INDEX=otel_knowledge
OPENAI_API_KEY=$(pulumi config get openaiApiKey --show-secrets)
DEFAULT_LLM_PROVIDER=openai
EOF

# Run with OpenSearch backend
USE_OPENSEARCH=true node scripts/ingest-data.js
```

### Step 8: Access the Application

```bash
# Get ALB URL (serves both frontend and backend)
ALB_URL=$(pulumi stack output albUrl)

echo "Application URL: $ALB_URL"
echo "Frontend: $ALB_URL"
echo "Backend API: $ALB_URL/api"

# Open in browser
open $ALB_URL
```

**Note**: The ALB serves both the React frontend and the backend API. The container includes the built React app in production mode.

## Post-Deployment Configuration

### 1. Custom Domain (Optional)

```bash
# In Route 53, create hosted zone for your domain
# Get ALB DNS name and hosted zone ID
ALB_DNS=$(pulumi stack output albDnsName)
ALB_ZONE_ID=$(aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?DNSName=='$ALB_DNS'].CanonicalHostedZoneId" \
  --output text)

# Create Route 53 alias record pointing to ALB
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "chatbot.yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "'$ALB_ZONE_ID'",
          "DNSName": "'$ALB_DNS'",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

### 2. Enable HTTPS on ALB

```bash
# Request ACM certificate
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates --query 'CertificateSummaryList[0].CertificateArn' --output text)

# Update ALB listener to use HTTPS
# (Modify pulumi/index.ts and redeploy)
```

### 3. Configure Auto-Scaling

Add to `pulumi/index.ts`:

```typescript
// Auto-scaling target
const scalingTarget = new aws.appautoscaling.Target("ecs-target", {
    maxCapacity: 4,
    minCapacity: 1,
    resourceId: pulumi.interpolate`service/${cluster.name}/${service.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs",
});

// CPU-based scaling policy
const scalingPolicy = new aws.appautoscaling.Policy("ecs-policy", {
    policyType: "TargetTrackingScaling",
    resourceId: scalingTarget.resourceId,
    scalableDimension: scalingTarget.scalableDimension,
    serviceNamespace: scalingTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
        targetValue: 70.0,
        predefinedMetricSpecification: {
            predefinedMetricType: "ECSServiceAverageCPUUtilization",
        },
    },
});
```

## Monitoring and Logs

### View Application Logs

```bash
# Stream logs from CloudWatch
aws logs tail /aws/ecs/otel-ai-chatbot-logs --follow

# View last 1 hour of logs
aws logs tail /aws/ecs/otel-ai-chatbot-logs --since 1h
```

### Monitor ECS Service

```bash
# Get service status
aws ecs describe-services \
  --cluster $(pulumi stack output ecsClusterName) \
  --services otel-ai-chatbot-service

# Get task status
aws ecs list-tasks --cluster $(pulumi stack output ecsClusterName)
```

### Access OpenSearch Dashboards

OpenSearch is in a private subnet, so you need to create a tunnel:

```bash
# Option 1: Use bastion host
# Option 2: Use AWS Systems Manager Session Manager
# Option 3: Configure VPN access

# Then access dashboard at:
OPENSEARCH_DASHBOARD=$(pulumi stack output openSearchDashboard)
echo "Dashboard: https://$OPENSEARCH_DASHBOARD/_dashboards"
```

## Updating the Application

### Update Backend Code (Automated)

**✨ Simplified**: Just run `pulumi up` to rebuild and redeploy!

```bash
cd pulumi

# Make your code changes in ../server or ../

# Deploy with automatic rebuild
pulumi up
```

**What happens:**
1. Pulumi detects code changes
2. Rebuilds Docker image (with layer caching for speed)
3. Pushes new image to ECR
4. Updates ECS service automatically
5. Waits for deployment to stabilize

**Update time**: ~3-5 minutes (faster with cached Docker layers)

**Alternative - Manual rebuild** (if needed):

```bash
# Use Pulumi output commands for manual control
cd pulumi
eval $(pulumi stack output ecrLoginCommand)
eval $(pulumi stack output dockerBuildCommand)

# Force ECS to use new image
aws ecs update-service \
  --cluster $(pulumi stack output ecsClusterName) \
  --service otel-ai-chatbot-service \
  --force-new-deployment
```

### Update Frontend

Frontend updates are now bundled with backend deployments since the container serves both:

```bash
# Make your changes to client code
# Then redeploy the entire container
cd pulumi
pulumi up
```

The automated build process will:
1. Rebuild the React frontend
2. Rebuild the Docker image with new frontend
3. Push to ECR and update ECS service

### Update Infrastructure

```bash
cd pulumi

# Make changes to index.ts
# Preview changes
pulumi preview

# Apply changes
pulumi up
```

## Cleanup

To destroy all resources:

```bash
cd pulumi

# Destroy infrastructure (will prompt for confirmation)
# This includes ECR repository and all images
pulumi destroy

# Delete stack
pulumi stack rm dev
```

**Note**: The ECR repository is automatically deleted (including all images) because it's configured with `forceDelete: true` in the Pulumi code.

## Cost Optimization Tips

1. **Use Spot Instances**: Configure ECS to use Fargate Spot for ~70% savings
2. **Reduce OpenSearch**: Use t3.small.search for development
3. **Remove NAT Gateway**: Use public subnets for ECS (less secure)
4. **CloudWatch Logs**: Reduce retention to 3-7 days
5. **Reduce ECS resources**: Use 0.25 vCPU / 0.5 GB memory for low traffic

## Troubleshooting

### Issue: ECS Task Fails to Start

**Check logs:**
```bash
aws logs tail /aws/ecs/otel-ai-chatbot-logs --since 30m
```

**Common causes:**
- Secrets not configured in Secrets Manager
- Container image pull errors (check ECR permissions)
- OpenSearch not accessible (check security groups)

### Issue: OpenSearch Connection Timeout

**Solutions:**
- Verify security group allows traffic from ECS (port 443)
- Check OpenSearch domain is "Active" status
- Verify VPC configuration matches

### Issue: Frontend Not Loading

**Check:**
- ECS container is running: `aws ecs list-tasks --cluster $(pulumi stack output ecsClusterName)`
- Container has NODE_ENV=production: Check ECS task definition environment variables
- Frontend build is included in container: `docker run --rm ai-chatbot ls -la /app/client/build/`
- ALB health check passing: Check target group health in AWS Console

## Next Steps

- [ ] Configure custom domain with Route 53
- [ ] Add SSL/TLS certificates with ACM
- [ ] Set up CloudWatch alarms for monitoring
- [ ] Configure automated backups for OpenSearch
- [ ] Implement CI/CD pipeline (GitHub Actions)
- [ ] Add WAF rules to ALB
- [ ] Configure VPN or bastion host for OpenSearch access
- [ ] Set up cost alerts in AWS Budgets

## Resources

- [Pulumi AWS Documentation](https://www.pulumi.com/docs/clouds/aws/)
- [ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [OpenSearch Service Documentation](https://docs.aws.amazon.com/opensearch-service/)
- [Application Load Balancer Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
