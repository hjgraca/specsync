# Using Specsync with Kiro CLI

## Prerequisites

- Specsync server running (`npx @specsync/server` or Docker)
- Kiro CLI installed

## Install

```bash
npx @specsync/skill
```

This creates `.kiro/skills/specsync/SKILL.md` in your project. Both Kiro IDE and Kiro CLI use the same skill location.

## Usage

Same as [Kiro IDE](kiro.md) — the skill works identically in both environments.

### Ask the team questions

```
kiro> Ask the team what database we should use
```

### Submit a spec for review

```
kiro> Submit this plan for team review
```

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
