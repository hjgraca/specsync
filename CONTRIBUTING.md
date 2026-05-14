# Contributing to Specsync

Thank you for your interest in contributing to Specsync! This guide will help you get started.

## Development Setup

**Prerequisites:** Node.js >= 22.0.0, pnpm >= 10

```bash
# Clone your fork
git clone https://github.com/<your-username>/specsync.git
cd specsync

# Install dependencies
pnpm install

# Start the dev server (runs both the Express API and Vite frontend)
pnpm dev
```

The dev server uses `concurrently` to run the backend (tsx watch) and frontend (Vite) together. The API starts on `http://localhost:4000` and the Vite dev server proxies to it.

## Running Tests

```bash
# Unit tests (Vitest)
pnpm test

# End-to-end tests (Playwright)
npx playwright test

# Build all packages
pnpm build
```

Make sure all tests pass before submitting a PR.

## Project Structure

```
packages/
  server/       @specsync/server — Express API, WebSocket, database, React frontend
  sdk/          @specsync/sdk — TypeScript client, bridge, and tool functions
skills/
  specsync/     Main skill — Q&A and spec review (installed via npx skills add)
  specsync-setup/  Setup skill — creates .specsync.json
tests/
  e2e/          Playwright end-to-end tests
```

## Code Style

- **TypeScript** throughout. No `any` unless absolutely unavoidable.
- **No comments** unless they explain *why*, not *what*. The code should be self-documenting.
- Follow the patterns you see in existing files. If you're unsure, look at a nearby file for guidance.
- Keep files focused. Prefer small, single-purpose modules.

## Editing the Skill

The skill files live in `skills/specsync/SKILL.md` and `skills/specsync-setup/SKILL.md`. There is a single universal skill that works across all agents — no per-agent variants needed. The skill is installed via `npx skills add hjgraca/specsync` which handles placing it in the right directory for each agent.

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`.
2. **Branch naming:** Use descriptive names like `feat/my-feature`, `fix/issue-42`, `docs/update-readme`.
3. **Write tests** for new functionality. Update existing tests if behavior changes.
4. **Run all tests** (`pnpm test`) and ensure they pass.
5. **Open a PR** against `main` with a clear description of what and why.
6. A maintainer will review your PR. Address any feedback, then it gets merged.

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for new agent type
fix: prevent crash when options array is empty
docs: update setup instructions in README
test: add e2e tests for comment highlighting
refactor: extract token validation into middleware
chore: update dependencies
```

- Use the imperative mood ("add support", not "added support").
- Keep the first line under 72 characters.
- Add a body if the change needs more explanation.

## Reporting Issues

Found a bug or have a feature idea? [Open an issue](https://github.com/hjgraca/specsync/issues). Use the provided templates for bug reports and feature requests.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
