# Sprint 3 — Dep Resolution Plan Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** CHANGES NEEDED

> See the recent git history of this file to understand the context of this review.

---

## 1. Clear "done" criteria — PASS

Every task has explicit, testable done-when statements. Task 2.2 (resolver) done criteria includes the critical "getInstalled called once per resolve" constraint. Task 4.1 enumerates all three remove flows. Test tasks specify exact case counts. No ambiguity in what "done" means for any individual task.

---

## 2. Cohesion / coupling — PASS with NOTE

Phases are well-scoped: tracker schema (P1), resolver (P2), install wiring (P3), remove wiring (P4), frontmatter (P5). Coupling between phases follows the dependency graph cleanly.

**NOTE:** Task 3.1 is the densest task in the plan — extract helper, wire resolver, loop toInstall, track installed_as, call updateDependents, AND update install.test.js. It's cohesive around the install concern but could easily balloon into a multi-hour session if install.js has surprises. Doer should read install.js thoroughly before starting (the blocker note says this, which is good).

---

## 3. Shared abstractions in earliest tasks — PASS

Phase 1 establishes the tracker schema and all four helper functions (`updateDependents`, `getInstalledRecord`, `prunableOrphans`, `removeDependentEdge`) that Phases 3 and 4 consume. Phase 2 establishes the `resolve()` public API that Phase 3 consumes. Correct ordering.

---

## 4. Riskiest assumption validated early — PASS

Requirements.md Risk #1 (N file reads per node) is addressed in Phase 2, Task 2.2, which is the earliest phase where the resolver exists. The done criteria explicitly requires "getInstalled called once per resolve." The risk register also calls this out with HIGH impact and clear mitigation. Cannot validate earlier since the resolver doesn't exist until Phase 2.

---

## 5. Later tasks reuse early abstractions — PASS

- Phase 3 reuses `resolve()` (P2), `trackInstall` metadata fields (P1), `updateDependents` (P1).
- Phase 4 reuses `prunableOrphans` (P1), `removeDependentEdge` (P1).
- Phase 5 is independent but wires into install.js (P3).

No redundant reimplementations.

---

## 6. 2-3 work tasks per phase + VERIFY — PASS

| Phase | Work tasks | VERIFY |
|-------|-----------|--------|
| 1     | 2         | Yes    |
| 2     | 3         | Yes    |
| 3     | 3         | Yes    |
| 4     | 2         | Yes    |
| 5     | 2         | Yes    |

All within the 2-3 range. Each VERIFY includes `npm test`, manual checks, and a specific commit message.

---

## 7. Each task completable in one session — PASS with NOTE

Task 3.1 is the largest single task. It modifies two files (install.js + install.test.js) across 6 sub-steps. This is completable in one session for a developer who has already read install.js, but the blocker note should be treated as mandatory prep, not optional.

---

## 8. Dependencies satisfied in order — PASS

- P1 (tracker) before P2 (resolver uses tracker).
- P2 (resolver) before P3 (install wires resolver).
- P1 (tracker helpers) before P4 (remove uses prunableOrphans, removeDependentEdge).
- P3 (install.js modifications) before P5 (frontmatter wires into install.js).

No circular or out-of-order dependencies.

---

## 9. Vague / ambiguous tasks — FAIL (HIGH)

### HIGH: `updateDependents` overwrite semantics cause data corruption

Task 1.1 defines `updateDependents(name, dependents, global)` as: "overwrites `data.installed[name].dependents`; saves."

Task 3.1 step 5 says: "call `updateDependents(dep.name, [pkgName], isGlobal)` for each dep."

**The bug:** If package A depends on X, and later package B also depends on X:
1. `plug install A` → `updateDependents('X', ['A'], false)` → X.dependents = `['A']`
2. `plug install B` → `updateDependents('X', ['B'], false)` → X.dependents = `['B']` — **overwrites, losing `'A'`**

Now removing B makes X prunable (dependents = []), even though A still depends on X. This is a data integrity bug that will cause incorrect orphan pruning.

**Fix required:** Either:
- (a) Change `updateDependents` to **append** semantics: read current dependents, merge new entries, deduplicate, then save. Rename to `addDependents` for clarity. OR
- (b) Change Task 3.1 step 5 to read-then-merge: `const existing = getInstalledRecord(dep.name, isGlobal).dependents ?? []; updateDependents(dep.name, [...new Set([...existing, pkgName])], isGlobal)`. 

Option (a) is cleaner — the function should own its merge semantics.

### MEDIUM: `_cascade` flag in Task 4.1 is undefined

Task 4.1 Cascade flow says: "`runRemove(dep, { global, _cascade: true })` for each dependent first, then target." But `_cascade` is never defined — what does it do? Presumably it suppresses the dependents check on the recursive call to prevent infinite recursion (dependent A might itself have dependents). But this is not stated. Two developers could implement this differently:
- Developer 1: `_cascade` skips the dependents check entirely.
- Developer 2: `_cascade` skips only the user prompt but still checks.

**Fix required:** Add a one-line definition of `_cascade` behavior. Suggested: "When `_cascade` is true, skip the dependents check and proceed directly to file deletion + trackRemove — this prevents infinite recursion during cascade."

Also: what if dependents have their own dependents (A → B → target, where A depends on B depends on target)? Does cascade only remove direct dependents, or does it recurse transitively? This must be specified.

---

## 10. Hidden dependencies between tasks — PASS with NOTE

**NOTE:** Task 5.1 modifies install.js, which Task 3.1 also heavily modifies. The plan correctly sequences them (P3 before P5), but the doer should be aware that the insertion point for frontmatter parsing (Task 5.1: "after writing SKILL.md") depends on the final shape of install.js after Task 3.1's refactor. If 3.1 significantly restructures the file, 5.1's description of "after writing SKILL.md" may not map cleanly.

No other hidden dependencies found.

---

## 11. Risk register — PASS with NOTE

Five risks identified, all with impact ratings and mitigations. Good coverage of the key risks from requirements.md.

**Missing risk (should be added):**

| Risk | Impact | Mitigation |
|------|--------|------------|
| `updateDependents` overwrite semantics lose prior dependents on multi-parent deps | HIGH | Use append/merge semantics (see finding #9 above) |
| Cascade remove recursion depth on deep dependency chains | LOW | Cap recursion or use iterative approach; add test for A→B→target chain |

---

## 12. Alignment with requirements.md — PASS

All requirement sections (A1-A5, A6 scope toggle) have corresponding plan phases. All 7 acceptance criteria from requirements.md have matching VERIFY steps. Out-of-scope items correctly excluded.

---

## Sprint 3-Specific Concerns

### Phase 2 resolver.js — getInstalled() per-node prevention — PASS

Task 2.2 algorithm step 2 explicitly states: "`installedSnapshot = await getInstalled(isGlobal)` — load ONCE; pass into DFS — never call per-node." The done criteria reinforces this. Test 2.3 should include a spy/call-count assertion on `getInstalled` to enforce this at test level — this is implied but not explicitly listed as a test case.

**Recommendation:** Add a 9th test case to Task 2.3: "Verify `getInstalled` called exactly once regardless of dep tree size." This converts the requirement from a code-review check to an automated regression guard.

### Phase 3 install.js — rawBaseUrl branch condition — PASS

Task 3.1 step 1 clearly specifies: "If `pkgSpec.rawBaseUrl`: `fetch(rawBaseUrl + entry)` directly; Else: use existing `downloadFile(vault, ...)` path." Unambiguous.

### Phase 3 discover.jsx — ctx.set() timing — PASS

Task 3.3 explicitly states: "`ctx.set({ yes: true, json: true })` must only be called inside `doInstall()` after user confirms — NOT during resolver async phase." Risk register also covers this (MED impact). Clear constraint.

### Phase 3 install.test.js — mock layering — PASS with NOTE

Task 3.1 step 6 gives the exact `vi.mock` line. However, it doesn't specify how per-test overrides should work when some tests need the resolver to return deps and others need it to return an empty plan. The default mock returns `{ toInstall: [], alreadySatisfied: [], cycles: [] }` — this means existing tests won't break (resolver returns nothing), but new dep-tracking tests need `resolve.mockResolvedValueOnce(...)`. This is implied but stating it explicitly would prevent confusion.

### Phase 4 remove.js — cascade/force/cancel flows — FAIL

The three flows are listed but cascade has an undefined recursion mechanism (see finding #9 above). Cancel and Force are clear and distinct. Cascade needs the `_cascade` flag defined and transitive-dependent behavior specified.

---

## Summary

**What passed (10 of 12 checklist items):** Done criteria are clear. Abstractions are correctly ordered. Phases are well-sized with VERIFY checkpoints. Dependencies are satisfied in order. Risk register is present and mostly complete. Requirements alignment is full.

**What must change before execution (2 HIGH findings):**

1. **`updateDependents` overwrite semantics** — The current spec will silently drop dependents when a package is a dependency of multiple parents. This is a data integrity bug that causes incorrect orphan pruning. Change to append/merge semantics or add read-then-merge logic at the call site. Update Task 1.1 definition, Task 1.2 test cases (add multi-parent test), and Task 3.1 step 5.

2. **`_cascade` flag undefined in Task 4.1** — Define what `_cascade: true` does (skip dependents check to prevent infinite recursion). Specify whether cascade is shallow (direct dependents only) or transitive (recursive). Add a note about recursion depth.

**Recommendations (not blocking):**

- Add a 9th test case to Task 2.3: verify `getInstalled` called exactly once per resolve.
- Add the `updateDependents` overwrite risk to the risk register.
- Task 3.1 step 6: mention `mockResolvedValueOnce` pattern for per-test overrides.
