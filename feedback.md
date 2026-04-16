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
