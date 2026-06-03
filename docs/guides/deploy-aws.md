# Deploy Specsync to AWS (Lightsail Container Service)

Deploys a single container to [Amazon Lightsail Container Service](https://aws.amazon.com/lightsail/features/containers/) using CDK. Lightsail gives you a public HTTPS endpoint, a managed TLS certificate, and a flat monthly price — no load balancer or VPC to configure.

The CDK stack (`deploy/aws/lib/specsync-stack.ts`) builds the Docker image, pushes it to ECR, and creates a Lightsail container service that pulls from ECR and serves on port 4000 with a `/health` health check.

## Prerequisites

- AWS CLI configured with credentials (`aws configure`)
- Node.js 22+
- Docker running locally (CDK builds the image on your machine)
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

CDK builds the image, pushes it to ECR, and provisions the Lightsail service. First deploys take a few minutes while Lightsail pulls the image and passes health checks. The output prints the HTTPS URL:

```
Outputs:
SpecsyncStack.Url = https://specsync.xxxxx.us-east-1.cs.amazonlightsail.com
```

## Configure your agents

Tell your agent to run `/specsync-setup` and enter the deployed URL:

```
https://specsync.xxxxx.us-east-1.cs.amazonlightsail.com
```

This saves the URL to `.specsync.json` in your project so all agents use it automatically. You can also set it via environment variable:

```bash
export REVIEW_TOOL_URL=https://specsync.xxxxx.us-east-1.cs.amazonlightsail.com
```

## What gets created

| Resource | Purpose |
|----------|---------|
| ECR repository (CDK asset) | Stores the Docker image CDK builds |
| Lightsail container service | Runs the container (`nano` power, 1 node) with a public HTTPS endpoint |
| ECR image-puller role | Lets Lightsail pull the private image from ECR |

The container runs with `PORT=4000`, `HOST=0.0.0.0`, and `REVIEW_TOOL_DB_PATH=/data/specsync.db`.

## Customize

Edit `deploy/aws/lib/specsync-stack.ts` to change:

- **Capacity** — adjust `power` (`nano`, `micro`, `small`, …) and `scale` (node count) on the `CfnContainer`.
- **Region** — set `CDK_DEFAULT_REGION` before `cdk deploy`.
- **Environment variables** — add entries to the container's `environment` array (for example `CORS_ORIGIN`).

## Storage and persistence

> **Important:** Lightsail container storage is **ephemeral** — the SQLite
> database at `/data/specsync.db` is reset on every redeploy or container
> restart. This is acceptable for Specsync's intended use because:
>
> - Q&A sessions are short-lived (minutes to hours).
> - Documents auto-purge after 30 days.
> - Git remains the source of truth for specs — Specsync holds the review, not the spec's canonical copy.
>
> If you need reviews to survive redeploys, point `REVIEW_TOOL_DB_PATH` at a
> mounted persistent volume, or run the server on a host with durable storage
> (see the [Fly.io](deploy-flyio.md) or [Railway](deploy-railway.md) guides,
> which support attached volumes).

## Tear down

```bash
cd deploy/aws
npx cdk destroy
```

## Cost

A `nano` Lightsail container service is a flat ~$7/month at the time of writing, billed whether or not it is handling traffic (Lightsail does not scale to zero). For occasional use, a smaller always-on host or a scale-to-zero platform may be cheaper — see the other deploy guides.
