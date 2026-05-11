# Specsync

[![Tests](https://github.com/hjgraca/specsync/actions/workflows/test.yml/badge.svg)](https://github.com/hjgraca/specsync/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@specsync/server)](https://www.npmjs.com/package/@specsync/server)

Collaborative spec review for AI coding agents. Your agent asks questions and submits specs — your team answers and reviews in the browser.

<img width="1354" height="623" alt="image" src="https://github.com/user-attachments/assets/7dac37f8-4842-43b2-8294-d7982e61daae" />


## What it does

**Q&A** — Your agent posts structured questions. Your team answers in a shared form. The agent polls and continues once answers arrive.

**Spec Review** — Your agent publishes a plan or spec. Your team reviews with inline comments and suggestions. Approve or request changes. AI review agents can participate too.

**Any agent** — Works with Claude Code, Cursor, Copilot, Kiro, Pi, or any agent with shell access. No plugins required — just HTTP + curl.

## Quick Start

```bash
# 1. Start the server
npx @specsync/server

# 2. Install skills for your agents (interactive)
npx @specsync/skill
```

Or with Docker:

```bash
docker run -p 4000:4000 ghcr.io/hjgraca/specsync
```

Then tell your agent: **"ask the team"** or **"submit for review"**

## Packages

| Package | Purpose | Install |
|---------|---------|---------|
| [`@specsync/server`](packages/server) | Run the specsync server | `npx @specsync/server` |
| [`@specsync/skill`](packages/skill) | Interactive skill installer for AI agents | `npx @specsync/skill` |
| [`@specsync/sdk`](packages/sdk) | TypeScript SDK for programmatic integration | `npm install @specsync/sdk` |

## How it works

```
Your coding agent                    Specsync server                    Your team
      │                                     │                               │
      │── POST /qa/sessions ──────────────►│                               │
      │◄── { url, token } ────────────────│                               │
      │                                     │── renders Q&A form ─────────►│
      │   (polls every 3s)                  │                               │
      │── GET /qa/sessions/:id ───────────►│◄── answers submitted ────────│
      │◄── { status: "completed" } ────────│                               │
      │                                     │                               │
      │── POST /documents ────────────────►│                               │
      │◄── { docUrl, slug, token } ────────│── renders review UI ────────►│
      │                                     │                               │
      │   (polls every 3s)                  │◄── comments + approve ───────│
      │── GET /events/pending ────────────►│                               │
      │◄── { "document.approved" } ────────│                               │
      │                                     │                               │
      ▼ continues with approved spec        │                               │
```

1. Agent calls specsync API (creates Q&A session or publishes spec)
2. Specsync renders it in the browser (shareable URL, QR code)
3. Team answers or reviews collaboratively — real-time presence shows who's online
4. Agent polls for completion, gets results, continues working

## Screenshots

### Q&A UI

Agent posts questions with options and recommendations. Team answers in the browser. First-answered question shows as complete.

![Q&A UI](screenshots/qa-ui.png)

### Spec Review UI

Agent publishes a markdown spec. Team and AI reviewers comment inline. Quoted text shows the context. Approve or request changes.

![Review UI](screenshots/review-ui.png)

## Integration Guides

| Agent | Guide |
|-------|-------|
| Claude Code | [docs/guides/claude-code.md](docs/guides/claude-code.md) |
| Cursor | [docs/guides/cursor.md](docs/guides/cursor.md) |
| Copilot CLI | [docs/guides/copilot-cli.md](docs/guides/copilot-cli.md) |
| Kiro | [docs/guides/kiro.md](docs/guides/kiro.md) |
| Pi | [docs/guides/pi.md](docs/guides/pi.md) |
| Any agent | [docs/guides/manual.md](docs/guides/manual.md) |

## API Reference

See [docs/api-reference.md](docs/api-reference.md) for all HTTP endpoints.

### Quick overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/qa/sessions` | Create a Q&A session |
| GET | `/qa/sessions/:id?token=` | Get session status + answers |
| POST | `/qa/sessions/:id/answer?token=` | Submit an answer |
| POST | `/documents` | Create a review document |
| GET | `/documents/:slug/state` | Get document + comments |
| PUT | `/documents/:slug` | Update document content |
| POST | `/documents/:slug/ops` | Add comment, reply, approve |
| GET | `/documents/:slug/events/pending?since=` | Poll for decisions |

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `4000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `REVIEW_TOOL_DB_PATH` | `./specsync.db` | SQLite database path |

On the agent side, set `REVIEW_TOOL_URL` to point to your server:

```bash
export REVIEW_TOOL_URL=http://localhost:4000       # local (default)
export REVIEW_TOOL_URL=http://<your-lan-ip>:4000    # LAN
export REVIEW_TOOL_URL=https://specsync.myteam.com # cloud
```

## Features

- **Zero-friction access** — share a URL, no login required. Anonymous codenames for presence.
- **Real-time presence** — see who's viewing the Q&A or review right now.
- **QR codes** — scan to open on mobile, share with teammates.
- **Agent participation** — AI reviewers can comment and reply via the bridge API.
- **Approval gate** — specs stay in review until explicitly approved or rejected.
- **Revision tracking** — update a spec after feedback, same URL, comments preserved.
- **Ephemeral storage** — SQLite working cache. Abandoned sessions auto-purge after 30 days.
- **Methodology agnostic** — works with any spec format. The agent decides what to submit.

## Why Specsync?

| Problem | Without Specsync | With Specsync |
|---------|-----------------|---------------|
| Agent asks you questions | Questions in CLI, only you see them | Shared Q&A form, whole team answers |
| Agent writes a spec | You review alone in terminal | Team reviews in browser with comments |
| Need team approval | Copy-paste to Slack, wait for reply | Approval gate with structured feedback |
| Multiple reviewers | Everyone asks separately | All comments in one place, threaded |
| Agent revises after feedback | New file, lost context | Same URL, revision history, comments preserved |

## Example: What Your Agent Does

When you say **"ask the team what database to use"**, your agent:

```bash
# 1. Creates a Q&A session on the specsync server
curl -s -X POST http://localhost:4000/qa/sessions \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "title": "Database Decision",
  "questions": [{
    "id": "db",
    "title": "What database for the user service?",
    "recommendation": "Postgres — already in the stack, team has expertise.",
    "options": [
      {"key": "pg", "label": "Postgres", "recommended": true},
      {"key": "mongo", "label": "MongoDB"},
      {"key": "dynamo", "label": "DynamoDB"}
    ],
    "type": "single-select"
  }]
}
EOF

# 2. Tells you the URL
# → "Q&A ready at http://localhost:4000/qa/abc?token=xyz"

# 3. Polls until the team answers
while true; do
  RESP=$(curl -s "http://localhost:4000/qa/sessions/abc?token=xyz")
  # When status="completed", continue with the answer
  sleep 3
done
```

Your team answers in the browser. The agent continues with the decision.

## Development

```bash
pnpm install
pnpm dev             # starts server + vite dev server with hot reload
pnpm build           # build all packages
pnpm test            # run unit tests
npx playwright test  # run Playwright E2E tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

MIT
