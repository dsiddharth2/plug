# Sprint 3 — Dep Resolution Plan Review (Re-review)

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** APPROVED

> Re-review after doer addressed two HIGH findings from initial review (commit f4d8b53).
> Doer fixes landed in commit 85364d5: `docs: revise plan — addDependents merge semantics + cascade flag definition`.

---

## HIGH #1 Resolution: `addDependents` merge semantics — RESOLVED

All five required changes verified in the revised PLAN.md:

1. **Task 1.1** (line 19): Function renamed from `updateDependents` to `addDependents`. Specification now reads "merges (not overwrites) newDependents into data.installed[name].dependents (deduplicate)." Explicit multi-parent example included.
2. **Task 1.1 done criteria** (line 25): Updated to "addDependents uses merge/dedup semantics."
3. **Task 1.2** (lines 32-34): Two new test cases added — multi-parent append scenario (install A then B both depending on X → X.dependents = ['A', 'B']) and dedup scenario (calling twice with same name produces no duplicate). Test count updated from 5 to 7.
4. **Task 3.1 step 5** (line 120): Call site changed from `updateDependents` to `addDependents`.
5. **Task 3.1 done criteria** (line 124): References `addDependents`.

**Risk register** (line 242): New row added for the multi-parent overwrite risk with merge/dedup mitigation and Task 1.2 test reference.

No remaining concerns. The merge/dedup semantics are unambiguous and the multi-parent test case will catch regressions.

---

## HIGH #2 Resolution: `_cascade` flag definition — RESOLVED

Task 4.1 (lines 165-169) now fully defines the cascade mechanism:

1. **Flag definition**: "`_cascade` definition: boolean flag passed in the options object. When `true`, it means 'this call was initiated by a cascade — skip the user prompt and proceed with removal immediately.'"
2. **Depth rule**: "Depth: one level only — when `_cascade: true`, the called `runRemove` will skip the prompt for that dependent's own dependents (they are not removed). This is intentional shallow cascade."
3. **Guard clause**: The prompt condition now reads `if dependents.length > 0 and !options._cascade` — cascade calls bypass the prompt.
4. **Future scope**: "If deep transitive removal is needed, that is a future enhancement."

The three flows (Cancel / Cascade / Force) are now fully distinct and unambiguous:
- **Cancel**: return early, no changes.
- **Cascade (shallow)**: remove direct dependents (with `_cascade: true` to skip re-prompt), then remove target. One level deep.
- **Force**: remove target only, sever edges via `removeDependentEdge`. Dependents left in place.

Done criteria (line 173) updated to include "_cascade flag skips re-prompt correctly."

No remaining concerns.

---

## Non-blocking Recommendations — Status

| Recommendation | Status |
|----------------|--------|
| Add 9th test case to Task 2.3: verify `getInstalled` called exactly once | ADOPTED — line 94, test count updated to 9 |
| Add `addDependents` overwrite risk to risk register | ADOPTED — line 242 |
| Risk register row 1: reference Task 2.3 spy test | ADOPTED — line 241 updated |
| Task 3.1 step 6: mention `mockResolvedValueOnce` pattern | Not explicitly in task text; covered in risk register line 245. Acceptable. |

---

## Full Checklist Re-pass

| # | Check | Verdict |
|---|-------|---------|
| 1 | Clear "done" criteria | PASS |
| 2 | High cohesion / low coupling | PASS |
| 3 | Shared abstractions earliest | PASS |
| 4 | Riskiest assumption validated early | PASS |
| 5 | Later tasks reuse early abstractions | PASS |
| 6 | 2-3 tasks per phase + VERIFY | PASS |
| 7 | Each task completable in one session | PASS |
| 8 | Dependencies satisfied in order | PASS |
| 9 | No vague / ambiguous tasks | PASS (both HIGHs resolved) |
| 10 | No hidden dependencies | PASS |
| 11 | Risk register present and complete | PASS (6 risks, all with mitigations) |
| 12 | Aligned with requirements.md | PASS |

## Sprint 3-Specific Concerns Re-pass

| Concern | Verdict |
|---------|---------|
| Phase 2: DFS prevents per-node `getInstalled()` | PASS — Task 2.3 now has spy-based call-count test |
| Phase 3: `rawBaseUrl` branch condition | PASS — unchanged, clear |
| Phase 3: `ctx.set()` timing constraint | PASS — unchanged, clear |
| Phase 3: mock layering instruction | PASS — risk register covers `mockResolvedValueOnce` |
| Phase 4: cascade/force/cancel flows distinct | PASS — all three fully specified with depth rule |

---

## Summary

Both HIGH findings from the initial review have been properly resolved. The plan is now unambiguous on `addDependents` merge semantics and `_cascade` shallow-removal behavior. Three of four non-blocking recommendations were adopted directly; the fourth is adequately covered by the risk register. All 12 checklist items pass. Plan is approved for execution.
