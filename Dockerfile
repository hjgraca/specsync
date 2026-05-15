FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile

COPY packages/sdk/ packages/sdk/
COPY packages/server/ packages/server/

RUN pnpm --filter @specsync/sdk build && pnpm --filter @specsync/server build

RUN pnpm deploy --filter @specsync/server --prod --legacy /app/deploy

FROM node:22-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /app/deploy/node_modules/ node_modules/
COPY --from=builder /app/packages/server/dist/ dist/

ENV PORT=4000
ENV HOST=0.0.0.0
ENV REVIEW_TOOL_DB_PATH=/data/specsync.db

EXPOSE 4000

RUN mkdir -p /data && chown app:app /data

USER app

CMD ["node", "dist/cli.js"]
