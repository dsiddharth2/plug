# Sprint 3 — Dependency Resolution: Phase 5 Review (Cumulative)

**Reviewer:** plug-reviewer
**Date:** 2026-04-17 11:02:00+05:30
**Verdict:** APPROVED

> See the recent git history of this file to understand the context of this review.

---

## Prior Review History

- **Plan review (f4d8b53):** CHANGES NEEDED — two HIGH findings: `addDependents` merge semantics ambiguous, `_cascade` flag semantics undefined.
  - **Doer resolution:** fixed in PLAN.md revision (85364d5) — both findings addressed with explicit inline definitions.
  - **Re-review (0177919):** APPROVED.
- **Phase 1 (bb6a50e):** APPROVED — tracker.js extended with `installed_as`/`dependencies`/`dependents`; 7 new test cases; 264/264 tests pass.
- **Phase 2 (df1fe68):** APPROVED — DFS resolver created; 9 test cases; `getInstalled` called once per resolve; 273/273 tests pass.
- **Phase 3 (a02289b):** APPROVED — install.js wired with resolver; TUI plan screen; scope toggle; 281/281 tests pass.
- **Phase 4 (02d4464):** APPROVED — remove.js dependent check, cascade/force, orphan pruning; 287/287 tests pass.

---

## Phase 5: Post-Install Hook Notice

### Task 5.1: `src/utils/frontmatter.js` — PASS

- [x] `parseFrontmatter(content)` exported; regex `^---\r?\n([\s\S]*?)\r?\n---` correctly matches YAML fence block.
- [x] CRLF handled: both the fence delimiter regex and the line splitter use `\r?\n`.
- [x] Malformed input (no closing `---`): regex non-greedy `*?` with no match returns `{}`. Correct.
- [x] No frontmatter: regex fails to match, returns `{}`. Correct.
- [x] Key-value parsing uses `indexOf(':')` — handles colons in values (e.g., `hook: pre-tool-use:v2` → key `hook`, value `pre-tool-use:v2`). Correct.
- [x] Empty keys skipped (`if (key) result[key] = value`). Correct.
- [x] Lines without colons skipped. Correct.

### Task 5.1: Install.js wiring — PASS

- [x] `parseFrontmatter` imported at line 13.
- [x] `parseFrontmatter(content)` called at line 322 inside `installSinglePackage`, AFTER `fs.writeFile` at line 311. Correct placement — parse occurs after SKILL.md is already written to disk.
- [x] Guard `type === 'skill'` at line 322 ensures non-skill packages always get `fm = {}`, so `hookRequired` is `false` for commands and agents. No regression on non-skill installs.
- [x] `hookRequired` returned from `installSinglePackage` and threaded through `rootInstallInfo` to the output block.
- [x] CLI path (line 246-248): `chalk.yellow(⚠ Hook required: '${pkgName}' expects a hook in settings.json)` — printed only when `hookRequired` is truthy.
- [x] JSON mode (line 234): `if (hookRequired) out.hookRequired = true` — conditionally added to output object, not always present. Clean.
- [x] Fallback default at line 230: `hookRequired: false` when `rootInstallInfo` is null. Correct.

### Task 5.2: `tests/frontmatter.test.js` — PASS

5 test cases covering the exact spec:

1. **Standard parse** (`---\nname: my-skill\nversion: 1.0\n---`) → `{ name: 'my-skill', version: '1.0' }`. Tests core happy path.
2. **No frontmatter** (plain text) → `{}`. Tests absence handling.
3. **Malformed** (no closing `---`) → `{}`. Tests regex robustness.
4. **CRLF** (`\r\n` endings throughout) → correct parse with `hook: settings`. Tests cross-platform.
5. **Hook field** (`hook: pre-tool-use`) → `fm.hook === 'pre-tool-use'`. Tests the specific field the install wiring depends on.

All 5 are meaningful functional assertions, not snapshots. PASS.

### Security — PASS

- **No injection from frontmatter content into CLI output.** The warning message interpolates `pkgName` (from CLI argument / registry lookup), NOT any frontmatter value. Frontmatter is only checked for key existence (`fm.hook || fm.hooks`), never interpolated into strings.
- **No path traversal.** `parseFrontmatter` is a pure function operating on `content` (the already-fetched file contents). No filesystem access.
- **No silent catches swallowing errors.** The frontmatter parse is a regex match that returns `{}` on failure — this is intentional degradation, not error suppression. The `installSinglePackage` function's existing error handling (EACCES/EPERM rethrow, general rethrow) is unchanged and correct.

---

## Regression Check: Phases 1–4

### Phase 1 (Tracker) — No regression

- `trackInstall`, `addDependents`, `getInstalledRecord`, `prunableOrphans`, `removeDependentEdge` unchanged since Phase 1 commit (54652d1). Phase 5 does not touch `tracker.js`.

### Phase 2 (Resolver) — No regression

- `resolver.js` unchanged since Phase 2 commit (b3eaf24). Phase 5 does not touch `resolver.js`.

### Phase 3 (Install wiring) — No regression

- `install.js` changes in Phase 5 are additive: import added (line 13), `hookRequired` threaded through return value and output block. The `installSinglePackage` helper, resolver wiring, `addDependents` calls, and dep-tracking logic are untouched.
- Existing install.test.js mocks unaffected — `parseFrontmatter` is not mocked in install tests, but this is acceptable because `installSinglePackage` is tested through the `runInstall` integration path where `downloadFile` is mocked to return content without frontmatter, making `hookRequired` default to `false`.

### Phase 4 (Remove) — No regression

- `remove.js` unchanged since Phase 4 commit (5959da2). Phase 5 does not touch `remove.js`.

### npm test — PASS

- **292/292 tests pass, 28 test files, 0 failures.** Matches doer's claim. Includes all Sprint 1/2/3 test suites.

---

## Cross-cutting

- [x] Commit message `feat(install): post-install hook notice` matches PLAN.md VERIFY spec.
- [x] Commit touches only declared files: `src/utils/frontmatter.js`, `tests/frontmatter.test.js`, `src/commands/install.js`, `progress.json` (4 files changed, 60 insertions, 14 deletions).
- [x] `CLAUDE.md` is NOT committed.
- [x] `.fleet-task.md` is NOT committed.
- [x] `progress.json` tasks 5.1, 5.2, 5.V all marked `completed` with correct notes (292/292 tests pass).
- [x] No scope creep — no unrelated files modified.

---

## Summary

**Phase 5 is clean.** `parseFrontmatter` is a minimal, correct YAML-fence parser with proper CRLF handling and graceful degradation on malformed input. The install.js wiring is well-placed (after SKILL.md write), correctly guarded (skill-only), and properly threaded through both CLI and JSON output paths. The 5 tests are meaningful and cover the spec'd edge cases. No security concerns — frontmatter values are never interpolated into output strings.

**Sprint 3 complete.** All 5 phases (tracker extension, DFS resolver, install wiring, remove wiring, hook notice) reviewed and approved. 292/292 tests pass across 28 test files. No regressions detected in any prior phase. The two HIGH findings from the plan review (merge semantics, cascade flag) were addressed in PLAN.md revisions and correctly implemented in code.

Sprint is ready for PR to main.
