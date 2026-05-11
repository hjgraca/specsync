# Contributing to Specsync

Thank you for your interest in contributing to Specsync! This guide will help you get started.

## Development Setup

**Prerequisites:** Node.js >= 20.0.0

```bash
# Clone your fork
git clone https://github.com/<your-username>/specsync.git
cd specsync

# Install dependencies
npm install

# Start the dev server (runs both the Express API and Vite frontend)
npm run dev
```

The dev server uses `concurrently` to run the backend (tsx watch) and frontend (Vite) together. The API starts on `http://localhost:3000` and the Vite dev server proxies to it.

## Running Tests

```bash
# Unit tests (Vitest)
npm test

# Unit tests with coverage
npm run test:coverage

# End-to-end tests (Playwright)
npm run test:e2e
```

Make sure all tests pass before submitting a PR.

## Project Structure

```
src/
  server/       Express API, WebSocket handling, database, auth
  client/       React frontend (Vite)
  shared/       Types and utilities shared between server and client
  cli.ts        CLI entry point (specsync start, install, create, attach-agent)
  installer.ts  Agent skill installer
skills/
  universal/    Template skill — copy this to create a new agent skill
  claude/       Claude Code skill
  copilot/      GitHub Copilot skill
  cursor/       Cursor skill
  kiro/         Kiro skill
  pi/           Pi skill
tests/
  server/       API and server unit tests
  client/       Client unit tests
  e2e/          Playwright end-to-end tests
```

## Code Style

- **TypeScript** throughout. No `any` unless absolutely unavoidable.
- **No comments** unless they explain *why*, not *what*. The code should be self-documenting.
- Follow the patterns you see in existing files. If you're unsure, look at a nearby file for guidance.
- Keep files focused. Prefer small, single-purpose modules.

## Adding a New Agent Skill

1. Copy the `skills/universal/` directory to `skills/<your-agent>/`.
2. Adapt `SKILL.md` for your agent's syntax and conventions.
3. Test the skill by running `specsync install <your-agent>` against a local server.
4. Add your agent to the skills list in the README if applicable.

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`.
2. **Branch naming:** Use descriptive names like `feat/my-feature`, `fix/issue-42`, `docs/update-readme`.
3. **Write tests** for new functionality. Update existing tests if behavior changes.
4. **Run all tests** (`npm test` and `npm run test:e2e`) and ensure they pass.
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
