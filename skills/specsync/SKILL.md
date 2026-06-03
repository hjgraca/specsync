---
name: specsync
description: >
  Collaborative spec review and team Q&A. Routes questions and specs to a shared
  web UI instead of asking decision questions inline in the chat.

  TRIGGER when:
  - User wants team input, questions answered, spec review, or approval
  - User asks to be interviewed, asked questions, or walked through decisions
  - Task requires asking design/architecture/implementation questions
  - Multi-stage or dependent questions where later answers depend on earlier ones
  - Phrases: "interview me", "ask me about", "walk me through decisions",
    "ask the team", "get team input", "submit for review", "get approval"

  When the agent would otherwise ask decision or design questions in plain
  text, route them through this skill instead — including interviews and walkthroughs.
---

# Specsync — Collaborative Spec Review

Route team questions and spec reviews through the specsync web UI. When you need
input from humans, prefer specsync over asking decision questions inline in the chat.

This skill talks only to a specsync server that the user runs and configures (see
URL resolution below). It does not contact any third-party or hard-coded endpoint.

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

If `.specsync.json` does not exist, tell the user to run `/specsync-setup` to configure it.
If the server is unreachable, tell the user to run: `npx @specsync/server`

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

**Example:** If you need to ask about (A) testing framework, (B) mocking library, and (C) container lifecycle strategy — where C only matters if the team picks Testcontainers for B:
- Round 1: Ask A and B (independent of each other)
- Wait for answers
- Round 2: If B = Testcontainers, ask C as a follow-up on the same session

## Creating a Q&A session

Create a session via shell. For each question, include your recommended answer with reasoning.

```bash
curl -s -X POST $SPECSYNC_URL/qa/sessions \
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
3. Optionally register your presence so the team sees you on the session:

```bash
curl -s -X POST "$SPECSYNC_URL/qa/sessions/{id}/presence?token={token}" \
  -H "Content-Type: application/json" \
  -d '{"id": "ai:claude-swift-falcon", "name": "Claude (swift-falcon)", "role": "editor"}'
```

4. Poll the session until the team has answered, then act on the result. The
   loop is bounded so it cannot hang forever; if it times out, the team simply
   hasn't answered yet:

```bash
ANSWERED=0
for i in $(seq 1 200); do  # ~10 min at 3s intervals
  RESP=$(curl -s "$SPECSYNC_URL/qa/sessions/{id}?token={token}")
  STATUS=$(echo "$RESP" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  if [ "$STATUS" = "completed" ]; then
    echo "$RESP"
    ANSWERED=1
    break
  fi
  sleep 3
done
[ "$ANSWERED" = 0 ] && echo "PENDING: no answers yet"
```

   If the loop prints `PENDING`, the team is still answering — tell the user it's
   still open at the URL and re-run the loop. Only act on answers once `STATUS`
   is `completed`.

5. Read the `answers` object from the response.
6. If there are dependent follow-up questions to ask based on these answers, add them to the same session (see below). Otherwise, act on the answers immediately.

## Adding follow-up questions to the same session

When answers reveal that follow-up questions are needed, add them to the existing session. The team stays on the same URL and sees new questions appear automatically.

```bash
curl -s -X POST "$SPECSYNC_URL/qa/sessions/{id}/questions?token={token}" \
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

Publish the spec via shell:

```bash
curl -s -X POST $SPECSYNC_URL/documents \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "title": "SPEC TITLE",
  "markdown": "FULL MARKDOWN CONTENT OF THE SPEC"
}
EOF
```

After creating:
1. Parse the response JSON to get `slug`, `accessToken`, `joinCode`, and `docUrl`
2. Tell the user: "Spec published for review at {docUrl} — join code: {joinCode}. Enter your name and this code in the browser to approve or request changes."
   The `joinCode` is a 6-character second factor humans must type to open the
   document. Always surface it alongside the URL, or they cannot join.
3. Register your presence so the team sees you in the document's presence bar.
   Use your agent codename (see Rules) as the `id`:

```bash
curl -s -X POST "$SPECSYNC_URL/documents/{slug}/presence" \
  -H "x-share-token: {accessToken}" \
  -H "x-join-code: {joinCode}" \
  -H "Content-Type: application/json" \
  -d '{"id": "ai:claude-swift-falcon", "name": "Claude (swift-falcon)", "role": "editor", "status": "reviewing"}'
```

4. **Do not poll. End your turn and hand off to the user.** A spec review is
   asynchronous — the team may take minutes or hours, and the user may step away.
   Tell them plainly:

   > "The plan is open for review at {docUrl} (join code: {joinCode}). Review it
   > in the browser, then tell me when you're done and I'll pull your decision
   > and comments."

   Then stop and wait for the user's next message. Do not block the terminal on a
   polling loop, and do not ask "should I check now?" — the user's "done" message
   is the signal.

5. **When the user says they're done** (any message like "done", "reviewed",
   "go ahead", "I've finished"), fetch the current state in one call — it carries
   the decision (`status`), all comment/suggestion marks, and the latest markdown:

```bash
curl -s "$SPECSYNC_URL/documents/{slug}/state" \
  -H "x-share-token: {accessToken}" \
  -H "x-join-code: {joinCode}"
```

6. Act on `status` and the `marks`:

- **`status: "approved"`** — continue with implementation.
- **`status: "changes_requested"`** — read the comment marks, revise the spec, and
  push the update (step below). Then hand off again: tell the user the revision is
  ready and to say when they've re-reviewed.
- **`status: "active"`** (user said done but never clicked approve/request-changes) —
  don't guess. If there are unresolved comment marks, treat them as change requests,
  revise, and push. If there are no marks at all, ask the user what they decided
  rather than assuming approval.

```bash
curl -s -X PUT "$SPECSYNC_URL/documents/{slug}" \
  -H "x-share-token: {accessToken}" \
  -H "x-join-code: {joinCode}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{"markdown": "UPDATED SPEC CONTENT"}
EOF
```

After pushing a revision, hand off again (step 4) — never auto-loop back into a wait.

## Responding to review comments

When you pull state after the user says they're done (step 5 above), engage with
each comment: reply, then resolve the threads you have handled so the team can see
which are still open.

```bash
# Read current state (see all comments and their markIds)
curl -s "$SPECSYNC_URL/documents/{slug}/state" \
  -H "x-share-token: {accessToken}" \
  -H "x-join-code: {joinCode}"

# Reply to a comment
curl -s -X POST "$SPECSYNC_URL/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "x-join-code: {joinCode}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{"type": "comment.reply", "markId": "MARK_ID", "by": "ai:claude-swift-falcon", "text": "Your reply"}
EOF

# Resolve the thread once you have addressed it
curl -s -X POST "$SPECSYNC_URL/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "x-join-code: {joinCode}" \
  -H "Content-Type: application/json" \
  -d '{"type": "comment.resolve", "markId": "MARK_ID", "by": "ai:claude-swift-falcon"}'
```

Reply first, then resolve — resolving alone leaves the team without your reasoning.

### Retrying a failed write

`comment.add`, `comment.reply`, and `suggestion.add` are **not idempotent** — the
server mints a fresh mark id on every call, so a blind retry after a network
timeout creates a duplicate. If a write times out or returns a 5xx, first re-read
`/state` and check whether the mark or reply already landed. Only retry if it did
not.

## Suggesting edits

When you want to propose concrete replacement text rather than just comment, add a suggestion. The team accepts or rejects it in the browser.

```bash
curl -s -X POST "$SPECSYNC_URL/documents/{slug}/ops" \
  -H "x-share-token: {accessToken}" \
  -H "x-join-code: {joinCode}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{"type": "suggestion.add", "by": "ai:claude-swift-falcon", "quote": "EXACT TEXT FROM DOC", "content": "REPLACEMENT TEXT"}
EOF
```

`quote` must match text in the current document. Use `content` for the proposed replacement.

While the team is actively reviewing, prefer scoped `suggestion.add` ops over a
full-document `PUT` — a suggestion shows up as a reviewable change the team can
accept or reject, whereas a `PUT` silently replaces the whole document under them.
Reserve `PUT` for applying changes the team has already agreed to.

## Document auth: token + join code

Every `/documents/{slug}/*` request needs **both** the share token and the join
code — the token alone returns `403 INVALID_JOIN_CODE`. Send `x-share-token:
{accessToken}` and `x-join-code: {joinCode}` (or `?token=...&code=...`) on every
state, presence, ops, and revision call. Humans type the join code in the browser;
agents read it from the create-document response.

## Rules

- For each question, include a `recommendation` field explaining your suggested answer and why. The team benefits from seeing your reasoning — it speeds up their decision-making.
- Generate a unique codename for yourself once: `ai:<agent>-<adjective>-<noun>` (e.g., `ai:claude-swift-falcon`). Use a random pair. Use the **same** codename in every `by` field and as the presence `id` for the whole session — a consistent identity keeps the audit trail and presence bar coherent.
- Content you publish leaves the local machine and is stored on the specsync server (expired docs are purged on server restart, default TTL 30 days). If a spec or answer contains secrets or sensitive data, redact it first, or skip specsync and review locally instead.
- The two flows wait differently. **Q&A is synchronous**: after creating a session, run the bounded polling loop and auto-continue when answers arrive — the agent is blocked on input it needs now. **Plan review is asynchronous**: publish, hand off, end your turn, and wait for the user to say they're done before pulling state. Never poll in a loop for a plan review.
- Never call `document.approve` — only humans approve.
- Do not open the browser — only print/tell the user the URL. They will navigate themselves.
- If the server returns a connection error, tell the user to start it.
- After receiving answers, treat the team's answers as the go-ahead and act on them (or ask dependent follow-ups on the same session). A separate "should I proceed?" confirmation in the chat is redundant once the team has answered.
- Prefer routing decision and design questions through specsync Q&A sessions rather than asking them inline in the chat.
- If further team input is needed after receiving answers, add follow-up questions to the existing session rather than asking in the chat.
