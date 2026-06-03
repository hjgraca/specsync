# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- **Join codes for review documents** — `POST /documents` now returns a 6-character `joinCode`. Reviewers enter their name and this code in the browser to open a document; agents send it as `x-join-code` (or `?code=`) on every document request. A valid share token without the matching code now returns `403 INVALID_JOIN_CODE`. The join code is a second factor so a leaked URL alone cannot grant access.
- **Agent suggestions documented** — the copy-bridge snippet and skill now cover `suggestion.add` (propose replacement text), which the server already supported.

### Changed

- **Human-chosen names replace auto-codenames** — people type their own name when they join a review or Q&A (saved in the browser and reused). Agents still self-name with `ai:<agent>-<adjective>-<noun>`.
- **SDK** (`@specsync/sdk`) — `getDocumentState`, `postOp`, `pollEvents`, `updateDocument`, and the review bridge accept an optional join code.
- **Docs** — corrected the AWS deploy guide (Lightsail Container Service, not App Runner), documented the access model end to end, and added the join code to all examples.

## 0.1.14 (2026-05-13)

## What's Changed

- **Backfilled CHANGELOG.md** with all releases from 0.1.0 through 0.1.13
- **Auto-generate changelog on release** — new `update-changelog` job in the release workflow commits release notes to `CHANGELOG.md` after each release
- **Updated community files** — added OpenCode to bug report agent list, fixed PR template test commands for pnpm, replaced placeholder contact in Code of Conduct, corrected source path in Security policy

## 0.1.13 (2026-05-13)

### Changed

- All skill files now resolve server URL from `.specsync.json` before falling back to `REVIEW_TOOL_URL` env var or `localhost:4000`

## 0.1.12 (2026-05-13)

### Added

- Non-interactive CLI mode for skill installer (`--agent`, `--all` flags)
- Updated README with scripted/agent-friendly setup instructions

## 0.1.11 (2026-05-13)

### Fixed

- Build multi-platform Docker image for amd64 and arm64

## 0.1.10 (2026-05-12)

### Added

- Cloud deployment guides (AWS, GCP, Azure, Fly.io, Railway)
- AWS CDK infrastructure for App Runner deployment

## 0.1.9 (2026-05-12)

### Added

- Copy-paste agent setup instructions in README

## 0.1.8 (2026-05-11)

### Added

- OpenCode agent support
- E2E tests added to release gate

### Fixed

- Use built server for Playwright tests

## 0.1.7 (2026-05-11)

### Changed

- Refined skill instructions across all agents
- Improved dependent question workflow with follow-up support

## 0.1.6 (2026-05-11)

### Fixed

- Express 5 sendFile path resolution
- Client dist path resolution for npx execution

## 0.1.5 (2026-05-11)

### Added

- Skill installer UX improvements (Tab hint for URL, next steps after install)

### Changed

- Replaced better-sqlite3 with libsql (no native compile required)

### Fixed

- Friendly error message when port is already in use

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
