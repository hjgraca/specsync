# Using Specsync with Cursor

## Prerequisites

- Specsync server running (`npx @specsync/server` or Docker)
- Cursor installed

## Install

```bash
npx skills add hjgraca/specsync
```

This installs the specsync skill files into your agent's skill directory. Then tell your agent to run `/specsync-setup` to configure the server URL.

Alternatively, you can add it as a Cursor rule by copying the content of `skills/specsync/SKILL.md` to `.cursor/rules/specsync.mdc`.

## Usage

### Ask the team questions

Tell Cursor:

> "Ask the team what approach we should take for authentication"

Cursor will:
1. Create a Q&A session with structured questions
2. Print the URL for your team
3. Poll until answers arrive
4. Continue with the team's decisions

### Submit a spec for review

Tell Cursor:

> "Submit this implementation plan for team review"

Cursor will:
1. Publish the plan to specsync
2. Print the review URL
3. Wait for approval or change requests
4. Continue or revise based on feedback

## Configuration

```bash
export REVIEW_TOOL_URL=http://localhost:4000
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Start the server: `npx @specsync/server` |
| Skill not triggering | Say "ask the team" or "submit for review" explicitly |
| Wrong server URL | Set `REVIEW_TOOL_URL` environment variable |
