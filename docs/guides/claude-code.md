# Using Specsync with Claude Code

## Prerequisites

- Specsync server running (`npx @specsync/server` or Docker)
- Claude Code installed

## Install

```bash
npx @specsync/skill
```

This creates `.claude/skills/specsync/SKILL.md` in your project.

## Usage

### Ask the team questions

Tell Claude:

> "Ask the team what database we should use for this feature"

Claude will:
1. Create a Q&A session with structured questions and its recommendation
2. Print the URL for your team to answer
3. Poll until all answers are submitted
4. Continue working with the answers

### Submit a spec for review

Tell Claude:

> "Submit this plan for team review"

Claude will:
1. Publish the spec/plan to specsync
2. Print the review URL for your team
3. Poll for approval or change requests
4. If approved: continue with implementation
5. If changes requested: read comments, revise, resubmit

## What it looks like

**In the terminal:**
```
I've created a Q&A session for the team. Answer at:
http://localhost:4000/qa/abc123?token=xyz

Waiting for answers...
```

**In the browser:** Your team sees the questions rendered as interactive forms with the agent's recommendations highlighted.

## Configuration

If your specsync server isn't running on localhost:4000, set the environment variable:

```bash
export REVIEW_TOOL_URL=http://<your-lan-ip>:4000
```

Or add it to your shell profile for persistence.

## How the skill works

The skill uses Claude's `Bash` tool to:
- `curl` the specsync API to create sessions and submit documents
- Run a `while` loop to poll for completion (zero token cost during wait)
- Parse JSON responses with `grep`

The agent generates a random codename (e.g., `ai:claude-swift-falcon`) for presence and comments.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Start the server: `npx @specsync/server` |
| Skill not triggering | Say "ask the team" or "submit for review" explicitly |
| Agent not polling | Check the skill is in `.claude/skills/specsync/SKILL.md` |
| Wrong server URL | Set `REVIEW_TOOL_URL` environment variable |
