# API Reference

All endpoints accept and return JSON. The server runs at `http://localhost:4000` by default.

## Q&A Endpoints

### POST /qa/sessions

Create a new Q&A session.

**Request:**

```json
{
  "title": "Rate Limiting Design Decisions",
  "questions": [
    {
      "id": "q1",
      "title": "Rate limiting scope",
      "context": "Background context for reviewers (optional)",
      "recommendation": "Agent's recommended answer (optional)",
      "options": [
        {
          "key": "per-key",
          "label": "Per API key",
          "description": "Description of this option (optional)",
          "recommended": true
        },
        {
          "key": "per-user",
          "label": "Per user account"
        }
      ],
      "default": "per-key",
      "type": "single-select"
    },
    {
      "id": "q2",
      "title": "Any additional constraints?",
      "type": "free-text"
    }
  ]
}
```

**Question types:**
- `single-select` — radio buttons, one answer
- `multi-select` — checkboxes, multiple answers
- `free-text` — open text field (no `options` needed)

**Response:**

```json
{
  "id": "87266cbb-36db-4367-9403-3bafeffcef22",
  "token": "Gma4hhdI7isUEhT_JocV9UP9ArgBV_WGeS_OFiOvLdY",
  "url": "http://localhost:4000/qa/87266cbb...?token=Gma4hhdI...",
  "title": "Rate Limiting Design Decisions",
  "questions": [...],
  "answers": {},
  "status": "active",
  "createdAt": "2026-05-10T21:52:58.627Z"
}
```

---

### GET /qa/sessions/:id?token=:token

Get session status and answers. Poll this endpoint until `status` is `"completed"`.

**Response (in progress):**

```json
{
  "id": "87266cbb...",
  "title": "Rate Limiting Design Decisions",
  "questions": [...],
  "answers": {
    "q1": "per-key"
  },
  "status": "active"
}
```

**Response (all answered):**

```json
{
  "id": "87266cbb...",
  "title": "Rate Limiting Design Decisions",
  "questions": [...],
  "answers": {
    "q1": "per-key",
    "q2": "Must support burst allowances for premium tier"
  },
  "status": "completed"
}
```

---

### POST /qa/sessions/:id/answer?token=:token

Submit an answer to a question.

**Request:**

```json
{
  "questionId": "q1",
  "answer": "per-key"
}
```

**Response:**

```json
{
  "success": true,
  "questionId": "q1",
  "answer": "per-key",
  "allAnswered": false,
  "status": "active"
}
```

When `allAnswered` is `true`, the session status changes to `"completed"`.

---

## Document Endpoints

### POST /documents

Create a new review document.

**Request:**

```json
{
  "title": "LIN-42: Rate Limiting Plan",
  "markdown": "# Rate Limiting\n\n## Overview\n\nFull markdown content..."
}
```

**Response:**

```json
{
  "slug": "d4972aac",
  "docUrl": "http://localhost:4000/review/d4972aac?token=lZWeGcG-...",
  "bridgeUrl": "http://localhost:4000/documents/d4972aac",
  "accessToken": "lZWeGcG-ZClSCVNRNJKzbijJ9VGsVm9eLaku87KD-M8",
  "ownerSecret": "bBGBRvsVwU32pCDGCkchbzZaoTcgeLYiDXcf8-2N9ls"
}
```

- `docUrl` — share this with your team
- `accessToken` — use in `x-share-token` header for API calls
- `bridgeUrl` — base URL for agent bridge operations

---

### GET /documents/:slug/state

Get the current document state including all marks (comments, suggestions).

**Headers:** `x-share-token: {accessToken}`

**Response:**

```json
{
  "slug": "d4972aac",
  "title": "LIN-42: Rate Limiting Plan",
  "markdown": "# Rate Limiting\n\n...",
  "revision": 1,
  "status": "active",
  "marks": [
    {
      "id": "81dd5c3c...",
      "type": "comment",
      "by": "human:alice",
      "quote": "Redis connection failure → allow request (fail-open)",
      "text": "Are we sure about fail-open?",
      "thread": [],
      "resolved": false,
      "revision": 1,
      "createdAt": "2026-05-10T21:53:52.765Z"
    }
  ]
}
```

---

### PUT /documents/:slug

Update the document content. The URL stays the same. Comments are preserved.

**Headers:** `x-share-token: {accessToken}`

**Request:**

```json
{
  "markdown": "# Updated Rate Limiting Plan\n\n..."
}
```

**Response:**

```json
{
  "success": true,
  "revision": 2
}
```

---

### POST /documents/:slug/ops

Perform an operation on the document (comment, reply, approve, etc.).

**Headers:** `x-share-token: {accessToken}`

#### Add a comment

```json
{
  "type": "comment.add",
  "by": "ai:security-reviewer",
  "quote": "Text from the document being commented on",
  "text": "Your comment text"
}
```

#### Reply to a comment

```json
{
  "type": "comment.reply",
  "markId": "81dd5c3c-...",
  "by": "ai:claude-swift-falcon",
  "text": "Good point. I'll add a local fallback."
}
```

#### Resolve a comment

```json
{
  "type": "comment.resolve",
  "markId": "81dd5c3c-..."
}
```

#### Approve the document (humans only)

```json
{
  "type": "document.approve",
  "by": "human:henri"
}
```

#### Request changes (humans only)

```json
{
  "type": "document.changes_requested",
  "by": "human:henri"
}
```

**Response:**

```json
{
  "success": true,
  "mark": { ... }
}
```

---

### GET /documents/:slug/events/pending?since=:n

Poll for decision events. Returns events since the given index.

**Headers:** `x-share-token: {accessToken}`

**Query params:**
- `since` — event index to start from (use `0` for all)
- `exclude_by` — exclude events by a specific author (e.g., `ai:*`)

**Response:**

```json
[
  {
    "type": "document.approved",
    "by": "human:henri",
    "createdAt": "2026-05-10T22:15:00.000Z"
  }
]
```

Possible event types:
- `document.approved` — document was approved
- `document.changes_requested` — changes were requested
- `comment.add` — new comment added
- `comment.reply` — reply to a comment
- `comment.resolve` — comment resolved

---

## Presence Endpoints

### POST /documents/:slug/presence

Register or heartbeat presence on a document.

**Headers:** `x-share-token: {accessToken}`

**Request:**

```json
{
  "id": "ai:security-reviewer",
  "name": "Security Reviewer",
  "role": "commenter"
}
```

### POST /qa/sessions/:id/presence?token=:token

Register or heartbeat presence on a Q&A session.

**Request:**

```json
{
  "id": "viewer-abc123",
  "name": "swift-falcon"
}
```

---

## Error Responses

All errors return JSON:

```json
{
  "error": "Description of what went wrong",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `NO_TOKEN` — token query param missing
- `INVALID_TOKEN` — token doesn't match the session
- `NOT_FOUND` — session or document doesn't exist
- `RATE_LIMITED` — too many requests (429)
