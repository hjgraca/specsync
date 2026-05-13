---
name: specsync
description: >
  Collaborative spec review and team Q&A. Routes all questions and specs to a shared
  web UI — never ask decision questions in the chat.

  TRIGGER THIS SKILL when:
  - The user wants team input, questions answered, spec review, or approval
  - The user asks the agent to interview them, ask them questions, or walk through decisions
  - The task requires the agent to ask the user design/architecture/implementation questions
  - There are multi-stage or dependent questions where later decisions depend on earlier answers
  - The user says "interview me", "ask me about", "walk me through decisions", "resolve
    dependencies one by one", "question by question", "one at a time"
  - Phrases like "ask the team", "get team input", "what does the team think", "submit
    for review", "get approval", "multi-stage questions", or "dependent questions"

  CRITICAL RULE: Any time the agent would otherwise ask decision questions, design
  questions, or gather preferences in plain text — use this skill instead. This includes
  when the user asks to be interviewed, quizzed, or walked through choices.
compatibility: opencode
---

# Specsync — Collaborative Spec Review

Route all team questions and spec reviews through the specsync web UI. Never ask
decision questions in the chat — if you need input from humans, it goes through specsync.

## Server URL Resolution

Before making any API call, resolve the server URL using this priority:

1. **`.specsync.json`** in the project root — read the `serverUrl` field
2. **`REVIEW_TOOL_URL`** environment variable
3. **`http://localhost:4000`** (default fallback)

```bash
SPECSYNC_URL=$(cat .specsync.json 2>/dev/null | grep -o '"serverUrl"\s*:\s*"[^"]*"' | cut -d'"' -f4)
SPECSYNC_URL=${SPECSYNC_URL:-${REVIEW_TOOL_URL:-http://localhost:4000}}
```

Use `$SPECSYNC_URL` as the base URL for all API calls below.

If the server is unreachable, tell the user to either configure `.specsync.json` or run: `npx @specsync/server`

## When to Use

- You have questions that need team consensus before proceeding
- You've generated a spec/plan and need team review before implementation
- You want multiple people (or other agents) to comment on a document
- You have dependent questions where later decisions depend on earlier answers

## Planning questions: independent vs dependent

Before creating a session, think about the question structure:

- **Independent questions** can be answered without knowing the answers to other questions. Ask these upfront in the initial session.
- **Dependent questions** only make sense once you know the answer to an earlier question (e.g., "which container lifecycle?" only matters if the team chose containers in the first place).

The workflow for dependent questions:
1. Ask the independent questions first
2. Poll for answers
3. Based on the actual answers, formulate follow-up questions that are now relevant
4. Add those to the same session (the team stays on the same URL)
5. Poll again

This avoids asking hypothetical questions ("if you pick X, then would you want Y?") which are confusing. Instead, wait for the real answer, then ask the concrete follow-up.

## Asking Questions (Q&A)

Create a Q&A session:

```bash
curl -s -X POST $SPECSYNC_URL/qa/sessions \
  -H "Content-Type: application/json" \
  -d '{"title": "Session Title", "questions": [{"id": "q1", "title": "Your question", "context": "Background for reviewers", "recommendation": "Your recommended answer and WHY", "options": [{"key": "a", "label": "Option A", "recommended": true, "description": "Why this"}], "type": "single-select"}]}'
```

Response includes `id`, `token`, and `url`. Share the URL with the team.

Poll until complete:

```bash
while true; do
  RESP=$(curl -s "$SPECSYNC_URL/qa/sessions/{id}?token={token}")
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  if [ "$STATUS" = "completed" ]; then
    echo "$RESP"
    break
  fi
  sleep 3
done
```

Answers are in the `answers` object of the response. If there are dependent follow-up questions, add them to the same session (see below). Otherwise, act on the answers immediately.

## Follow-Up Questions (REUSE the existing session)

When answers reveal that follow-up questions are needed, add them to the existing session. The team stays on the same URL and sees new questions appear automatically.

```bash
curl -s -X POST "$SPECSYNC_URL/qa/sessions/{id}/questions?token={token}" \
  -H "Content-Type: application/json" \
  -d '{"questions": [{"id": "followup1", "title": "Follow-up question", "context": "Based on team choice of X...", "recommendation": "Your rec and WHY", "options": [...], "type": "single-select"}]}'
```

Then poll the same session again until all questions are answered. Only create a new session for a completely unrelated topic.

## Submitting Specs for Review

```bash
curl -s -X POST $SPECSYNC_URL/documents \
  -H "Content-Type: application/json" \
  -d '{"title": "Spec Title", "markdown": "# Full markdown content..."}'
```

Response includes `slug`, `accessToken`, and `docUrl`. Share `docUrl` with the team.

## Waiting for Approval

```bash
while true; do
  RESP=$(curl -s "$SPECSYNC_URL/documents/{slug}/events/pending?since=0" \
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
curl -s -X PUT "$SPECSYNC_URL/documents/{slug}" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"markdown": "UPDATED CONTENT"}'
```

Same URL stays valid. Previous comments preserved.

## Agent Bridge Participation

```bash
# Reply to a comment
curl -s -X POST "$SPECSYNC_URL/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"type": "comment.reply", "markId": "MARK_ID", "by": "ai:agent", "text": "Your reply"}'

# Add a new comment
curl -s -X POST "$SPECSYNC_URL/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"type": "comment.add", "by": "ai:agent", "quote": "quoted text", "text": "Your comment"}'
```

## Rules

- Use `ai:` prefix in `by` fields (e.g., `ai:agent-name`)
- Never call `document.approve` — only humans approve
- Poll every 3-5 seconds
- If server unreachable, tell user to check `.specsync.json` or run: `npx @specsync/server`
- Always include a `recommendation` field in questions — the team benefits from seeing your reasoning
- After receiving answers, immediately act on them (or ask dependent follow-ups on the same session). The team's answers ARE the go-ahead — do not ask confirmation questions in the chat.
- Never ask decision questions in the chat. ALL questions that need input go through specsync Q&A sessions.
- If further team input is genuinely needed after receiving answers, add follow-up questions to the existing session rather than asking in the chat.
