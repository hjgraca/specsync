---
title: "refactor: Restructure into pnpm monorepo with three publishable packages"
type: refactor
status: active
date: 2026-05-11
---

# Restructure into pnpm monorepo with three publishable packages

## Summary

Restructure the flat single-package `specsync` repo into a pnpm workspace monorepo with three independently publishable packages (`@specsync/server`, `@specsync/skill`, `@specsync/sdk`), a GitHub Actions release workflow (OIDC + provenance), and Docker image publishing to GHCR. The three packages ship lockstep at `0.1.0`.

---

## Problem Frame

The repo currently ships as a single npm package (`specsync`) bundling server, CLI, installer, and frontend. This makes it impossible for users to install just the skill installer or just the server, forces unnecessary dependencies on consumers of the programmatic SDK, and conflates separate concerns under one package name. The target is three scoped packages under `@specsync` — each installable independently via `npx`.

---

## Requirements

- R1. Users can run `npx @specsync/server` to start the server (no subcommand)
- R2. Users can run `npx @specsync/skill` to get an interactive TUI that installs skill files
- R3. Developers can `npm install @specsync/sdk` to get a typed client, bridge, and tool functions
- R4. All three packages publish at version `0.1.0` via GitHub Release trigger
- R5. npm publish uses OIDC + provenance (no long-lived NPM_TOKEN)
- R6. Docker image publishes to `ghcr.io/hjgraca/specsync` on the same release
- R7. Tests must pass before publish
- R8. `@specsync/server` bundles compiled frontend assets
- R9. `@specsync/skill` writes `.specsync.json` with user-chosen server URL
- R10. Minimum Node.js version: 22

---

## Scope Boundaries

- This plan restructures existing code — no new features beyond the TUI installer
- The server API, routes, and frontend are unchanged (moved, not rewritten)
- Existing tests are preserved and adapted to the new structure
- The `create` and `attach-agent` CLI commands are dropped from the server package (server starts immediately)

### Deferred to Follow-Up Work

- `@specsync/sdk` auto-start server capability (the `server-discovery.ts` logic) — not needed when SDK ships alone
- SSO/OAuth auth modes
- Claude Code plugin/marketplace publishing

---

## Context & Research

### Relevant Code and Patterns

- `src/server/` → moves to `packages/server/src/`
- `src/client/` → moves to `packages/server/src/client/`
- `src/shared/types.ts` → moves to `packages/sdk/src/types.ts` (SDK owns types)
- `src/shared/codenames.ts` → moves to `packages/server/src/shared/codenames.ts` (server-internal)
- `src/installer.ts` → replaced by new TUI in `packages/skill/src/`
- `src/cli.ts` → replaced by minimal entry point in `packages/server/src/cli.ts`
- `skills/` → moves to `packages/skill/skills/`
- `tests/server/` → moves to `packages/server/tests/`
- `tests/e2e/` → stays at root level (tests the whole system)
- SDK client/bridge/tools extracted from harness repo `packages/specsync-skill/src/`

### Existing Patterns

- Vite multi-entry build (qa + review HTML entries)
- Express app factory pattern (`createApp()`)
- TypeScript ESM with `"type": "module"`
- vitest for unit tests, playwright for e2e

---

## Key Technical Decisions

- **Types owned by SDK**: `@specsync/sdk` is the canonical source of shared types. Server imports them as a `devDependency` for type-checking but doesn't create a runtime dependency (types are erased at build time)
- **Server bundles frontend**: Vite builds client assets into `packages/server/dist/client/` at build time. Published package includes these static files
- **TUI library**: `@clack/prompts` for the interactive installer — lightweight, beautiful defaults
- **pnpm over npm**: Workspace protocol for local dev, lockstep publish via `pnpm -r publish`
- **No workspace: protocol in published packages**: SDK has no runtime deps on server or skill. Server uses SDK types as devDependency only
- **Drop `create` and `attach-agent` commands**: Server starts immediately on `npx @specsync/server`. These commands become SDK examples/docs
- **SDK excludes server-discovery and auto-start**: The SDK is a pure client library. Finding/starting the server is the consumer's responsibility

---

## Open Questions

### Resolved During Planning

- **Where does `codenames.ts` go?** → Server package (it generates participant names, server-only concern)
- **Should SDK depend on server?** → No. SDK is a leaf package with zero internal dependencies. Types are self-contained.
- **E2E tests location?** → Root-level `tests/e2e/` since they test server + skill integration

### Deferred to Implementation

- Exact clack prompt wording and flow (will iterate during implementation)
- Whether the existing playwright e2e tests need adjustment for the new server entry point

---

## Output Structure

```
specsync/
├── packages/
│   ├── server/
│   │   ├── package.json          (@specsync/server)
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   │   ├── cli.ts            (entry point — starts server)
│   │   │   ├── server/
│   │   │   │   ├── app.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── db.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── url-validator.ts
│   │   │   │   └── routes/
│   │   │   ├── client/           (React frontend — QA + Review UIs)
│   │   │   └── shared/
│   │   │       └── codenames.ts
│   │   └── tests/
│   ├── skill/
│   │   ├── package.json          (@specsync/skill)
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   └── index.ts          (TUI entry point)
│   │   └── skills/               (static skill files per agent)
│   │       ├── claude/
│   │       ├── copilot/
│   │       ├── cursor/
│   │       ├── kiro/
│   │       ├── pi/
│   │       └── universal/
│   └── sdk/
│       ├── package.json          (@specsync/sdk)
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          (barrel export)
│           ├── types.ts          (canonical shared types)
│           ├── client.ts         (ReviewToolClient)
│           ├── bridge.ts         (participateInReview)
│           └── tools/
│               ├── ask.ts
│               ├── submit-for-review.ts
│               └── wait-for-approval.ts
├── tests/
│   └── e2e/
│       └── flows.test.ts
├── package.json                  (root — private, workspace scripts)
├── pnpm-workspace.yaml
├── tsconfig.json                 (root — references)
├── Dockerfile
├── .github/workflows/
│   ├── test.yml
│   └── release.yml
├── README.md
├── CHANGELOG.md
├── LICENSE
└── docs/
```

---

## Implementation Units

- U1. **Scaffold monorepo root**

**Goal:** Set up pnpm workspace infrastructure and root configs

**Requirements:** R10

**Dependencies:** None

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (make private, add workspace scripts, switch to pnpm, update engines to >=22)
- Create: `tsconfig.json` (root references config)
- Delete: `package-lock.json`
- Modify: `.gitignore` (add pnpm-lock.yaml exclusions if needed, node_modules patterns)

**Approach:**
- Root `package.json` becomes `private: true` with workspace scripts (`build`, `test`, `dev`, `clean`)
- Root `tsconfig.json` uses project references pointing to each package's tsconfig
- `pnpm-workspace.yaml` declares `packages: ["packages/*"]`
- Remove `npm` references, add `"packageManager": "pnpm@10.x.x"`

**Patterns to follow:**
- Harness repo's root package.json structure

**Test scenarios:**
- Happy path: `pnpm install` resolves all workspace packages without errors
- Happy path: `pnpm -r build` builds all packages in dependency order

**Verification:**
- `pnpm install` succeeds with clean lockfile generation
- All three packages visible via `pnpm ls -r`

---

- U2. **Create `@specsync/sdk` package**

**Goal:** Extract types, client, bridge, and tool functions into a standalone SDK package

**Requirements:** R3

**Dependencies:** U1

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/sdk/src/types.ts` (from `src/shared/types.ts`)
- Create: `packages/sdk/src/client.ts` (from harness `specsync-skill/src/client.ts`)
- Create: `packages/sdk/src/bridge.ts` (from harness `specsync-skill/src/bridge.ts`)
- Create: `packages/sdk/src/tools/ask.ts` (from harness `specsync-skill/src/tools/ask.ts`)
- Create: `packages/sdk/src/tools/submit-for-review.ts` (from harness)
- Create: `packages/sdk/src/tools/wait-for-approval.ts` (from harness)
- Create: `packages/sdk/src/index.ts` (barrel exports)
- Create: `packages/sdk/README.md`

**Approach:**
- Copy types verbatim from current `src/shared/types.ts`
- Port client, bridge, tools from harness repo — remove `@specsync/cli` imports, replace with relative `./types.ts` imports
- Remove `server-discovery.ts` dependency from tools — SDK consumer provides the base URL via constructor
- `ask()` and `submitForReview()` accept `baseUrl` parameter or use env var directly (no auto-start)
- Barrel export: `export { ReviewToolClient, participateInReview, ask, submitForReview, waitForApproval }` plus all types
- Package exports both ESM and types: `"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }`

**Patterns to follow:**
- Existing `ReviewToolClient` class API from harness repo

**Test scenarios:**
- Happy path: `ReviewToolClient` can be instantiated with a custom URL
- Happy path: all public types are importable from the package
- Edge case: client methods throw meaningful errors on non-200 responses
- Happy path: package builds cleanly producing `.js` and `.d.ts` files

**Verification:**
- `pnpm build` in `packages/sdk` produces `dist/` with `.js` and `.d.ts` for all modules
- TypeScript consumers can import types and classes without errors

---

- U3. **Create `@specsync/server` package**

**Goal:** Move server, frontend, and CLI entry point into a standalone server package

**Requirements:** R1, R8

**Dependencies:** U1, U2

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/tsconfig.build.json`
- Create: `packages/server/vite.config.ts`
- Move: `src/server/` → `packages/server/src/server/`
- Move: `src/client/` → `packages/server/src/client/`
- Move: `src/shared/codenames.ts` → `packages/server/src/shared/codenames.ts`
- Create: `packages/server/src/cli.ts` (new minimal entry — just starts server)
- Move: `tests/server/` → `packages/server/tests/`
- Create: `packages/server/README.md` (comprehensive — the primary npm README)

**Approach:**
- `package.json` has `"bin": { "specsync-server": "./dist/cli.js" }` and `"name": "@specsync/server"`
- CLI entry: parse `--port` and `--host` flags, start server immediately (no subcommands)
- `vite.config.ts` adapts input paths for the new location (`packages/server/src/client/qa/index.html`, etc.)
- Server `app.ts` adjusts client dist path resolution (relative to new layout)
- `@specsync/sdk` as `devDependency` for type imports (erased at runtime)
- Server's type imports (`src/shared/types.ts`) change to import from `@specsync/sdk`
- `files` in package.json: `["dist/", "README.md", "LICENSE"]`
- Build script: `tsc -p tsconfig.build.json && vite build` (same pattern as today)
- `prepublishOnly: pnpm build`

**Patterns to follow:**
- Current `createApp()` factory pattern stays unchanged
- Current Vite multi-entry build config

**Test scenarios:**
- Happy path: `node dist/cli.js` starts server on default port 4000
- Happy path: `node dist/cli.js --port 8080` starts on custom port
- Happy path: built assets in `dist/client/` are served by the express static middleware
- Edge case: server exits cleanly on SIGINT/SIGTERM
- Integration: existing test suite passes against the server package

**Verification:**
- `pnpm build` produces `dist/cli.js`, `dist/server/`, and `dist/client/`
- `node packages/server/dist/cli.js` starts and responds at `/health`
- All existing server tests pass from their new location

---

- U4. **Create `@specsync/skill` package (TUI installer)**

**Goal:** Build the interactive TUI that detects agents, asks for server URL, and installs skill files

**Requirements:** R2, R9

**Dependencies:** U1

**Files:**
- Create: `packages/skill/package.json`
- Create: `packages/skill/tsconfig.json`
- Create: `packages/skill/src/index.ts` (TUI entry point)
- Move: `skills/` → `packages/skill/skills/`
- Create: `packages/skill/README.md`

**Approach:**
- Entry point is the `bin` — `"bin": { "specsync-skill": "./dist/index.js" }`
- Uses `@clack/prompts` for: intro, multiselect (agents), text (server URL), outro
- Agent detection: check for `.claude/`, `.cursor/`, `.agents/`, `.kiro/`, `.pi/` dirs in cwd
- Pre-select detected agents in the multiselect
- After selection: copy matching `skills/<agent>/SKILL.md` to target directories
- Write `.specsync.json` with `{ "serverUrl": "<user input>" }` to cwd
- Dependencies: `@clack/prompts` only (zero heavyweight deps)
- No runtime dependency on `@specsync/sdk` or `@specsync/server`
- `files` in package.json: `["dist/", "skills/", "README.md", "LICENSE"]` (skills dir must be included — it contains the static files to copy)

**Patterns to follow:**
- Current `TARGETS` mapping in `installer.ts` (agent → directory → skill source)
- Existing skill file content stays unchanged

**Test scenarios:**
- Happy path: selecting "claude" copies `skills/claude/SKILL.md` to `.claude/skills/specsync/SKILL.md`
- Happy path: selecting multiple agents installs all correctly
- Happy path: `.specsync.json` is written with the provided URL
- Edge case: default URL is `http://localhost:4000` when user accepts default
- Edge case: running in a directory with no detected agents still shows the full list (none pre-selected)

**Verification:**
- `pnpm build` produces `dist/index.js`
- Running the built CLI shows the clack TUI prompts
- Skill files are correctly copied to target directories

---

- U5. **Update Dockerfile for monorepo**

**Goal:** Adapt the Docker build to work with the pnpm monorepo structure, building only the server

**Requirements:** R6

**Dependencies:** U3

**Files:**
- Modify: `Dockerfile`
- Modify: `.dockerignore`

**Approach:**
- Multi-stage build: builder installs all deps, builds SDK + server (server needs SDK types)
- Final stage: copies only `packages/server/dist/` and production deps
- Uses `pnpm deploy` or selective copy to get minimal production node_modules
- Base: `node:22-alpine`
- Keep non-root user pattern
- CMD: `["node", "packages/server/dist/cli.js"]`

**Patterns to follow:**
- Current Dockerfile multi-stage pattern with non-root user

**Test scenarios:**
- Happy path: `docker build .` completes without errors
- Happy path: container starts and `/health` returns 200
- Edge case: container runs as non-root user

**Verification:**
- `docker build -t specsync .` succeeds
- `docker run -p 4000:4000 specsync` serves the health endpoint

---

- U6. **Create release workflow**

**Goal:** GitHub Release triggers test → parallel npm publish (OIDC) + Docker push

**Requirements:** R4, R5, R6, R7

**Dependencies:** U1, U2, U3, U4, U5

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `.github/workflows/test.yml` (adapt for pnpm monorepo)
- Delete: `.github/workflows/docker.yml` (merged into release.yml)

**Approach:**
- Trigger: `on: release: types: [published]`
- Job 1 (`test`): install pnpm, run `pnpm -r test`, run e2e tests
- Job 2 (`publish-npm`): needs `test`. Install, build all, publish each package with `--provenance`. Permissions: `id-token: write`, `contents: read`
- Job 3 (`publish-docker`): needs `test`. Build and push to `ghcr.io/hjgraca/specsync`. Tags: `latest` + release version tag. Permissions: `packages: write`
- Version extraction: parse from release tag (e.g., `v0.1.0` → `0.1.0`), set in all package.json files before publish
- `test.yml` updated: switch from `npm` to `pnpm`, adjust paths

**Patterns to follow:**
- Current `docker.yml` GHCR login pattern
- Current `test.yml` structure (unit + e2e jobs)

**Test scenarios:**
- Happy path: creating a GitHub Release with tag `v0.1.0` triggers the workflow
- Happy path: test job failure blocks publish jobs
- Happy path: all three packages are published to npm with provenance
- Happy path: Docker image is pushed with version tag and `latest`

**Verification:**
- Workflow YAML validates (act or manual review)
- Permissions are correct for OIDC provenance
- Version substitution logic handles `v0.1.0` → `0.1.0` extraction

---

- U7. **Clean up root and finalize**

**Goal:** Remove obsolete files, update root README, ensure everything wires together

**Requirements:** R1, R2, R3

**Dependencies:** U2, U3, U4, U5, U6

**Files:**
- Delete: `src/` (all source moved to packages)
- Delete: `skills/` (moved to packages/skill)
- Delete: `tsconfig.build.json` (replaced by per-package configs)
- Delete: `vite.config.ts` (moved to packages/server)
- Delete: `playwright.config.ts` (moves to root `tests/` or stays at root referencing new paths)
- Modify: `README.md` (update for three-package structure, install instructions)
- Move: `tests/e2e/` → root `tests/e2e/` (stays at root, update imports)
- Modify: `.gitignore` (clean up, add `dist/` patterns for packages)

**Approach:**
- Root README becomes the "landing page" — explains the three packages, links to each package's README
- Playwright config stays at root, adjusts server start command for e2e
- Remove `screenshots/` or keep for README (keep — referenced by README)
- Ensure `pnpm build` from root builds all packages in correct order
- Verify `pnpm test` runs all package tests + root e2e

**Patterns to follow:**
- Existing README structure (badges, screenshots, quick start)

**Test scenarios:**
- Happy path: `pnpm install && pnpm build && pnpm test` succeeds from clean clone
- Happy path: `pnpm -r publish --dry-run` shows all three packages ready to publish
- Edge case: no residual imports reference old `src/shared/types.ts` paths

**Verification:**
- Clean clone → install → build → test passes end-to-end
- No broken imports or missing modules
- `pnpm -r publish --dry-run` lists all three packages at 0.1.0

---

## System-Wide Impact

- **Interaction graph:** Server imports SDK types at build time (devDependency). Skill has no runtime dependency on either. SDK is a leaf package.
- **Error propagation:** No change to runtime error behavior — this is a restructure, not a rewrite
- **API surface parity:** Server API unchanged. SDK exposes the same client/bridge/tools interface that existed in the harness repo
- **Unchanged invariants:** All server endpoints, WebSocket behavior, frontend UIs, and test behavior remain identical

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Import paths break silently after move | Run full test suite after each unit; TypeScript compiler catches missing modules |
| Vite build paths wrong for new layout | Verified by building and checking `dist/client/` contains HTML + assets |
| OIDC provenance requires npm org setup | Create `@specsync` org before first release; test with `--dry-run` |
| `better-sqlite3` prebuilt binaries fail in CI | Already works in current CI (Ubuntu + Node 22); Docker uses alpine which also works |
| pnpm workspace version sync | Use `pnpm -r exec -- pnpm version <ver>` in release workflow before publish |

---

## Sources & References

- Current repo: `hjgraca/specsync` (flat structure being restructured)
- Harness repo SDK code: `packages/specsync-skill/src/` (client, bridge, tools to extract)
- npm OIDC provenance docs: npm documentation on publish with provenance
- pnpm workspaces docs: pnpm workspace protocol and publish workflow
