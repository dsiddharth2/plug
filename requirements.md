# Requirements: Agent Package Type, CI, Badges

## Background

PlugVault CLI currently manages two Claude Code extension types — **skills** (`.claude/skills/`) and **commands** (`.claude/commands/`). Claude Code also supports **agents** (`.claude/agents/`), which are markdown files defining agent behavior for the Agent tool delegation system.

## Requirements

### 1. Agent Package Type (CLI)

Add first-class support for `agent` as a third package type:

- `AGENTS_DIR` constant exported from `constants.js`
- `getClaudeAgentsDir(global)` function in `paths.js`
- `getClaudeDirForType(type, global)` centralized routing helper in `paths.js`
- `plug init` creates `.claude/agents/` directory
- `plug install` routes `type: "agent"` packages to `.claude/agents/`
- `plug update` routes agent-type updates correctly
- `plug remove` deletes agent files (uses stored path)
- `plug list --type agent` filters to agents only
- `plug search --type agent` filters and shows `[agent]` label
- Documentation updated: authoring-guide.md, README.md, root README.md

### 2. Tests

- All 172 existing tests must pass (zero regressions)
- Minimum 12 new test cases covering agent routing
- Test files: paths, install, init, update, search, list, remove

### 3. CI Pipeline

- `.github/workflows/ci.yml` — runs on push to main and PRs to main
- Node.js 18, 20, 22 matrix
- `npm ci` + `npm test` in `plug/` working directory

### 4. README Badges

- CI status badge (GitHub Actions)
- License badge (MIT)
- Node.js version badge (18+)
- npm version badge
- MIT LICENSE file at repo root

## Source

- Roadmap: `roadmap/agents-ci-fleet-plan.md`
- GitHub issue spec: `roadmap/github-issue.md`
