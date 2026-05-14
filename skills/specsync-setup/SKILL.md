---
name: specsync-setup
description: >
  Set up specsync for this project. Creates .specsync.json with the server URL
  and verifies the server is reachable. Run this before using the specsync skill.

  TRIGGER THIS SKILL when:
  - The user says "set up specsync", "configure specsync", "specsync setup"
  - The user wants to change the specsync server URL
  - The specsync skill reports that .specsync.json is missing
---

# Specsync Setup

Configure specsync for this project by creating `.specsync.json` with the server URL.

## Steps

1. **Check for existing config.** Read `.specsync.json` in the project root. If it exists, show the current `serverUrl` and ask the user if they want to change it. If they don't, stop here.

2. **Ask the user for the server URL.** Suggest `http://localhost:4000` as the default. If the team has a shared server, they'll provide the URL (e.g., `https://specsync.myteam.com`).

3. **Write `.specsync.json`** to the project root:

```json
{
  "serverUrl": "SERVER_URL_HERE"
}
```

4. **Verify the server is reachable.** Hit the health endpoint:

```bash
curl -s --max-time 5 "SERVER_URL_HERE/health"
```

- If it responds, tell the user setup is complete.
- If it fails, tell the user the config was saved but the server is not reachable. They should start it with `npx @specsync/server` or check the URL.

5. **Tell the user they're ready.** They can now say "ask the team" or "submit for review" and the specsync skill will use the configured server.
