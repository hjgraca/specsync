# Deploy Specsync to Google Cloud (Cloud Run)

Deploys the Specsync container to [Cloud Run](https://cloud.google.com/run) with a single command. Cloud Run handles HTTPS, scaling to zero, and auto-scaling.

## Prerequisites

- [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated:
  ```bash
  gcloud auth login
  gcloud config set project YOUR_PROJECT_ID
  ```
- Docker running locally (or use Cloud Build — see below)

## Option A: Deploy from source (simplest)

Cloud Run can build and deploy directly from source:

```bash
gcloud run deploy specsync \
  --source . \
  --port 4000 \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "PORT=4000,HOST=0.0.0.0,REVIEW_TOOL_DB_PATH=/data/specsync.db"
```

Run this from the repository root. Cloud Run builds the Dockerfile using Cloud Build and deploys it.

## Option B: Build and push manually

```bash
# Build and push to Artifact Registry
gcloud artifacts repositories create specsync \
  --repository-format docker \
  --location us-central1 \
  --quiet 2>/dev/null || true

gcloud builds submit \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/specsync/server:latest

# Deploy
gcloud run deploy specsync \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/specsync/server:latest \
  --port 4000 \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "PORT=4000,HOST=0.0.0.0,REVIEW_TOOL_DB_PATH=/data/specsync.db"
```

## Option C: Deploy from GHCR

Use the pre-built image from GitHub Container Registry:

```bash
gcloud run deploy specsync \
  --image ghcr.io/hjgraca/specsync:latest \
  --port 4000 \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "PORT=4000,HOST=0.0.0.0,REVIEW_TOOL_DB_PATH=/data/specsync.db"
```

## Get the URL

After deploy, the CLI prints the service URL:

```
Service URL: https://specsync-xxxxx-uc.a.run.app
```

## Configure your agents

Tell your agent to run `/specsync-setup` and enter the deployed URL:

```
https://specsync-xxxxx-uc.a.run.app
```

This saves the URL to `.specsync.json` in your project so all agents use it automatically.

You can also set it via environment variable:

```bash
export REVIEW_TOOL_URL=https://specsync-xxxxx-uc.a.run.app
```

## Storage

Cloud Run's filesystem is writable but **in-memory and ephemeral**. The image
already creates `/data`, so `REVIEW_TOOL_DB_PATH=/data/specsync.db` works — but
be aware of two consequences specific to Cloud Run:

- **Scale-to-zero wipes the database.** Because Cloud Run stops idle instances,
  the SQLite file is lost whenever the service scales down — which it does
  frequently with light usage. Reviews effectively last only as long as the
  instance stays warm.
- **Multiple instances don't share the file.** If Cloud Run autoscales beyond
  one instance, each gets its own copy, so reviewers can hit different data.

This is fine for short-lived, single-reviewer sessions. If you want reviews to
survive idleness or run more than one instance, set `--min-instances 1` **and**
`--max-instances 1` to pin a single warm instance, or move the database to a
[Cloud Storage FUSE volume mount](https://cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts)
at `/data`. For a more robust option, run on a platform with a real attached
volume (see the [Fly.io](deploy-flyio.md) or [Railway](deploy-railway.md) guides).

## Tear down

```bash
gcloud run services delete specsync --region us-central1 --quiet
```

## Cost

Cloud Run scales to zero when idle — you only pay for requests. With light usage, expect under $5/month. See [Cloud Run pricing](https://cloud.google.com/run/pricing).
