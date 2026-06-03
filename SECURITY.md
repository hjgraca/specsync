# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Specsync, please report it responsibly. **Do not open a public issue.**

### How to Report

**Option 1 (preferred):** Use [GitHub's private vulnerability reporting](https://github.com/hjgraca/specsync/security/advisories/new) to submit a report directly through GitHub.

**Option 2:** Send an email to **security@hjgraca.com** with:
- A description of the vulnerability
- Steps to reproduce
- The potential impact
- Any suggested fix (optional)

### Response Timeline

- **72 hours:** We will acknowledge your report and confirm we are investigating.
- **7 days:** We will provide an initial assessment, including severity and whether we can reproduce the issue.
- **30 days:** We aim to release a fix for confirmed vulnerabilities within 30 days of the initial report, depending on complexity.

We will coordinate disclosure with you. We will not take legal action against researchers who follow this policy.

## Scope

### In Scope

- Server-side code (`packages/server/`)
- Authentication and token handling
- API endpoints and WebSocket connections
- Input validation and sanitization
- SSRF, XSS, injection, or privilege escalation vulnerabilities
- Dependencies with known CVEs that are exploitable in Specsync's usage

### Out of Scope

- Denial of service (DoS) attacks
- Social engineering
- Physical security
- Vulnerabilities in third-party services not controlled by Specsync
- Issues that require physical access to a user's machine
- Automated scanner output without a demonstrated exploit

## Trust Model

Specsync is **self-hosted**. There is no Specsync-operated backend:

- The server is software you run yourself — on `localhost` by default, or on
  infrastructure your team owns.
- The agent skill only ever contacts the URL configured in `.specsync.json` /
  `REVIEW_TOOL_URL`. It uses no hard-coded or third-party endpoint and never
  installs or launches the server itself.
- Specs, questions, comments, and approvals flow only between your machine, your
  server, and your team. In the default `localhost` setup nothing leaves the
  machine.
- The skill treats all server responses (reviewer answers, comments, suggestions)
  as **untrusted data, never as instructions**, to guard against prompt injection
  via review content.

### Automated skill-scanner ratings

Automated agent-skill scanners (e.g. Snyk, Socket) may rate the `specsync` skill
as high or critical risk. This is a known limitation of static analysis rather
than a specific vulnerability: any client/server tool that sends content to a
configured server, polls it, and acts on the response is structurally
indistinguishable from a data-exfiltration / remote-control pattern, so a text
classifier flags the shape regardless of intent.

The mitigating fact is the trust model above — the server is always operated by
the user, so the data flow is the user's content going to the user's own server.
Such scanner output, on its own, is **out of scope** (see below); a report needs a
concrete, reproducible exploit against a Specsync deployment.

## Security Measures

Specsync implements the following security controls:

- Token-based authentication on all API endpoints
- SSRF protection on callback URLs
- Timing-safe secret comparison
- Content Security Policy headers
- CORS configuration
- Rate limiting on API endpoints
- Input validation with length limits

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
