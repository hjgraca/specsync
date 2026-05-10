# Using Specsync with Kiro

## Prerequisites

- Specsync server running (`npx specsync start` or Docker)
- Kiro installed

## Install

```bash
npx specsync install --to kiro
```

This creates `.kiro/skills/specsync/SKILL.md` in your project.

## Usage

### Ask the team questions

Tell Kiro:

> "Ask the team what framework we should use"

Kiro will:
1. Create a Q&A session with structured questions
2. Print the URL for your team
3. Poll until answers arrive
4. Continue with the team's decisions

### Submit a spec for review

Tell Kiro:

> "Submit this design for team review"

Kiro will:
1. Publish the spec to specsync
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
| "Connection refused" | Start the server: `npx specsync start` |
| Skill not triggering | Say "ask the team" or "submit for review" explicitly |
| Wrong server URL | Set `REVIEW_TOOL_URL` environment variable |
