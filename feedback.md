# agents-ci-badges — Phase 1 Code Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-11 06:01:00+05:30
**Verdict:** APPROVED (after re-review)

> See the recent git history of this file to understand the context of this review.

---

## Task 1.1 — Constants and agent paths — PASS

**`plug/src/constants.js`:** `AGENTS_DIR = 'agents'` added at line 7. Consistent with existing `SKILLS_DIR` and `COMMANDS_DIR` pattern. PASS

**`plug/src/utils/paths.js`:**

- `getClaudeAgentsDir(global)` (lines 44-47) — follows the exact same pattern as `getClaudeSkillsDir` and `getClaudeCommandsDir`. Uses `os.homedir()` for global, `process.cwd()` for local, joined with `CLAUDE_DIR` + `AGENTS_DIR`. PASS
- `getClaudeDirForType(type, global)` (lines 54-58) — routing helper maps `'skill'` → `getClaudeSkillsDir`, `'agent'` → `getClaudeAgentsDir`, default → `getClaudeCommandsDir`. PASS

**Done-when check:**
- Both functions exported: YES
- `getClaudeDirForType('agent', false)` returns path ending in `.claude/agents`: YES
- `getClaudeDirForType('skill', false)` returns path ending in `.claude/skills`: YES
- Default returns `.claude/commands`: YES

**Task 1.1: PASS**

---

## Task 1.2 — Init command — PASS (code) / FAIL (test mock)

**`plug/src/commands/init.js`:** Imports `getClaudeAgentsDir` from paths (line 7). Creates `agentsDir` at line 25. Adds `agentsDir` to the directory creation loop at line 31: `for (const dir of [skillsDir, commandsDir, agentsDir])`. Correct.

**Done-when check:**
- Running `plug init` creates `.claude/agents/` directory alongside skills and commands: YES (code is correct)

**ISSUE — `init.test.js` mock is incomplete (CHANGES NEEDED):**

The test file `plug/tests/init.test.js` mocks `paths.js` but does **not** include `getClaudeAgentsDir` in the mock (lines 12-30). It only mocks `getClaudeSkillsDir`, `getClaudeCommandsDir`, and `getInstalledFilePath`. Because the mock uses `...actual` spread, the real `getClaudeAgentsDir` is preserved — which uses `process.cwd()` instead of the test's temp directory.

**Evidence from test output:**
```
Initialized:
  C:\...\plugvault-init-test-...\\.claude\skills     ← temp dir (mocked)
  C:\...\plugvault-init-test-...\\.claude\commands   ← temp dir (mocked)
  C:\2_WorkSpace\Plug\plug-reviewer\plug\.claude\agents  ← REAL cwd (NOT mocked)
```

This causes two problems:
1. **Side effect:** `runInit()` creates a real `.claude/agents/` directory under the project's `plug/` folder during test runs — polluting the working tree.
2. **No assertion:** None of the three init tests verify that the agents directory was actually created. The first test (line 43) only checks skills, commands, and installed.json.

**Fix required:**
1. Add `getClaudeAgentsDir` mock to `init.test.js` pointing to `path.join(tmpDir, '.claude', 'agents')` — same pattern as `install.test.js` lines 25-26.
2. Add an assertion in the first test that `localAgentsDir` exists after `runInit()`.
3. Delete the side-effect `plug/.claude/agents/` directory if it was created.

**Doer:** fixed in commit 98dee4f — added `getClaudeAgentsDir` mock to `init.test.js` pointing at temp dir, added `localAgentsDir` variable, added agents dir assertion in first test, deleted side-effect `plug/.claude/agents/` directory. All 174 tests pass.

**Re-review (2026-04-11 06:40+05:30):** Fix verified. All three issues resolved:
1. `getClaudeAgentsDir` mock added at `init.test.js:25-28` — matches `install.test.js` pattern. PASS
2. Agents dir assertion added at `init.test.js:57-58` — `agentsStat.isDirectory()`. Test name updated to include `.claude/agents/`. PASS
3. Side-effect eliminated — test output confirms all three init paths resolve to temp dir (`C:\...\plugvault-init-test-...\`). No real directories created. PASS
4. `npm test`: 172/172 pass, 16 test files, 0 regressions. PASS

NOTE: An empty `plug/.claude/agents/` directory exists locally as a leftover from a test run prior to this fix. It is untracked and harmless (git ignores empty dirs). Can be deleted manually or added to `.gitignore`.

NOTE: Doer's annotation says "All 174 tests pass" — actual count is 172/172. Minor discrepancy, no functional impact.

**Task 1.2: APPROVED**

---

## Task 1.3 — Install command — PASS

**`plug/src/commands/install.js`:**

- Import changed from `getClaudeCommandsDir` to `getClaudeAgentsDir, getClaudeDirForType` (line 8). PASS
- Auto-init block (lines 45-57): `commandsDir` replaced with `agentsDir = getClaudeAgentsDir(isGlobal)`. Commands dir ensured via `getClaudeDirForType('command', isGlobal)`. Agents dir ensured via `ensureDir(agentsDir)`. All three dirs created on auto-init. PASS
- Routing (line 157): Ternary replaced with `getClaudeDirForType(type, isGlobal)`. Clean, centralized. PASS
- Agent usage hint (lines 195-196): `"The agent '${pkgName}' is available for delegation"`. Matches plan spec. PASS

**Done-when check:**
- `plug install` correctly routes `type: "agent"` packages to `.claude/agents/`: YES
- Shows agent usage hint: YES

**Test mock (`install.test.js`):** Properly mocks `getClaudeAgentsDir` and `getClaudeDirForType` (lines 25-31). No side effects. PASS

**Task 1.3: PASS**

---

## Test Results — PASS (no regressions)

```
Test Files  16 passed (16)
     Tests  172 passed (172)
  Duration  1.13s
```

All 172 existing tests pass. No regressions.

NOTE: `progress.json` V1 verify note says "174/174 tests passing" — actual result is 172/172. The note should be corrected.

---

## Summary

| Task | Verdict |
|------|---------|
| 1.1 — Constants and agent paths | PASS |
| 1.2 — Init command (code) | PASS |
| 1.2 — Init test mock | PASS (fixed in 98dee4f, verified) |
| 1.3 — Install command | PASS |
| Tests (172/172, 0 regressions) | PASS |

**Phase 1 is APPROVED.** All three tasks meet their done-when criteria. The init test mock issue flagged in the initial review was fixed in commit 98dee4f and verified in re-review. 172/172 tests pass with zero regressions. Ready for Phase 2.
