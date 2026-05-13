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
