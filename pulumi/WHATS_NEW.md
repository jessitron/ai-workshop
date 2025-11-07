# What's New: Automated Docker Builds with Pulumi

## Summary

The Pulumi infrastructure now includes **fully automated Docker builds**! When you run `pulumi up`, everything happens automatically - no manual Docker commands required.

## Key Changes

### 1. Automated Container Builds ✨

**Before**:
```bash
# Manual process (7+ commands)
aws ecr create-repository ...
aws ecr get-login-password | docker login ...
docker build -t backend .
docker tag backend:latest <ecr-url>
docker push <ecr-url>
pulumi config set backendImage <ecr-url>
pulumi up
```

**Now**:
```bash
# Automated process (1 command)
pulumi up
```

### 2. New Infrastructure Resources

- **ECR Repository**: Private container registry with encryption and vulnerability scanning
- **ECR Lifecycle Policy**: Automatically keeps last 10 images, deletes older ones
- **Docker Image Resource**: Builds and pushes images automatically
- **Auth Integration**: Automatic ECR authentication

### 3. Updated Pulumi Code

**File**: `pulumi/index.ts`

- Added `@pulumi/docker` provider import
- Created ECR repository (lines 23-34)
- Created lifecycle policy (lines 37-53)
- Automated Docker build (lines 61-76)
- Updated ECS task definition to use built image (lines 387-390)
- Added new outputs for ECR and Docker (lines 537-557)

### 4. New Dependencies

**File**: `pulumi/package.json`

- Added `"@pulumi/docker": "^4.0.0"`

### 5. Comprehensive Documentation

**New Files**:
- `pulumi/AUTOMATED_BUILD.md` - Complete guide to automated builds
- `pulumi/ECR_DOCKER_INTEGRATION.md` - Technical details and resource information
- `pulumi/WHATS_NEW.md` - This file

**Updated Files**:
- `pulumi/README.md` - Simplified deployment steps
- `docs/AWS_DEPLOYMENT.md` - Updated all deployment steps
- `CLAUDE.md` - Added automated build section

## Benefits

### For Developers

- ✅ **Faster iterations**: One command to deploy
- ✅ **No manual steps**: Pulumi handles everything
- ✅ **Consistent builds**: Same process every time
- ✅ **Less error-prone**: No forgetting steps
- ✅ **Better caching**: Docker layer caching for speed

### For Teams

- ✅ **Simplified onboarding**: New developers can deploy immediately
- ✅ **CI/CD friendly**: Single command deployment
- ✅ **Infrastructure as code**: Everything in Pulumi
- ✅ **Multi-environment**: Automatic per-stack tagging

### For Operations

- ✅ **Security**: Automatic vulnerability scanning
- ✅ **Lifecycle management**: Auto-cleanup of old images
- ✅ **Encryption**: AES256 at rest
- ✅ **Auditability**: All actions logged in CloudTrail
- ✅ **Cost-effective**: ~$0.30/month for ECR storage

## What Happens During Deployment

### First Deployment (~15-20 minutes)

```
pulumi up
  ├─ Create ECR repository (~5 sec)
  ├─ Build Docker image (~2-5 min)
  ├─ Push to ECR (~1-2 min)
  ├─ Create VPC (~2 min)
  ├─ Create OpenSearch (~10-12 min)
  ├─ Create ECS/ALB (~2-3 min)
  ├─ Create S3/CloudFront (~2-3 min)
  └─ Deploy ECS service (~1 min)
```

### Subsequent Deployments (~3-5 minutes)

```
pulumi up
  ├─ Detect code changes (~1 sec)
  ├─ Build Docker image (cached layers) (~1-2 min)
  ├─ Push to ECR (~30 sec)
  ├─ Update ECS service (~1-2 min)
  └─ Wait for deployment (~1 min)
```

## New Pulumi Outputs

After deployment, you can access:

```bash
# Container Registry Information
pulumi stack output ecrRepositoryUrl
# Output: 123456.dkr.ecr.us-east-1.amazonaws.com/otel-ai-chatbot-backend

pulumi stack output containerImageDigest
# Output: 123456.dkr.ecr.us-east-1.amazonaws.com/...@sha256:abc123...

# Useful Commands (for manual operations if needed)
pulumi stack output ecrLoginCommand
pulumi stack output dockerBuildCommand
```

## Migration Guide

### If You Were Using Manual Builds

1. **Remove old config** (no longer needed):
   ```bash
   pulumi config rm backendImage
   ```

2. **Update dependencies**:
   ```bash
   cd pulumi
   npm install
   ```

3. **Deploy** (Pulumi will build automatically):
   ```bash
   pulumi up
   ```

### No Breaking Changes

- Existing deployments continue to work
- Old ECR repositories can remain (or be deleted manually)
- Configuration is backward compatible

## FAQ

### Q: Do I need Docker installed?

**A**: Yes, Docker must be running on your machine. Pulumi uses your local Docker daemon to build images.

### Q: Will it build on every `pulumi up`?

**A**: Pulumi only rebuilds when code changes are detected. Unchanged code uses the existing image.

### Q: Can I still build manually?

**A**: Yes! Use the output commands:
```bash
pulumi stack output ecrLoginCommand | bash
pulumi stack output dockerBuildCommand | bash
```

### Q: What about CI/CD?

**A**: Even better! Just run `pulumi up` in your CI/CD pipeline. Works with GitHub Actions, GitLab CI, etc.

### Q: How much does ECR cost?

**A**: ~$0.30/month for typical usage (300MB images, 10 images stored, lifecycle cleanup enabled).

### Q: Can I use a different registry?

**A**: Yes, but you'd need to modify the Pulumi code. ECR is recommended for AWS deployments.

## Troubleshooting

### Build fails with "Cannot connect to Docker daemon"

**Solution**: Start Docker Desktop (macOS/Windows) or Docker service (Linux)

```bash
# Verify Docker is running
docker ps
```

### Build takes too long

**Solution**: Check Docker layer caching is working. Subsequent builds should be much faster.

### Image not updating in ECS

**Solution**: Force ECS deployment:
```bash
aws ecs update-service \
  --cluster $(pulumi stack output ecsClusterName) \
  --service otel-ai-chatbot-service \
  --force-new-deployment
```

## What's Next?

### Immediate

1. ✅ Update Pulumi dependencies: `cd pulumi && npm install`
2. ✅ Deploy with automated builds: `pulumi up`
3. ✅ Enjoy the simplified workflow!

### Future Enhancements

- 🔄 **Multi-architecture builds**: Support ARM/Graviton
- 🚀 **Build caching**: External cache for CI/CD
- 📊 **Build metrics**: Track build times and sizes
- 🔍 **Security scanning**: Enhanced vulnerability analysis
- 🌍 **Multi-region**: Replicate images across regions

## Feedback

This automated build feature simplifies the deployment process significantly. If you encounter any issues or have suggestions, please:

1. Check the troubleshooting guides
2. Review the documentation
3. Submit an issue with details

## Resources

- **Automated Build Guide**: `pulumi/AUTOMATED_BUILD.md`
- **ECR Integration Details**: `pulumi/ECR_DOCKER_INTEGRATION.md`
- **Deployment Guide**: `docs/AWS_DEPLOYMENT.md`
- **Pulumi README**: `pulumi/README.md`
- **Main Documentation**: `CLAUDE.md`

---

**Version**: 1.0.0
**Date**: January 2025
**Status**: ✅ Production Ready
