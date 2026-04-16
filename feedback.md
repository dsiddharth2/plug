# Sprint 3 Phase 1 — Tracker Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** APPROVED

> Cumulative review — covers plan review + Phase 1 changes.

---

## Task 1.1 — tracker.js

All requirements met:

- **`trackInstall` persists new fields:** `installed_as`, `dependencies`, `dependents` are set at lines 52-54, with correct defaults (`'explicit'`, `[]`, `[]`). The spread order is correct — explicit fields override any same-named keys from `...metadata`.
- **Backward-compat normalisation:** `prunableOrphans` (line 93) uses `rec.installed_as ?? 'explicit'` and `rec.dependents ?? []`. `addDependents` (line 70) uses `rec.dependents ?? []`. `removeDependentEdge` (line 107) uses `rec.dependents ?? []`. All read paths that touch these fields have null-coalescing guards, so pre-existing records without the new fields won't break.
- **`addDependents` merge/dedup semantics:** Line 71 uses `[...new Set([...existing, ...newDependents])]` — this correctly merges and deduplicates. Multi-parent scenario (X depends on A, then B added) preserves both. No overwrite bug.
- **`getInstalledRecord`:** Returns `data.installed[name] ?? null` (line 83). Correct.
- **`prunableOrphans`:** Filters `installed_as === 'dependency'` AND `dependents.length === 0` (line 93). Uses backward-compat normalisation. Correct.
- **`removeDependentEdge`:** Filters out `fromName` from `toName`'s dependents array (line 107). Early return on missing record. Saves after mutation. Correct.
- **Early-return guards:** Both `addDependents` (line 69) and `removeDependentEdge` (line 106) return early if the target record doesn't exist. Good defensive coding.

No issues found.

---

## Task 1.2 — tracker.test.js

All 7 required test cases present and correctly implemented:

1. **`trackInstall` with `installed_as: 'dependency'`** — verifies persistence of all three new fields.
2. **`trackInstall` default** — verifies `installed_as` defaults to `'explicit'` when omitted.
3. **`addDependents` multi-parent accumulation** — installs with `dependents: ['pkg-a']`, then calls `addDependents` with `['pkg-b']`, asserts result is `['pkg-a', 'pkg-b']`. This is the critical multi-parent test that validates merge semantics.
4. **`addDependents` dedup** — calls `addDependents` twice with `['pkg-a']` on a record that already has `['pkg-a']`, asserts no duplicate.
5. **`addDependents` single-record isolation** — installs two packages, mutates one, verifies the other is unaffected.
6. **`prunableOrphans` subset** — installs an orphan dep, a non-orphan dep, and an explicit package. Verifies only the orphan is returned. Correct boundary testing.
7. **`removeDependentEdge` back-reference** — installs with two dependents, removes one, verifies only the other remains.

Tests are appended to the existing `tracker.test.js` (not a new file). Imports updated at line 21 to include all four new functions. Existing 9 tests unaffected.

No issues found.

---

## Test Results

**264/264 tests pass** across 26 test files. Zero failures, zero skipped. No regressions.

---

## Summary

Phase 1 implementation is clean, correct, and complete. All four tracker helpers match the PLAN.md specification exactly. The `addDependents` merge/dedup semantics — the critical requirement from the plan review's HIGH finding — are correctly implemented using `Set` deduplication. Backward-compat normalisation is consistently applied across all read paths. All 7 new test cases cover the right scenarios including the multi-parent accumulation test that guards against the overwrite bug identified in the plan review. Full test suite green. Approved for Phase 2.

---
---

# Sprint 3 Phase 2 — Resolver Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** APPROVED

> Cumulative review — covers Phase 1 + Phase 2 changes.

---

## HIGH
(none)

## MEDIUM
(none)

## LOW
- `vaultHint` parameter accepted but unused in `resolve()` — resolver.js:80 — not a bug (reserved for Phase 3 install wiring), but worth a note so it doesn't get forgotten.

---

## Task 2.2 — resolver.js

### `buildPackageMap()`
- Official vault registries loaded first via `getResolveOrder()` + `fetchRegistry()` with stale-cache fallback. Both wrapped in try/catch — offline-safe.
- Community index loaded second via `fetchCommunityIndex()` with stale-cache fallback. Community packages overwrite official entries on name conflict (community wins). Correct per spec.
- Handles both object and array shapes for community data (line 37: `Array.isArray` check). Defensive.
- Each package entry gets `dependencies: pkg.dependencies ?? []` default (line 40). Safe against missing field.

### `resolve()` — getInstalled called EXACTLY ONCE
- `getInstalled(isGlobal)` called at line 85 inside `Promise.all`, before DFS begins. The snapshot is passed as a parameter to `dfsResolve` — never re-fetched inside the loop. **Verified.**

### DFS (`dfsResolve`)
- **Back-edge / cycle detection:** `inStack` set tracks the current DFS path. If `name` is already in `inStack`, it's a back-edge — cycle recorded and return (line 50-53). Correct.
- **Already-visited skip:** `visited` set checked at line 54. Prevents re-processing in diamond dependency graphs. Correct.
- **Optional deps skipped:** `required !== false` check at line 63. Deps with `required: false` are skipped. Correct.
- **Unknown deps silently skipped:** `packageMap.has(depName)` check at line 65. Unknown packages don't crash. Correct.
- **Topological order:** Post-order push — deps processed before the package itself. `inStack.delete` before `visited.add` and array push. Result is dep-first with `pkgName` last. Correct.
- **Installed check:** `Object.prototype.hasOwnProperty.call` at line 72 — safe against prototype pollution. Good.
- **Dedup in output arrays:** `includes()` check before push at lines 74 and 76. Prevents duplicates in `alreadySatisfied` and `toInstall`. Correct (though O(n) — acceptable for package counts).

### Public API
- Returns `{ toInstall, alreadySatisfied, cycles }` as specified.

No issues found.

---

## Task 2.3 — resolver.test.js

All 9 required test cases present:

1. **No deps** — `toInstall: [pkg]`, empty `alreadySatisfied` and `cycles`.
2. **Single required dep** — `toInstall: [dep, pkg]` (dep-first order verified).
3. **Dep already installed** — `alreadySatisfied: [dep]`, `toInstall: [pkg]`.
4. **Transitive A->B->C** — `toInstall: [C, B, A]` (deep-first topological order).
5. **Cycle A->B->A** — `cycles` contains the back-edge node, both packages still in `toInstall`.
6. **Optional dep skipped** — `required: false` dep not in `toInstall`.
7. **Unknown dep no crash** — missing dep silently skipped, parent still installed.
8. **All deps installed** — all deps in `alreadySatisfied`, only root in `toInstall`.
9. **getInstalled called exactly once** — spy test with multi-dep diamond graph (`dep-m1` and `dep-m2` share a dep). Verifies `getInstalled` called once even with complex graph.

Mocks are clean: `vi.mock` for registry, community-index, tracker, config. `beforeEach` resets all mocks with sensible defaults (offline/empty). `setupPackages` helper keeps tests concise.

No issues found.

---

## Cross-cutting Checks

- **Tests green:** 273/273 pass across 27 test files. Zero failures.
- **Commit history:** 2 commits since Phase 1 (`b3eaf24` feat, `5db3f83` progress) — clean, messages match plan.
- **Files changed:** Only `resolver.js`, `resolver.test.js`, `progress.json` — no scope creep.
- **No `CLAUDE.md` or `.fleet-task.md` committed.**
- **Phase 1 not regressed:** Tracker tests (16 cases) still pass. No tracker files modified.

---

## Summary

Phase 2 implementation is correct, complete, and well-tested. The resolver correctly builds a merged package map (community-wins), calls `getInstalled` exactly once per resolution, and performs DFS with proper cycle detection, optional-dep skipping, and topological ordering. All 9 test cases cover the specified scenarios. Full test suite green with no regressions. Approved for Phase 3.

---
---

# Sprint 3 Phase 3 — Install Wiring + TUI Plan Screen Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** APPROVED

> Cumulative review — covers Phase 1 + Phase 2 + Phase 3 changes.

---

## HIGH
(none)

## MEDIUM
- Dead code: JSON abort output unreachable — install.js:144-146 — The outer guard at L132 is `if (!ctx.json && plan.toInstall.length > 1)`, so `ctx.json` is guaranteed false inside. The `if (ctx.json)` branch at L144 can never execute. Collapse to just the `console.log(chalk.yellow('Aborted.'))` path.

## LOW
- Silent dep skip on resolver lookup failure — install.js:173 — Empty `catch` silently drops deps that `findAllPackages` can't resolve. Acceptable for now, but a `verbose()` log inside the catch would aid debugging without changing behavior.
- `doInstall` closure in `useCallback` — discover.jsx:170 — `handlePlanConfirm` captures `doInstall` (a plain function recreated each render) but the dep array only lists `[installQueue]`. Safe in practice because `doInstall` only uses stable refs/setters and takes `queue` as a param, but `eslint-plugin-react-hooks` exhaustive-deps would flag it. Not blocking.

---

## Task 3.1 — install.js

### `installSinglePackage` extraction
- Clean extraction. Branches on `rawBaseUrl` presence for community vs official download path. Returns `{ type, destPath, version }` — well-defined contract.
- Community path uses raw `fetch()`; official path uses `downloadFile` helper. Both have meta.json fallback on failure. Correct.

### Resolver wiring
- `resolve(pkgName, vault.name, { global: isGlobal })` called at L129, after package lookup and overwrite prompt, before any downloads. Correct ordering.
- `vaultHint` parameter from Phase 2's LOW finding is now consumed — `vault.name` passed through. Good follow-through.

### Dependency install loop
- `installOrder` built from `plan.toInstall` with a guard at L157 that appends root if missing. Defensive and correct.
- `pkgSpecMap` pre-resolves all deps via `findAllPackages` before the install loop begins. Lookup failures silently skipped (see LOW above).
- Loop iterates dep-first order. Each package: download → trackInstall → next. Root gets `installed_as: 'explicit'`; deps get `installed_as: 'dependency'`. Both include `dependencies: [direct dep names]`. Correct per spec.

### Reverse-dependency edges
- `addDependents(depName, [pkgName], isGlobal)` called for each non-root dep after all installs complete. Root correctly excluded from addDependents calls. Correct.

### Already-satisfied handling
- Deps in `plan.alreadySatisfied` are never in `plan.toInstall` (resolver contract from Phase 2), so they are naturally skipped — no re-download, no re-track. Correct.

---

## Task 3.2 — install-plan.jsx (new component)

- Props: `{ queue, plan, loading, onConfirm(scope), onCancel }` — well-typed via JSDoc.
- Loading state renders spinner. Plan state renders "Will install" list + "Already satisfied" list + scope selector + footer.
- `confirmedRef` prevents double-confirm on fast key repeats — good defensive pattern.
- Tab toggles scope between `'project'` and `'global'`. `[i]`/`[y]`/Enter confirms; Esc cancels. All input blocked during loading. Correct.
- `queueMap` lookup provides vault/type info for display. Falls back gracefully if a dep isn't in the original queue.

---

## Task 3.3 — discover.jsx

- `'plan'` state added to `DiscoverView` union type.
- `startInstall` now runs resolver first, shows plan screen only when `plan.toInstall.length > 1`. Single-package installs bypass plan screen — current behavior preserved. Correct.
- Resolver failure falls back to direct install (L163-167). Good defensive behavior.
- `ctx.set({ yes: true, json: true })` called only inside `doInstall()` after confirm — NOT during resolver async phase. This prevents flag leakage if the user cancels from the plan screen. Verified.
- `handlePlanConfirm` passes `scope` through to `doInstall` as `{ global: scope === 'global' }`. Correct.
- `handlePlanCancel` resets all state and returns to list view. Correct.

---

## Tests

### install.test.js (4 new tests)
1. **Resolver call** — verifies `resolve` called with `pkgName`, vault name, and `{ global: false }`.
2. **Dep tracking** — verifies deps get `installed_as: 'dependency'` and root gets `installed_as: 'explicit'`.
3. **Reverse edges** — verifies `addDependents` called for deps with root as dependent; NOT called for root itself.
4. **Already-satisfied skip** — verifies satisfied deps are not downloaded or tracked.

### discover.test.jsx (4 new tests)
1. **Plan view for multi-dep** — verifies "Will install" text appears.
2. **Skip plan for no-dep** — verifies "Will install" does NOT appear; goes straight to installing.
3. **Tab toggles scope** — verifies `◉ Project` → Tab → `◉ Global`.
4. **Esc returns to list** — verifies plan view dismissed, list restored.

All mocks clean. Resolver mock defaults to empty `toInstall` so existing tests are unaffected.

---

## Cross-cutting Checks

- **Tests green:** 281/281 pass across 27 test files. Zero failures, zero skipped.
- **Commit history:** `bcc3a52` is the single Phase 3 commit. Message matches plan.
- **Files changed:** `install.js`, `install-plan.jsx` (new), `discover.jsx`, `install.test.js`, `discover.test.jsx`, `progress.json` — all in scope.
- **No `CLAUDE.md` or `.fleet-task.md` committed.**
- **Phase 1 not regressed:** Tracker tests (16 cases) still pass. Tracker functions used correctly.
- **Phase 2 not regressed:** Resolver tests (9 cases) still pass. `resolve()` integrated correctly with `vaultHint` now consumed.

---

## Summary

Phase 3 correctly wires the Phase 2 resolver into the install flow and adds a TUI plan screen for multi-dependency installs. The `installSinglePackage` extraction is clean. Dependency ordering, tracking, and reverse-edge recording all follow spec. The TUI plan screen is well-structured with proper scope toggle, cancel flow, and double-confirm guard. One MEDIUM (dead code in abort path) and two LOWs (silent catch, stale closure in useCallback). None are blocking. Full test suite green with 8 new targeted tests. Approved.

---
---

# Sprint 3 Phase 4 — Dependent Check, Cascade/Force, Orphan Pruning

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** APPROVED

> Cumulative review — covers Phases 1-4 changes.

---

## HIGH
(none)

## MEDIUM
- **Duplicate unlink/error-handling block** — remove.js:66-79 and remove.js:100-113 are identical file-deletion + EACCES/ENOENT handling. Consider extracting a `_unlinkSafe(path)` helper to eliminate the duplication. Not blocking since both paths are tested and correct, but it's a maintenance hazard if error handling ever needs to change.
- **`removeDependentEdge` argument order may confuse** — remove.js:84 calls `removeDependentEdge(name, dep, isGlobal)` where `name` is the package being removed and `dep` is each dependent. The tracker function signature is `removeDependentEdge(fromName, toName, global)` which reads as "remove fromName from toName's dependents array". Semantically correct (removing `name` from each dependent's list), but the loop variable `dep` at the call site makes it look inverted. A rename to `dependent` would clarify.

## LOW
- **No `--json` path for the dependent prompt** — When `ctx.json` is true, the `select()` prompt from `@inquirer/prompts` still fires interactively (line 45). JSON-mode callers (scripts, CI) would hang. Not in scope for this phase, but worth a future issue: in JSON mode, default to force or error out rather than prompting.
- **`_pruneOrphans` recursion depth** — Each orphan removal calls `runRemove` which calls `_pruneOrphans` again. In practice the depth is bounded by the dependency tree size, but a pathological graph could hit stack limits. Acceptable for now.

---

## Task 4.1 — remove.js

### Dependent check
- `dependents = pkg.dependents ?? []` at line 42, defensive against records missing the field. Correct.
- Prompt fires only when `dependents.length > 0 && !options._cascade` (line 44). The `_cascade` guard prevents infinite re-prompting on recursive calls. Clean design.

### Cancel
- Returns early (line 55). No side effects. Correct.

### Cascade
- Iterates `dependents` array, calls `runRemove(dep, { global: isGlobal, _cascade: true })` for each (lines 58-60). ONE level deep — the recursive call has `_cascade: true` so it skips its own dependents prompt and falls through to the normal remove path. Correct.
- After dependents are removed, falls through to remove the target (lines 99-124). Correct ordering: dependents first, then target.

### Force
- Deletes file, calls `trackRemove(name, isGlobal)`, then `removeDependentEdge(name, dep, isGlobal)` for each dependent (lines 82-85). Does NOT remove dependent packages — only severs the edges. Correct per spec.
- Has its own output path (JSON and CLI) and returns after `_pruneOrphans`. No fall-through to the normal path. Correct.

### Orphan pruning
- `_pruneOrphans(isGlobal)` called after every successful remove (lines 94, 124). Correct — fires for normal, cascade, and force paths.
- `ctx.yes` check skips the `confirm()` prompt and auto-prunes. Correct.
- Orphan removal goes through `runRemove` so it gets full treatment (file deletion + tracker update). Correct.

### Error handling
- EACCES/EPERM throws with a user-friendly message. ENOENT silently continues (file already gone). Other errors re-thrown. Same pattern as pre-existing code. Correct.

---

## Task 4.2 — remove.test.js

All 6 required test cases present:

1. **Dependents trigger prompt** — verifies `select` called when dependents exist; message contains dependent name.
2. **Cancel leaves both** — verifies both files exist and both tracker records intact after cancel.
3. **Cascade removes target + dependents** — verifies both files deleted, both tracker records removed.
4. **Force removes only target + severs edges** — verifies target file deleted, dependent file intact; target removed from tracker, dependent's `dependents` array no longer contains target.
5. **Orphan prompt fires** — verifies `confirm` called when orphaned dependency exists after remove; orphan kept when user declines.
6. **`--yes` auto-prunes** — verifies `confirm` NOT called; orphan auto-removed from tracker.

Mock setup is clean: `@inquirer/prompts` mocked at module level with `vi.mock`; `select` and `confirm` mocks reset via `vi.clearAllMocks()` in `beforeEach`. `ctx.reset()` in both `beforeEach` and `afterEach` ensures no state leakage between tests.

No issues found.

---

## Cross-cutting Checks

- **Tests green:** 287/287 pass across 27 test files. Zero failures, zero skipped.
- **Commit history:** `5959da2` (feat) + `ca0b9b1` (progress) — clean, messages match plan.
- **Files changed:** `remove.js`, `remove.test.js`, `progress.json` — all in scope. No scope creep.
- **No `CLAUDE.md` or `.fleet-task.md` committed.**
- **Phase 1 not regressed:** Tracker tests (16 cases) still pass.
- **Phase 2 not regressed:** Resolver tests (9 cases) still pass.
- **Phase 3 not regressed:** Install + TUI tests still pass. No install files modified.

---

## Summary

Phase 4 correctly implements dependent checking with three user-selectable paths (cancel/cascade/force) and automatic orphan pruning. The `_cascade` flag is an elegant solution to prevent recursive prompt loops. All three prompt paths and the orphan pruning flow are covered by well-isolated tests. Two MEDIUMs (duplicate unlink block, confusing variable name at call site) and two LOWs (no JSON-mode guard on prompt, recursion depth). None are blocking. Full test suite green at 287 tests with no regressions across Phases 1-3. Approved.
