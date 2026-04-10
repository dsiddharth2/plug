# PlugVault CLI — Agent Package Type, CI, Badges

> Add first-class "agent" package type support to the plug CLI, create a GitHub Actions CI pipeline, and add README badges.

---

## Tasks

### Phase 1: Core Agent Infrastructure

#### Task 1.1 — Constants and agent paths
- **Change:** Add `AGENTS_DIR = 'agents'` to `plug/src/constants.js`. In `plug/src/utils/paths.js`, add `getClaudeAgentsDir(global)` following the exact same pattern as `getClaudeCommandsDir`. Add `getClaudeDirForType(type, global)` — a centralized routing helper: `'skill'` → `getClaudeSkillsDir(global)`, `'agent'` → `getClaudeAgentsDir(global)`, default → `getClaudeCommandsDir(global)`.
- **Files:** `plug/src/constants.js`, `plug/src/utils/paths.js`
- **Tier:** standard
- **Done when:** Both functions exported. `getClaudeDirForType('agent', false)` returns path ending in `.claude/agents`. `getClaudeDirForType('skill', false)` returns path ending in `.claude/skills`. Default returns `.claude/commands`.
- **Blockers:** none

#### Task 1.2 — Init command
- **Change:** Import `getClaudeAgentsDir` from paths. Add `agentsDir` to the directory creation loop (the `for` loop around line 29 that iterates `[skillsDir, commandsDir]` — add `agentsDir` to it).
- **Files:** `plug/src/commands/init.js`
- **Tier:** cheap
- **Done when:** Running `plug init` creates `.claude/agents/` directory alongside skills and commands.
- **Blockers:** Task 1.1

#### Task 1.3 — Install command
- **Change:** Import `getClaudeDirForType` from paths (replaces individual dir imports for routing). In the auto-init block (lines ~44-57), also `ensureDir` for the agents directory. Replace the line ~156 ternary (`type === 'skill' ? skillsDir : commandsDir`) with `getClaudeDirForType(type, isGlobal)`. Add a usage message for agents: `"The agent '${pkgName}' is available for delegation"`.
- **Files:** `plug/src/commands/install.js`
- **Tier:** standard
- **Done when:** `plug install` correctly routes `type: "agent"` packages to `.claude/agents/` and shows agent usage hint.
- **Blockers:** Task 1.1

#### VERIFY: Phase 1
- Run `npm test` in `plug/` — all 172 existing tests must pass
- Verify no regressions
- Report test count and any failures

---

### Phase 2: Remaining Commands

#### Task 2.1 — Update command
- **Change:** Import `getClaudeDirForType` from paths, replace the routing ternary with `getClaudeDirForType(type, isGlobal)`. Update the command description string from "skill or command" to "skill, command, or agent".
- **Files:** `plug/src/commands/update.js`
- **Tier:** cheap
- **Done when:** `plug update` routes agent-type updates to `.claude/agents/`. Description mentions agents.
- **Blockers:** Task 1.1

#### Task 2.2 — Remove command
- **Change:** Update the command description string to include "agent" (no routing change needed — remove uses the stored path from installed.json).
- **Files:** `plug/src/commands/remove.js`
- **Tier:** cheap
- **Done when:** Description string mentions agents.
- **Blockers:** none

#### Task 2.3 — List and search commands
- **Change:** In `list.js`, update the `--type` option description to include "agent". In `search.js`, update the `--type` option description to include "agent". In the `printSearchResults` function in `search.js`, add a `chalk.yellow('[agent]')` label case alongside the existing skill/command labels.
- **Files:** `plug/src/commands/list.js`, `plug/src/commands/search.js`
- **Tier:** cheap
- **Done when:** `--type agent` is accepted by both commands. Search results display yellow `[agent]` label for agent-type packages.
- **Blockers:** none

#### VERIFY: Phase 2
- Run `npm test` in `plug/` — all tests must pass
- Verify no regressions from command changes
- Report test count

---

### Phase 3: Tests

#### Task 3.1 — Unit tests for paths and routing
- **Change:** Add test cases to `plug/tests/paths.test.js`:
  1. `getClaudeAgentsDir()` returns correct local path (`.claude/agents`)
  2. `getClaudeAgentsDir(true)` returns correct global path (`~/.claude/agents`)
  3. `getClaudeDirForType('skill', false)` returns `.claude/skills`
  4. `getClaudeDirForType('agent', false)` returns `.claude/agents`
  5. `getClaudeDirForType('command', false)` returns `.claude/commands`
  Follow the existing test patterns in that file (vitest, describe/it/expect).
- **Files:** `plug/tests/paths.test.js`
- **Tier:** standard
- **Done when:** 5 new test cases pass.
- **Blockers:** Phase 1

#### Task 3.2 — Command tests
- **Change:** Add tests across command test files following existing patterns:
  - `plug/tests/install.test.js` — 2 tests: agent-type package routes to `.claude/agents/`, agent usage message displayed
  - `plug/tests/init.test.js` — 1 test: verify `.claude/agents/` is created by init
  - `plug/tests/update.test.js` — 1 test: agent update routes to `.claude/agents/`
  - `plug/tests/search.test.js` — 1 test: `--type agent` filter works
  - `plug/tests/list.test.js` — 1 test: agent appears in list and `--type agent` filter works
  - `plug/tests/remove.test.js` — 1 test: removing agent-type package works
- **Files:** `plug/tests/install.test.js`, `plug/tests/init.test.js`, `plug/tests/update.test.js`, `plug/tests/search.test.js`, `plug/tests/list.test.js`, `plug/tests/remove.test.js`
- **Tier:** standard
- **Done when:** All ~7 new tests pass. Total test count is ~184 (172 existing + 12 new). Zero regressions.
- **Blockers:** Phase 2

#### VERIFY: Phase 3
- Run full `npm test` — report total test count
- Confirm zero regressions on existing 172 tests
- Report any test failures

---

### Phase 4: Documentation

#### Task 4.1 — Authoring guide and plug README
- **Change:** In `plug/docs/authoring-guide.md`: add "agent" row to the package type table, add an agent template/example section, update the meta.json schema docs to include `"type": "agent"`. In `plug/README.md`: mention agents in the intro paragraph, update init description to mention `.claude/agents/`, add `--type agent` to filter examples.
- **Files:** `plug/docs/authoring-guide.md`, `plug/README.md`
- **Tier:** cheap
- **Done when:** Both docs reference agents as a supported package type with correct details.
- **Blockers:** Phase 1

#### Task 4.2 — Root README
- **Change:** In the repo root `README.md`, mention agents in the overview section alongside skills and commands.
- **Files:** `README.md`
- **Tier:** cheap
- **Done when:** Root README mentions agent support.
- **Blockers:** none

#### VERIFY: Phase 4
- Review docs for accuracy — no broken links, no stale references
- Ensure agent type is consistently described across all docs
- Report any issues

---

### Phase 5: CI Pipeline, Badges, and LICENSE

#### Task 5.1 — GitHub Actions CI workflow
- **Change:** Create `.github/workflows/ci.yml` with this configuration:
  - Name: CI
  - Triggers: push to main, pull_request to main
  - Job: test — runs on ubuntu-latest
  - Strategy: matrix with node-version [18, 20, 22]
  - Steps: checkout, setup-node, `npm ci` (working-directory: plug), `npm test` (working-directory: plug)
- **Files:** `.github/workflows/ci.yml` (create new)
- **Tier:** standard
- **Done when:** Valid `.github/workflows/ci.yml` exists. YAML is syntactically correct.
- **Blockers:** none

#### Task 5.2 — README badges
- **Change:** Add 4 shields.io badges at the very top of the root `README.md`:
  ```
  [![CI](https://github.com/dsiddharth2/plug/actions/workflows/ci.yml/badge.svg)](https://github.com/dsiddharth2/plug/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Node.js](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org)
  [![npm](https://img.shields.io/npm/v/plugvault.svg)](https://www.npmjs.com/package/plugvault)
  ```
- **Files:** `README.md` (repo root)
- **Tier:** cheap
- **Done when:** 4 badge lines at top of README with correct URLs.
- **Blockers:** Task 5.1

#### Task 5.3 — LICENSE file
- **Change:** Create MIT LICENSE file at repo root with copyright holder "Siddharth Deshpande" and current year (2026).
- **Files:** `LICENSE` (create new at repo root)
- **Tier:** cheap
- **Done when:** MIT LICENSE file exists at repo root.
- **Blockers:** none

#### VERIFY: Phase 5
- Run `npm test` — all tests pass
- Verify `.github/workflows/ci.yml` is valid YAML
- Verify badge URLs are correct for dsiddharth2/plug
- Verify LICENSE file is present and correct
- Report any issues

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing tests regress from routing changes | high | Run full test suite after every phase; `getClaudeDirForType` defaults to commands for unknown types |
| CI workflow YAML syntax error | med | Validate YAML before push |
| SSH timeout to origin | med | Use local fetch workaround if needed |

## Notes
- Base branch: main
- Feature branch: feat/agents-support
- Each phase gets 1 commit (see commit messages below)
- Commit messages: Phase 1 = `feat: add agent constants, paths, and init/install routing`, Phase 2 = `feat: add agent support to update, remove, list, search`, Phase 3 = `test: add agent package type tests`, Phase 4 = `docs: add agent type to authoring guide and READMEs`, Phase 5 = `ci: add GitHub Actions CI workflow, badges, and LICENSE`
