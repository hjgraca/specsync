# Deploy Specsync to Fly.io

Deploys the Specsync container to [Fly.io](https://fly.io/) with a single command. Fly.io handles HTTPS, global edge routing, and deploys directly from your Dockerfile.

## Prerequisites

- [flyctl CLI](https://fly.io/docs/flyctl/install/) installed and authenticated:
  ```bash
  curl -L https://fly.io/install.sh | sh
  fly auth login
  ```

## Deploy

From the repository root:

```bash
fly launch --name specsync --region iad --no-deploy
```

This creates a `fly.toml` config file. Edit it to set the internal port and environment variables:

```toml
[env]
  PORT = "4000"
  HOST = "0.0.0.0"
  REVIEW_TOOL_DB_PATH = "/data/specsync.db"

[[services]]
  internal_port = 4000
```

Then deploy:

```bash
fly deploy
```

## Get the URL

After deploy, the CLI prints the URL:

```
https://specsync.fly.dev
```

Or check it with:

```bash
fly status
```

## Configure your agents

Re-run the skill installer and enter the deployed URL when prompted:

```bash
npx @specsync/skill
# When asked for the server URL, enter: https://specsync.fly.dev
```

This saves the URL to `.specsync.json` in your project so all agents use it automatically.

You can also set it via environment variable:

```bash
export REVIEW_TOOL_URL=https://specsync.fly.dev
```

## Storage

Fly.io instances have ephemeral storage by default. This works well for Specsync — sessions are short-lived and specs auto-purge after 30 days.

For persistent storage, attach a Fly volume:

```bash
fly volumes create specsync_data --size 1 --region iad
```

Then add a `[mounts]` section to `fly.toml`:

```toml
[mounts]
  source = "specsync_data"
  destination = "/data"
```

## Tear down

```bash
fly apps destroy specsync
```

## Cost

Fly.io includes a free allowance that covers small apps. Beyond that, a single shared-cpu-1x VM with 256MB RAM costs ~$2/month. See [Fly.io pricing](https://fly.io/docs/about/pricing/).
