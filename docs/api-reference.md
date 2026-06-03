# API Reference

All endpoints accept and return JSON. The server runs at `http://localhost:4000` by default.

## Authentication at a glance

Specsync has no accounts. Two kinds of resources are protected differently:

| Resource | Required credentials | How to send them |
|----------|---------------------|------------------|
| **Q&A sessions** (`/qa/...`) | Session token | `?token=` query param, or `x-share-token` header |
| **Review documents** (`/documents/...`) | Share token **and** join code | `x-share-token` + `x-join-code` headers, or `?token=&code=` |

The create endpoints (`POST /qa/sessions`, `POST /documents`) need no
credentials — they mint the secrets and return them. Every other endpoint
requires the credentials above.

For documents specifically, a valid share token **without** the matching join
code returns `403 INVALID_JOIN_CODE`. Both are returned by `POST /documents`
(`accessToken` and `joinCode`). Humans type the join code in the browser when
they open the document; agents send it as a header on every request. See
[Document authentication](#document-authentication) for details.

> Documents created before join codes were introduced have an empty code and
> remain accessible with the share token alone, for backward compatibility.

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
  "ownerSecret": "bBGBRvsVwU32pCDGCkchbzZaoTcgeLYiDXcf8-2N9ls",
  "joinCode": "a1b2c3"
}
```

- `docUrl` — share this with your team
- `accessToken` — use in `x-share-token` header for API calls
- `joinCode` — 6-character second factor; required on every document request via
  `x-join-code` header (or `?code=`). Humans type it in the browser to join.
- `bridgeUrl` — base URL for agent bridge operations

### Document authentication

Every `/documents/:slug/*` endpoint requires **both** the share token and the
join code. A valid token without the matching code returns `403
INVALID_JOIN_CODE`. Provide the token via `x-share-token` / `Authorization:
Bearer` / `?token=` and the code via `x-join-code` / `?code=`.

---

### GET /documents/:slug/state

Get the current document state including all marks (comments, suggestions).

**Headers:** `x-share-token: {accessToken}`, `x-join-code: {joinCode}`

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

**Headers:** `x-share-token: {accessToken}`, `x-join-code: {joinCode}`

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

**Headers:** `x-share-token: {accessToken}`, `x-join-code: {joinCode}`

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

**Headers:** `x-share-token: {accessToken}`, `x-join-code: {joinCode}`

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

**Headers:** `x-share-token: {accessToken}`, `x-join-code: {joinCode}`

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
- `NO_TOKEN` — token query param missing (Q&A endpoints)
- `INVALID_TOKEN` — token doesn't match the session (Q&A endpoints)
- `NOT_FOUND` (404) — session or document doesn't exist, or the share token is missing/invalid on a document endpoint
- `INVALID_JOIN_CODE` (403) — the share token was valid but the join code was missing or wrong. Add the `x-join-code` header (or `?code=`) from the create-document response.
- `SLUG_MISMATCH` (403) — the token is valid but belongs to a different document than the one in the URL
- `MISSING_FIELDS` / `VALIDATION_ERROR` (400) — a required field is absent or fails validation (e.g. name too long)
- `RATE_LIMITED` (429) — too many requests
