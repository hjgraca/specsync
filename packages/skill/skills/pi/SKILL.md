---
name: specsync
description: >
  Collaborative spec review and team Q&A. Use this skill whenever the user wants to
  get team input, ask the team questions, submit a spec for review, get approval, or
  do collaborative review. Also use when there are multi-stage or dependent questions
  where later decisions depend on earlier answers. Routes all questions and specs to a
  shared web UI — never ask decision questions in the chat. Trigger on phrases like
  "ask the team", "get team input", "what does the team think", "submit for review",
  "get approval", "multi-stage questions", or "dependent questions".
---

# Specsync — Collaborative Spec Review

Route all team questions and spec reviews through the specsync web UI. Never ask
decision questions in the chat — if you need input from humans, it goes through specsync.

The specsync server runs at: ${REVIEW_TOOL_URL:-http://localhost:4000} (or the value of REVIEW_TOOL_URL if set).

If the server is not running, tell the user: "Please start the specsync server with: npx @specsync/server"

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

## Creating a Q&A session

Use the bash tool to create a session. For each question, include your recommended answer with reasoning.

```bash
curl -s -X POST ${REVIEW_TOOL_URL:-http://localhost:4000}/qa/sessions \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "title": "TITLE_HERE",
  "questions": [
    {
      "id": "q1",
      "title": "YOUR QUESTION HERE",
      "context": "Background context for the reviewers",
      "recommendation": "Your recommended answer and WHY you recommend it",
      "options": [
        {"key": "a", "label": "Option A", "recommended": true, "description": "Why this option"},
        {"key": "b", "label": "Option B", "description": "Why this option"}
      ],
      "default": "a",
      "type": "single-select"
    }
  ]
}
EOF
```

After creating the session:
1. Parse the response JSON to get the session `id`, `token`, and `url`
2. Tell the user: "Q&A session ready at {url} — answer in the browser."
3. IMMEDIATELY run the polling loop below — do NOT wait for the user to confirm:

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

4. Read the `answers` object from the response.
5. If there are dependent follow-up questions to ask based on these answers, add them to the same session (see below). Otherwise, act on the answers immediately.

## Adding follow-up questions to the same session

When answers reveal that follow-up questions are needed, add them to the existing session. The team stays on the same URL and sees new questions appear automatically.

```bash
curl -s -X POST "${REVIEW_TOOL_URL:-http://localhost:4000}/qa/sessions/{id}/questions?token={token}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "questions": [
    {
      "id": "followup1",
      "title": "YOUR FOLLOW-UP QUESTION",
      "context": "Based on the team's choice of X, we now need to decide...",
      "recommendation": "Your recommended answer and WHY",
      "options": [
        {"key": "a", "label": "Option A", "recommended": true, "description": "Why this"},
        {"key": "b", "label": "Option B", "description": "Why this"}
      ],
      "default": "a",
      "type": "single-select"
    }
  ]
}
EOF
```

Then poll the same session URL again (same `id` and `token`) until all questions (including the new ones) are answered.

Only create a new session for a completely unrelated topic.

## When you have a spec/plan ready for team review

Use the bash tool to publish the spec:

```bash
curl -s -X POST ${REVIEW_TOOL_URL:-http://localhost:4000}/documents \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "title": "SPEC TITLE",
  "markdown": "FULL MARKDOWN CONTENT OF THE SPEC"
}
EOF
```

After creating:
1. Parse the response JSON to get `slug`, `accessToken`, and `docUrl`
2. Tell the user: "Spec published for review at {docUrl} — approve or request changes in the browser."
3. IMMEDIATELY run the polling loop below — do NOT wait for the user to confirm:

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

4. Look for an event with `type: "document.approved"` or `type: "document.changes_requested"`.

- If approved: continue with implementation
- If changes requested: read the comments, revise the spec, and update:

```bash
curl -s -X PUT "${REVIEW_TOOL_URL:-http://localhost:4000}/documents/{slug}" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{"markdown": "UPDATED SPEC CONTENT"}
EOF
```

Then poll for approval again.

## Responding to review comments

While waiting for approval, check for new comments and reply:

```bash
# Read current state (see all comments)
curl -s "${REVIEW_TOOL_URL:-http://localhost:4000}/documents/{slug}/state" \
  -H "x-share-token: {accessToken}"

# Reply to a comment
curl -s -X POST "${REVIEW_TOOL_URL:-http://localhost:4000}/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{"type": "comment.reply", "markId": "MARK_ID", "by": "ai:pi", "text": "Your reply"}
EOF
```

## Rules

- For each question, include a `recommendation` field explaining your suggested answer and why. The team benefits from seeing your reasoning — it speeds up their decision-making.
- Generate a unique codename for yourself: `ai:pi-<adjective>-<noun>` (e.g., `ai:pi-bold-river`). Use a random pair. Use this in ALL `by` fields.
- Never call `document.approve` — only humans approve.
- Do NOT open the browser — only print/tell the user the URL. They will navigate themselves.
- If the server returns a connection error, tell the user to start it.
- After receiving answers, immediately act on them (or ask dependent follow-ups on the same session). The team's answers ARE the go-ahead — do not ask "should I proceed?", "want me to do X?", or any other confirmation question in the chat.
- Never ask decision questions in the chat. ALL questions that need input go through specsync Q&A sessions.
- If further team input is genuinely needed after receiving answers, add follow-up questions to the existing session rather than asking in the chat.
