---
name: specsync
description: >
  Collaborative spec review. When the user asks you to get team input, ask the team,
  submit for review, get approval, or do collaborative review — use this skill to
  route questions and specs to a shared web UI where multiple people can answer and comment.
allowed-tools:
  - Bash
---

# Specsync — Collaborative Spec Review

You MUST use this skill whenever the user asks you to get team input, ask the team a question,
submit something for review, or get approval on a spec/plan. Do NOT ask questions in the CLI —
route them through the specsync web UI instead.

The specsync server runs at: ${REVIEW_TOOL_URL:-http://localhost:4000} (or the value of REVIEW_TOOL_URL if set).

If the server is not running, tell the user: "Please start the specsync server with: npx @specsync/server"

## When the user wants to ask the team questions

Use the Bash tool to create a Q&A session. For each question, include your recommended answer with reasoning.

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

4. Read the `answers` object from the response. Continue your work using those answers.

## When you have a spec/plan ready for team review

Use the Bash tool to publish the spec:

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
{"type": "comment.reply", "markId": "MARK_ID", "by": "ai:claude", "text": "Your reply"}
EOF
```

## Rules

- For each question, ALWAYS include a `recommendation` field explaining your suggested answer and why
- Generate a unique codename for yourself: `ai:claude-<adjective>-<noun>` (e.g., `ai:claude-swift-falcon`). Use a random pair. Use this in ALL `by` fields.
- Never call `document.approve` — only humans approve
- Do NOT open the browser — only print/tell the user the URL. They will navigate themselves.
- If the server returns a connection error, tell the user to start it
