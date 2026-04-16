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
