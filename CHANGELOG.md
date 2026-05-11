# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## 0.1.0 (2026-05-11)

### Features

- Q&A UI: structured questions with recommendations, multi-select, free-text
- Spec Review UI: collaborative markdown review with inline comments
- Agent bridge: any agent can attach and participate via HTTP
- Per-agent skills: Claude Code, Copilot, Kiro, Cursor, Pi
- Token-based auth on all endpoints
- Revision tracking with diff viewer
- Comment highlighting with bidirectional navigation
- Presence indicators (auto-codenames)
- QR code sharing
- Docker support
- AWS App Runner deployment via CDK
- CLI: specsync start, install, create, attach-agent

### Security

- SSRF protection on callback URLs
- Timing-safe secret comparison
- Content Security Policy headers
- CORS configuration
- Rate limiting
- Input validation with length limits
