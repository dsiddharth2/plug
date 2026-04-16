# Sprint 2: Community Discover — Plan Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** APPROVED

> See git history of this file for prior review context.

---

## Checklist Review

### 1. Does every task have clear "done" criteria?

**PASS.** All 11 tasks have explicit "Done when" sections with concrete, verifiable conditions. Task 1.1 ("constant is exported and importable"), Task 1.2 (all 5 functions specified with behaviors), Task 2.1 ("Discover tab shows 800+ packages when online; if community fetch fails, official packages still show"). Every VERIFY block lists both automated (`npm test`) and manual checks. No task relies on subjective judgment for completion.

### 2. High cohesion within each task, low coupling between tasks?

**PASS.** Phase 1 (util layer only — constants + cache/fetch module), Phase 2 (TUI integration only — hooks, components, screens), Phase 3 (tests only). Within Phase 2, each task maps to a single concern and largely a single file: 2.1 = data merging in `use-packages.js`, 2.2 = list display in `package-item.jsx`, 2.3 = detail display in `package-detail.jsx`, 2.4 = prop threading in screen files. No task mixes util work with TUI work or test work with implementation.

### 3. Are key abstractions introduced before they're used?

**PASS.** `COMMUNITY_INDEX_URL` is created in Task 1.1 and consumed in Task 1.2. `normalizeCommunityPackage`, `fetchCommunityIndex`, and `getStaleCommunityIndexCache` are all created in Task 1.2 (Phase 1) and first consumed in Task 2.1 (Phase 2). The `showDeps` prop pattern from Task 2.2 is threaded in Task 2.4. The dependency graph is clean and forward-only.

### 4. Is the riskiest assumption validated early?

**PASS** (with note). The `networkFailCount` isolation risk is the #1 item in the Risk Register (HIGH impact). Task 2.1's code snippet explicitly includes `// Do NOT increment networkFailCount — community failure is non-blocking`. Task 2.1's done-when requires "if community fetch fails, official packages still show." Task 3.2 adds a dedicated test: "fetchCommunityIndex throws -> official packages still visible (community failure isolated)." The automated test is deferred to Phase 3, but Phase 2's VERIFY includes manual confirmation that 800+ packages are visible, which implicitly validates the merge path. The separation between the explicit `try/catch` in Task 2.1 and the automated test in Task 3.2 is acceptable given the VERIFY checkpoints.

### 5. Later tasks reuse early abstractions (DRY)?

**PASS.** `normalizeCommunityPackage` from Task 1.2 is reused in Task 2.1 (both in the fetch path and the stale-cache fallback path). `fetchCommunityIndex` and `getStaleCommunityIndexCache` from Task 1.2 are consumed in Task 2.1. Phase 3 tests exercise the Phase 1 abstractions directly. No duplication of logic across tasks.

### 6. 2-4 work tasks per phase, then a VERIFY checkpoint?

**PASS.** Phase 1: 2 work tasks + VERIFY. Phase 2: 4 work tasks + VERIFY. Phase 3: 2 work tasks + VERIFY. All within the 2-4 range. Every phase ends with a VERIFY checkpoint that gates progression.

### 7. Each task completable in one session?

**PASS.** All tasks are scoped to 1-2 files. The heaviest tasks are: Task 1.2 (5 functions in a new file, but mirroring an existing `registry.js` pattern — the doer confirmed the pattern exists), Task 2.3 (dep list JSX + prop signature change, but full JSX is provided in the plan), and Task 3.1 (comprehensive test file, but test cases are fully enumerated). No task requires cross-cutting refactoring or research spikes.

### 8. Dependencies satisfied in order?

**PASS.** Task 1.1 (constant) -> Task 1.2 (util that imports constant). Phase 1 complete -> Task 2.1 (imports from util). Tasks 2.2 and 2.3 are parallel-safe (different files, no shared state). Task 2.4 depends on 2.2 (needs `showDeps` prop) and 2.3 (needs `installedNames` prop). Phase 2 complete -> Phase 3 (tests exercise all implemented code). No circular or out-of-order dependencies.

### 9. Any vague tasks that two developers would interpret differently?

**PASS.** Task 1.2 includes the exact `normalizeCommunityPackage` implementation with field mappings. Task 2.1 includes the exact code to insert with the try/catch structure. Task 2.2 specifies the exact string format (`★ N deps` / `no deps`). Task 2.3 includes full JSX with required/optional markers, installed status, and "also install" line. Task 2.4 specifies the exact prop changes. No room for divergent interpretation.

### 10. Any hidden dependencies between tasks?

**PASS** (with one flag). The doer's `plan_review` in `progress.json` caught three important details:

1. `package-item.jsx` has existing separator logic (`' · '`) that Task 2.2's snippet doesn't fully show — the implementer must preserve the existing separator pattern when inserting `depStr`. This is a known gotcha but not a hidden dependency.
2. `installed.jsx` does NOT use `<PackageDetail>` — it has its own `InstalledDetail` sub-component. Task 2.3's prop change is safe and scoped correctly.
3. `discover.jsx` line 196 is the exact call site Task 2.4 must change.

**Flag:** Task 1.2's Risk Register item 5 says "requires reading actual community-index.json shape before implementing" but this is not listed as a blocker in Task 1.2 itself. Since the full `normalizeCommunityPackage` mapping is already specified in the plan, the doer only needs to verify the field names match. This is adequately covered but the done-when for Task 1.2 could be more explicit about this verification step (see Summary).

### 11. Does the plan include a risk register? Is it complete?

**PASS.** Five risks identified with impact ratings and mitigations:

- `networkFailCount` isolation (HIGH) — mitigated by separate try/catch + test
- `PackageDetail` prop change breaking `installed.jsx` (HIGH) — mitigated by doer's audit confirming `installed.jsx` doesn't use `PackageDetail`
- 846-package render performance (MED) — mitigated by existing search filter
- `undefined` depCount on official packages (LOW) — mitigated by JS semantics (`undefined > 0` is `false`) + explicit test
- `normalizeCommunityPackage` field mapping errors (MED) — mitigated by reading actual JSON shape

Minor gap: no risk for community-index.json schema changing between index builds (stale cache returning a shape that doesn't match `normalizeCommunityPackage` expectations). However, the normalizer uses `??` defaults for every optional field, which provides implicit resilience. Acceptable.

### 12. Does the plan align with requirements.md intent?

**PASS.** Requirements.md lists 7 success criteria. The plan covers all 7:

| Requirement | Covered by |
|---|---|
| 800+ packages in Discover | Task 2.1 + VERIFY Phase 2 |
| Dep count per package | Task 2.2 |
| Dep detail with installed status | Task 2.3 |
| Community failure: official packages still show | Task 2.1 catch block + Task 3.2 test |
| Stale cache fallback | Task 2.1 `getStaleCommunityIndexCache()` |
| No cache: official packages show, no crash | Task 2.1 (community block is non-blocking) |
| All tests pass + new tests green | Phase 3 + every VERIFY |

Scope matches exactly — no scope creep into Sprint 3 resolver/tracker/hook work.

---

## Summary

**Verdict: APPROVED.** The plan is well-structured, precisely scoped, and aligned with requirements.

**What passed:** All 12 checklist items pass. The plan demonstrates strong task decomposition — every task has unambiguous done-criteria, key abstractions are introduced before use, the riskiest assumption (networkFailCount isolation) is surfaced in the risk register and addressed in both code and tests, and the phase structure (util -> TUI -> tests) is clean with VERIFY checkpoints gating each transition.

**What should be noted (non-blocking):**

1. **Task 1.2 shape verification:** The done-when for Task 1.2 should include an explicit step to verify the actual `community-index.json` field names match the `normalizeCommunityPackage` mapping before implementing. The risk register calls this out (item 5) and the blocker note says "read `src/utils/registry.js` first," but the JSON shape verification step is implied rather than stated. Recommend the doer verify `pkg.directory`, `pkg.entry`, `pkg.rawBaseUrl`, `pkg.vault`, `pkg.vaultUrl` exist in the actual index before writing the normalizer.

2. **Task 2.2 separator preservation:** The doer's plan_review correctly flagged that `package-item.jsx` has existing separator logic that Task 2.2's snippet doesn't fully represent. The implementer must take care to preserve the existing `' · '` separator pattern when inserting `depStr`. This is documented in the plan_review flags — no plan change needed, just awareness.

3. **Tests deferred to Phase 3:** No new tests in Phases 1 or 2. This is a deliberate and acceptable choice — Phase 1 creates only a utility module (smoke-tested via export check), Phase 2 is manually verified through VERIFY, and Phase 3 provides comprehensive coverage. The risk is that a bug in Phase 1 or 2 is caught late, but the VERIFY checkpoints mitigate this.

**Deferred:** Nothing deferred — the plan covers the full requirements.md scope within 3 phases.
