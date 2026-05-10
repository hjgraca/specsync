# Specsync

Collaborative spec review for AI coding agents. Your agent asks questions and submits specs — your team answers and reviews in the browser.

![Spec Review UI](screenshots/review-ui.png)

## What it does

**Q&A** — Your agent posts structured questions. Your team answers in a shared form. The agent polls and continues once answers arrive.

**Spec Review** — Your agent publishes a plan or spec. Your team reviews with inline comments and suggestions. Approve or request changes. AI review agents can participate too.

**Any agent** — Works with Claude Code, Cursor, Copilot, Kiro, Pi, or any agent with shell access. No plugins required — just HTTP + curl.

## Quick Start

### Docker

```bash
docker run -p 4000:4000 ghcr.io/hjgraca/specsync
```

### From source

```bash
git clone https://github.com/hjgraca/specsync
cd specsync
npm install
npm start
```

Server runs at `http://localhost:4000`.

### Install the skill for your agent

```bash
npx specsync install --to claude    # Claude Code
npx specsync install --to cursor    # Cursor
npx specsync install --to copilot   # Copilot CLI
npx specsync install --to kiro      # Kiro / Kiro CLI
npx specsync install --to pi        # Pi
npx specsync install --to all       # All of the above
```

Then tell your agent: **"ask the team"** or **"submit for review"**

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

| Agent | Guide | Install command |
|-------|-------|-----------------|
| Claude Code | [docs/guides/claude-code.md](docs/guides/claude-code.md) | `npx specsync install --to claude` |
| Cursor | [docs/guides/cursor.md](docs/guides/cursor.md) | `npx specsync install --to cursor` |
| Copilot CLI | [docs/guides/copilot-cli.md](docs/guides/copilot-cli.md) | `npx specsync install --to copilot` |
| Kiro | [docs/guides/kiro.md](docs/guides/kiro.md) | `npx specsync install --to kiro` |
| Kiro CLI | [docs/guides/kiro-cli.md](docs/guides/kiro-cli.md) | `npx specsync install --to kiro` |
| Pi | [docs/guides/pi.md](docs/guides/pi.md) | `npx specsync install --to pi` |
| Any agent | [docs/guides/manual.md](docs/guides/manual.md) | Copy `skills/universal/SKILL.md` |

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
export REVIEW_TOOL_URL=http://192.168.1.50:4000    # LAN
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

## Development

```bash
npm install
npm run dev     # starts server + vite dev server with hot reload
npm test        # run tests
npm run build   # build for production
```

## License

MIT
