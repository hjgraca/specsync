# Using Specsync with Claude Code

## Prerequisites

- Specsync server running (`npx @specsync/server` or Docker)
- Claude Code installed

## Install

```bash
npx skills add hjgraca/specsync
```

This installs the specsync skill files into `.claude/skills/specsync/`. Then run `/specsync-setup` in Claude Code to configure the server URL.

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
2. Print the review URL **and a join code** for your team
3. Poll for approval or change requests
4. If approved: continue with implementation
5. If changes requested: read comments, revise, resubmit

## What it looks like

**In the terminal (Q&A):**
```
I've created a Q&A session for the team. Answer at:
http://localhost:4000/qa/abc123?token=xyz

Waiting for answers...
```

**In the terminal (review):**
```
Spec published for review at:
http://localhost:4000/review/d4972aac?token=lZWeGcG-...
Join code: a1b2c3

Share the link and the code with your reviewers. Waiting for approval...
```

**In the browser:** Your team opens the link and is prompted once for their
name and the join code (`a1b2c3` above). After that they see the questions or
spec rendered for review, with the agent's recommendations highlighted.

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
- Send the share token and join code on every document request (the skill handles this for you)

The agent generates a random codename (e.g., `ai:claude-swift-falcon`) for its
own presence and comments. Human reviewers, by contrast, type their own name
when they join — there is no auto-generated name for people.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Connection refused" | Start the server: `npx @specsync/server` |
| Skill not triggering | Say "ask the team" or "submit for review" explicitly |
| Agent not polling | Check the skill is in `.claude/skills/specsync/SKILL.md` |
| Wrong server URL | Set `REVIEW_TOOL_URL` environment variable |
| Reviewer stuck on the join screen | Give them the 6-character join code the agent printed, not just the URL |
