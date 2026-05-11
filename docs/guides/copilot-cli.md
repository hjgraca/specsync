# Using Specsync with Copilot CLI

## Prerequisites

- Specsync server running (`npx @specsync/server` or Docker)
- GitHub Copilot CLI installed

## Install

```bash
npx @specsync/skill
```

This creates `.agents/skills/specsync/SKILL.md` in your project. Copilot CLI uses the Agent Skills standard (`.agents/skills/`).

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
2. Print the review URL
3. Wait for team approval
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
