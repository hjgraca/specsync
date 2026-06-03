# Using Specsync with Copilot CLI

## Prerequisites

- Specsync server running (`npx @specsync/server` or Docker)
- GitHub Copilot CLI installed

## Install

```bash
npx skills add hjgraca/specsync
```

This installs the specsync skill files into `.agents/skills/specsync/`. Copilot CLI uses the Agent Skills standard (`.agents/skills/`). Then tell your agent to run `/specsync-setup` to configure the server URL.

## Usage

### Ask the team questions

Tell Copilot:

> "Ask the team what rate limiting strategy we should use"

Copilot will:
1. Create a Q&A session with structured questions and recommendations
2. Print the URL for your team
3. Poll until answers arrive
4. Continue working with the answers

### Submit a spec for review

Tell Copilot:

> "Submit this spec for team review"

Copilot will:
1. Publish the spec to specsync
2. Print the review URL and a join code for your team
3. Wait for team approval
4. Continue or revise based on feedback

## Configuration

```bash
export REVIEW_TOOL_URL=http://localhost:4000
```

## Joining a review

When you submit a document for review, the agent prints a URL **and a 6-character join code**. Share both. Each reviewer opens the link, enters their name and the code once (the browser remembers them), and starts commenting. Q&A sessions do not need a code — just the link. See [How access works](../../README.md#how-access-works).

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Start the server: `npx @specsync/server` |
| Skill not triggering | Say "ask the team" or "submit for review" explicitly |
| Wrong server URL | Set `REVIEW_TOOL_URL` environment variable |
| Reviewer stuck on the join screen | Give them the 6-character join code the agent printed, not just the URL |
