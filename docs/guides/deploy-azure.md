# Deploy Specsync to Azure (Container Apps)

Deploys the Specsync container to [Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/) with a single command. Container Apps handles HTTPS, scaling to zero, and ingress.

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and authenticated:
  ```bash
  az login
  ```

## Deploy from GHCR (simplest)

Use the pre-built image from GitHub Container Registry:

```bash
# Create resource group
az group create --name specsync-rg --location eastus

# Create Container Apps environment
az containerapp env create \
  --name specsync-env \
  --resource-group specsync-rg \
  --location eastus

# Deploy
az containerapp create \
  --name specsync \
  --resource-group specsync-rg \
  --environment specsync-env \
  --image ghcr.io/hjgraca/specsync:latest \
  --target-port 4000 \
  --ingress external \
  --cpu 0.25 \
  --memory 0.5Gi \
  --min-replicas 0 \
  --max-replicas 1 \
  --env-vars "PORT=4000" "HOST=0.0.0.0" "REVIEW_TOOL_DB_PATH=/data/specsync.db"
```

## Deploy from source

Build locally and push to Azure Container Registry:

```bash
# Create container registry
az acr create --name specsyncregistry --resource-group specsync-rg --sku Basic

# Build and push (from repo root)
az acr build --registry specsyncregistry --image specsync:latest .

# Create Container Apps environment (if not already created)
az containerapp env create \
  --name specsync-env \
  --resource-group specsync-rg \
  --location eastus

# Deploy
az containerapp create \
  --name specsync \
  --resource-group specsync-rg \
  --environment specsync-env \
  --image specsyncregistry.azurecr.io/specsync:latest \
  --registry-server specsyncregistry.azurecr.io \
  --registry-identity system \
  --target-port 4000 \
  --ingress external \
  --cpu 0.25 \
  --memory 0.5Gi \
  --min-replicas 0 \
  --max-replicas 1 \
  --env-vars "PORT=4000" "HOST=0.0.0.0" "REVIEW_TOOL_DB_PATH=/data/specsync.db"
```

> Pulling from a private ACR needs authentication. `--registry-identity system`
> uses a system-assigned managed identity (Azure grants it `acrpull`
> automatically) — the recommended path. Alternatively, enable the ACR admin
> user and pass `--registry-username` / `--registry-password`. The GHCR image
> above is public and needs none of this.

## Get the URL

After deploy, the CLI prints the FQDN:

```bash
az containerapp show --name specsync --resource-group specsync-rg --query properties.configuration.ingress.fqdn -o tsv
```

Output: `specsync.xxxxx.eastus.azurecontainerapps.io`

The full URL is `https://specsync.xxxxx.eastus.azurecontainerapps.io`.

## Configure your agents

Tell your agent to run `/specsync-setup` and enter the deployed URL:

```
https://specsync.xxxxx.eastus.azurecontainerapps.io
```

This saves the URL to `.specsync.json` in your project so all agents use it automatically.

You can also set it via environment variable:

```bash
export REVIEW_TOOL_URL=https://specsync.xxxxx.eastus.azurecontainerapps.io
```

## Storage

Container Apps replica storage is ephemeral. With `--min-replicas 0` (above),
the app scales to zero when idle and the SQLite database at `/data/specsync.db`
is lost on the next cold start — fine for short-lived, single-reviewer sessions.

To keep reviews across idle periods, either set `--min-replicas 1` to pin a warm
replica, or mount an
[Azure Files volume](https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts)
at `/data`. For a simpler always-warm option with an attached disk, see the
[Fly.io](deploy-flyio.md) or [Railway](deploy-railway.md) guides.

## Tear down

```bash
az group delete --name specsync-rg --yes --no-wait
```

## Cost

Container Apps scales to zero when idle — you only pay for active usage. With light usage, expect under $5/month. See [Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/).
