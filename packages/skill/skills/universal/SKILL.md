---
name: specsync
description: >
  Collaborative spec review for AI agent workflows. Use when you need team input
  on questions, decisions, or generated specifications. Routes agent questions to
  a shared Q&A interface and publishes specs for collaborative review with comments,
  suggestions, and approval gates. Supports multiple reviewers and attached AI agents.
  Trigger phrases: "ask the team", "submit for review", "get approval", "team review",
  "collaborative review", "spec review".
---

# Specsync — Collaborative Spec Review

When you need team input on questions or want a spec reviewed before proceeding,
use the specsync server's HTTP API. The server runs at the URL in the
`REVIEW_TOOL_URL` environment variable (default: `http://localhost:4000`).

Start the server: `npx @specsync/server`

## When to Use

- You have questions that need team consensus before proceeding
- You've generated a spec/plan and need team review before implementation
- You want multiple people (or other agents) to comment on a document

## Asking Questions (Q&A)

Create a Q&A session:

```bash
curl -s -X POST ${REVIEW_TOOL_URL:-http://localhost:4000}/qa/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Session Title", "questions": [{"id": "q1", "title": "Your question", "options": [{"key": "a", "label": "Option A"}], "type": "single-select"}]}'
```

Response includes `id`, `token`, and `url`. Share the URL with the team.

Poll until complete:

```bash
while true; do
  RESP=$(curl -s "${REVIEW_TOOL_URL:-http://localhost:4000}/qa/sessions/{id}?token={token}")
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  if [ "$STATUS" = "completed" ]; then
    echo "$RESP"
    break
  fi
  sleep 3
done
```

Answers are in the `answers` object of the response.

## Follow-Up Questions (REUSE the existing session)

If you need to ask follow-up questions, ADD them to the same session — do NOT create a new one. The team stays on the same URL.

```bash
curl -s -X POST "${REVIEW_TOOL_URL:-http://localhost:4000}/qa/sessions/{id}/questions?token={token}" \
  -H "Content-Type: application/json" \
  -d '{"questions": [{"id": "followup1", "title": "Follow-up question", "options": [...], "type": "single-select"}]}'
```

Then poll the same session again until all questions are answered. Only create a new session for a completely unrelated topic.

## Submitting Specs for Review

```bash
curl -s -X POST ${REVIEW_TOOL_URL:-http://localhost:4000}/documents \
  -H "Content-Type: application/json" \
  -d '{"title": "Spec Title", "markdown": "# Full markdown content..."}'
```

Response includes `slug`, `accessToken`, and `docUrl`. Share `docUrl` with the team.

## Waiting for Approval

```bash
while true; do
  RESP=$(curl -s "${REVIEW_TOOL_URL:-http://localhost:4000}/documents/{slug}/events/pending?since=0" \
    -H "x-share-token: {accessToken}")
  if echo "$RESP" | grep -q '"document.approved"\|"document.changes_requested"'; then
    echo "$RESP"
    break
  fi
  sleep 3
done
```

## Updating a Spec

```bash
curl -s -X PUT "${REVIEW_TOOL_URL:-http://localhost:4000}/documents/{slug}" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"markdown": "UPDATED CONTENT"}'
```

Same URL stays valid. Previous comments preserved.

## Agent Bridge Participation

```bash
# Reply to a comment
curl -s -X POST "${REVIEW_TOOL_URL:-http://localhost:4000}/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"type": "comment.reply", "markId": "MARK_ID", "by": "ai:agent", "text": "Your reply"}'

# Add a new comment
curl -s -X POST "${REVIEW_TOOL_URL:-http://localhost:4000}/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"type": "comment.add", "by": "ai:agent", "quote": "quoted text", "text": "Your comment"}'
```

## Rules

- Use `ai:` prefix in `by` fields (e.g., `ai:agent-name`)
- Never call `document.approve` — only humans approve
- Poll every 3-5 seconds
- If server unreachable, tell user to run: `npx @specsync/server`
- Always include a `recommendation` field in questions
