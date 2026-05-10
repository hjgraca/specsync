FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx tsc -p tsconfig.build.json && npx vite build

FROM node:22-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/package.json .

RUN npm install --omit=dev

ENV PORT=4000
ENV HOST=0.0.0.0
ENV REVIEW_TOOL_DB_PATH=/data/specsync.db

EXPOSE 4000

RUN mkdir -p /data && chown app:app /data

USER app

CMD ["node", "dist/server/index.js"]
