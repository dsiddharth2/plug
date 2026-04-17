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

---

# Harvest Review — 2026-04-17

**Reviewer:** plug-reviewer
**Date:** 2026-04-17
**Commit:** e49ba92 — `docs: harvest sprint/dep-resolution — dependency resolution feature + architecture`
**Verdict:** CHANGES NEEDED

> Reviewing the documentation harvest commit for durable content accuracy, completeness, and absence of transient content.

---

## Content Quality — Durable vs Transient

All four new doc files and the README update focus on architecture, trade-offs, API contracts, and feature behavior. No task lists, phase tables, PR numbers, line-number references, or debug notes found. One minor transient reference: `features/dependency-resolution.md` opens with "Sprint 3 taught the install/remove lifecycle about dependencies" — this is acceptable as historical context, not actionable task tracking.

No test-count references (e.g., "292 tests pass"), no "see PR #X" links. **PASS.**

---

## Factual Accuracy — HIGH: README and Feature Doc Misrepresent `--cascade`/`--force` as CLI Flags

**Finding (HIGH):** The README (`plug/README.md`) and `docs/features/dependency-resolution.md` both document `--cascade`, `--force`, and (on remove) `--yes` as CLI flags:

```
plug remove code-review --cascade  # Also remove dependent packages (one level)
plug remove code-review --force    # Remove only target; sever dependent edges
plug remove code-review --yes      # Auto-prune orphans without prompting
```

**Actual code (`src/commands/remove.js`):**
- The `remove` command registers only `-g, --global` as an option (line 10–11).
- `--cascade` and `--force` are **not** CLI flags. They are interactive `select` prompt choices presented when `pkg.dependents.length > 0` (lines 45–51). Running `plug remove code-review --cascade` would cause Commander.js to error on the unknown option, or silently ignore it — either way, it would NOT trigger cascade behavior.
- `--yes` is a **global** option (registered on the program in `index.js` line 18), so `plug remove code-review --yes` does set `ctx.yes = true`. This skips the orphan-prune confirmation prompt in `_pruneOrphans()`, but it does NOT bypass the dependent-check `select` prompt (cancel/cascade/force). The README implies `--yes` only auto-prunes orphans, which is correct for that specific behavior — but presenting it alongside `--cascade`/`--force` as parallel CLI flags is misleading since those two don't exist.

**Required fix:** Remove `--cascade` and `--force` from the README and feature doc CLI examples. Document that cascade and force are interactive choices presented when dependents exist. `--yes` can stay documented for its actual behavior (auto-prune orphans).

**Doer:** fixed in commit PLACEHOLDER_SHA — corrected README and feature doc: removed --cascade/--force as CLI flags, documented interactive prompt choices; fixed api.md parseFrontmatter note; updated decisions.md cascade wording

---

## Factual Accuracy — API Signatures and Return Shapes

Cross-checked every function signature and return shape in `docs/api.md` against source code:

| Function | Doc matches code? |
|---|---|
| `resolve(pkgName, vaultHint?, options?)` | **Yes** — signature, return shape `{ toInstall, alreadySatisfied, cycles }`, and field descriptions all accurate. |
| `addDependents(name, newDependents, global?)` | **Yes** — merge-via-Set semantics documented correctly. |
| `getInstalledRecord(name, global?)` | **Yes** — returns `installed[name] ?? null`. |
| `prunableOrphans(global?)` | **Yes** — filter logic matches code. |
| `removeDependentEdge(fromName, toName, global?)` | **Yes** — removes `fromName` from `installed[toName].dependents`. |
| `parseFrontmatter(content)` | **Yes** — regex, key-value parsing, empty-return semantics all match. |
| `trackInstall` metadata fields | **Yes** — `installed_as`, `dependencies`, `dependents` with correct defaults. |

**Minor note:** `api.md` includes the sentence "Checks `fm.hook || fm.hooks` to determine whether the installed skill requires a hook in `settings.json`" under the `parseFrontmatter` section. This logic is actually in `installSinglePackage` (install.js line 323), not in `parseFrontmatter` itself. The function only parses YAML and returns a record. This is slightly misleading but low-severity — a reader might think the function does the check internally.

**Doer:** fixed in commit PLACEHOLDER_SHA — clarified that the fm.hook check is in install.js, not in parseFrontmatter itself

**PASS** (except the `--cascade`/`--force` issue above, which is HIGH).

---

## Architecture Doc Accuracy

- **installed.json schema:** JSON example and field table match `trackInstall` code. Backward-compat normalisation (`rec.installed_as ?? 'explicit'`) documented and confirmed in `prunableOrphans` (line 93). **Accurate.**
- **DFS resolver algorithm:** 4-step description matches `resolver.js` exactly. `buildPackageMap` community-wins behavior confirmed at line 40. Single `getInstalled` call confirmed at line 83–86 via `Promise.all`. **Accurate.**
- **Install-plan TUI component:** Props, states, key bindings, and scope toggle all match `install-plan.jsx`. Footer `[i] Install [Esc] Cancel` matches lines 104–108. Tab toggle at line 25–27. **Accurate.**
- **ctx.set timing claim:** "called inside doInstall() only — never during the resolver async phase" — confirmed at `discover.jsx` line 185 (inside `doInstall`), not during plan resolution. **Accurate.**
- **Frontmatter parser:** Regex, indexOf-colon split, skip-on-miss behavior all match `frontmatter.js`. **Accurate.**

**PASS.**

---

## Decisions Doc

All five decisions are durable trade-off explanations with clear rationale:

1. **DFS over topological sort** — accurate reasoning, no transient content.
2. **addDependents merge semantics** — correctly explains why replace would corrupt multi-parent packages.
3. **Hook notice is print-only** — accurate rationale about settings.json mutation risk.
4. **JSON mode vs CLI mode split** — accurately describes the `hookRequired: true` conditional field.
5. **Shallow cascade on remove** — accurately describes `_cascade` one-level behavior.
6. **Community wins on name conflict** — matches `buildPackageMap` code.

**PASS.**

---

## Completeness

All 5 phases' durable knowledge is covered:

| Phase | Coverage |
|---|---|
| P1: Tracker extension | `architecture.md` (schema), `api.md` (function signatures), `decisions.md` (merge semantics) |
| P2: DFS resolver | `architecture.md` (algorithm), `api.md` (resolve signature), `decisions.md` (DFS choice, community-wins) |
| P3: Install wiring + TUI | `architecture.md` (install-plan component, ctx.set timing), `features/dependency-resolution.md` (install flow), README (examples) |
| P4: Remove wiring | `features/dependency-resolution.md` (remove flow, orphan pruning), `decisions.md` (shallow cascade) |
| P5: Hook notice | `features/dependency-resolution.md` (hook notice), `api.md` (parseFrontmatter), `decisions.md` (print-only, JSON split), `architecture.md` (frontmatter parser) |

**PASS** — no major gaps.

---

## Summary

**Verdict: CHANGES NEEDED**

One HIGH finding blocks approval:

1. **HIGH — `--cascade`/`--force` documented as CLI flags but are interactive prompt choices.** The README and `features/dependency-resolution.md` both show `plug remove code-review --cascade` and `plug remove code-review --force` as valid CLI invocations. These flags do not exist on the remove command. They must be removed from CLI examples and the remove behavior must be documented as an interactive prompt (Cancel / Cascade / Force) that appears when dependents are detected.

Everything else passes: API signatures are accurate, architecture descriptions match code, decisions are durable trade-off explanations with no transient content, and all five phases are covered. The `parseFrontmatter` api.md note about hook checking is slightly misplaced but low-severity.
