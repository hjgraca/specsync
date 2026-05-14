# Deploy Specsync to Railway

Deploys the Specsync container to [Railway](https://railway.app/) with a single command. Railway handles HTTPS, scaling, and deploys directly from your Dockerfile.

## Prerequisites

- [Railway CLI](https://docs.railway.app/guides/cli) installed and authenticated:
  ```bash
  npm install -g @railway/cli
  railway login
  ```

## Deploy

From the repository root:

```bash
railway init
railway up
```

Railway detects the Dockerfile, builds it, and deploys. The first deploy creates the project and service automatically.

## Set environment variables

```bash
railway variables set PORT=4000 HOST=0.0.0.0 REVIEW_TOOL_DB_PATH=/data/specsync.db
```

## Get the URL

Generate a public domain for your service:

```bash
railway domain
```

Output: `https://specsync-production-xxxxx.up.railway.app`

## Configure your agents

Tell your agent to run `/specsync-setup` and enter the deployed URL:

```
https://specsync-production-xxxxx.up.railway.app
```

This saves the URL to `.specsync.json` in your project so all agents use it automatically.

You can also set it via environment variable:

```bash
export REVIEW_TOOL_URL=https://specsync-production-xxxxx.up.railway.app
```

## Storage

Railway provides ephemeral storage by default. This works well for Specsync — sessions are short-lived and specs auto-purge after 30 days.

For persistent storage, attach a Railway volume:

```bash
railway volume create --mount /data
```

## Tear down

```bash
railway delete
```

## Cost

Railway's free tier includes $5 of usage per month. The Hobby plan ($5/month) covers most light-to-moderate usage. See [Railway pricing](https://railway.app/pricing).
