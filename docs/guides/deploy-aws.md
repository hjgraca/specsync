# Deploy Specsync to AWS (App Runner)

Deploys a single container to [AWS App Runner](https://aws.amazon.com/apprunner/) using CDK. App Runner handles HTTPS, scaling, and deploys from a Docker image pushed to ECR.

## Prerequisites

- AWS CLI configured with credentials (`aws configure`)
- Node.js 22+
- Docker running locally
- CDK bootstrapped in your target account/region:
  ```bash
  npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
  ```

## Deploy

```bash
cd deploy/aws
npm install
npx cdk deploy
```

CDK builds the Docker image, pushes it to ECR, and creates the App Runner service. The output prints the HTTPS URL:

```
Outputs:
SpecsyncStack.Url = https://xxxxx.us-east-1.awsapprunner.com
```

## Configure your agents

Re-run the skill installer and enter the deployed URL when prompted:

```bash
npx @specsync/skill
# When asked for the server URL, enter: https://xxxxx.us-east-1.awsapprunner.com
```

This saves the URL to `.specsync.json` in your project so all agents use it automatically.

You can also set it via environment variable:

```bash
export REVIEW_TOOL_URL=https://xxxxx.us-east-1.awsapprunner.com
```

## What gets created

| Resource | Purpose |
|----------|---------|
| ECR repository | Stores the Docker image |
| IAM role | Lets App Runner pull from ECR |
| App Runner service | Runs the container (0.25 vCPU, 0.5 GB) |

## Customize

Edit `deploy/aws/lib/specsync-stack.ts` to change:

- **Instance size** — adjust `cpu` and `memory` in `instanceConfiguration`
- **Region** — set `CDK_DEFAULT_REGION` environment variable
- **Custom domain** — add an `apprunner.CfnCustomDomainAssociation` resource

## Storage

App Runner storage is ephemeral — data resets on redeploy. This is fine for Specsync because:

- Q&A sessions are short-lived (hours)
- Documents auto-purge after 30 days
- Git is the source of truth for specs

For persistent storage, add an EFS volume (requires VPC configuration in the stack).

## Tear down

```bash
cd deploy/aws
npx cdk destroy
```

## Cost

App Runner charges for compute while the service is running. The default config (0.25 vCPU, 0.5 GB) costs roughly $5-10/month with light usage. App Runner pauses to minimum instances when idle.
