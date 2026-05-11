# Using Specsync with Any Agent (Manual Setup)

## Prerequisites

- Specsync server running (`npx @specsync/server` or Docker)
- Any AI coding agent with shell/terminal access

## Install

Copy the universal skill file to your agent's skill directory:

```bash
# Option 1: Use the installer with a generic target
npx @specsync/skill

# Option 2: Copy manually
cp packages/skill/skills/universal/SKILL.md <your-agent-skill-directory>/specsync/SKILL.md
```

Common skill directories by agent:
- `.agents/skills/specsync/` — Agent Skills standard (Copilot, Codex)
- `.claude/skills/specsync/` — Claude Code
- `.kiro/skills/specsync/` — Kiro
- `.cursor/skills/specsync/` — Cursor
- `.pi/skills/specsync/` — Pi

If your agent doesn't support skills, add the content of `skills/universal/SKILL.md` to your agent's system prompt or rules file.

## The API (for building custom integrations)

If skills don't work for your agent, you can integrate directly with the HTTP API.

### Ask questions

```bash
# Create a session
curl -s -X POST http://localhost:4000/qa/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Questions",
    "questions": [
      {
        "id": "q1",
        "title": "Which database should we use?",
        "options": [
          {"key": "postgres", "label": "PostgreSQL", "recommended": true},
          {"key": "mysql", "label": "MySQL"}
        ],
        "type": "single-select"
      }
    ]
  }'

# Response: {"id": "...", "token": "...", "url": "..."}

# Poll for answers
curl -s "http://localhost:4000/qa/sessions/{id}?token={token}"
# When status = "completed", answers are in the "answers" object
```

### Submit a spec for review

```bash
# Create a document
curl -s -X POST http://localhost:4000/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Spec",
    "markdown": "# Full markdown content here..."
  }'

# Response: {"slug": "...", "accessToken": "...", "docUrl": "..."}

# Poll for approval
curl -s "http://localhost:4000/documents/{slug}/events/pending?since=0" \
  -H "x-share-token: {accessToken}"
# Look for "document.approved" or "document.changes_requested" event
```

### Reply to comments

```bash
curl -s -X POST "http://localhost:4000/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"type": "comment.reply", "markId": "MARK_ID", "by": "ai:my-agent", "text": "Good point, I will update the spec."}'
```

## Configuration

```bash
export REVIEW_TOOL_URL=http://localhost:4000
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Start the server: `npx @specsync/server` |
| 404 on endpoints | Check the server URL — no trailing slash |
| Can't parse response | Responses are JSON. Use `jq` or your language's JSON parser |
