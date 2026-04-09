# PlugVault CLI — Plan Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-09
**Verdict:** APPROVED — with minor residual items noted below

---

## Task Completeness

**PASS** — All critical findings from the initial review have been addressed in commit 8169baa. Minor residual items remain.

### 1. Clear "done" criteria
**PASS.** Every task has a "Done when" clause with a concrete, verifiable condition. Good use of CLI invocations as acceptance tests (e.g., `node plug/bin/plug.js --help` shows all commands).

### 2. High cohesion / low coupling
**PASS with note.** Tasks are generally well-scoped. Task 6.2 still touches many files but now has concrete per-error-class specifications, which makes it implementable despite the breadth.

### 3. Shared abstractions in earliest tasks
**PASS.** Phase 2 correctly builds all shared utilities (paths, config, auth, registry, fetcher, tracker) before any command implementation in Phase 3+.

### 4. Riskiest assumption validated in Task 1
**PASS.** Fixed in commit 8169baa. Task 1.1 "Done when" now includes: `npm view plugvault` returns 404 (name available) and chalk/ora import successfully under ESM. Risk register mitigation updated to reference Task 1.1 explicitly.

### 5. Later tasks reuse early abstractions (DRY)
**PASS.** All Phase 3-5 commands depend on and reuse Phase 2 utilities. The dependency graph is clean.

### 6. 2-3 work tasks per phase, then VERIFY checkpoint
**PASS with note.** Phase 2 now has 5 tasks (2.0-2.4) with the addition of test infrastructure. This is acceptable since Task 2.0 is "cheap" tier and all tasks are small. All phases have VERIFY checkpoints.

### 7. Each task completable in one session
**PASS.** Fixed in commit 8169baa. Task 3.2 split into 3.2a (basic install) and 3.2b (conflict/global/overwrite/auto-init). Task 6.2 was not split but now has concrete specifications for each error class, making scope clear and implementable.

### 8. Dependencies satisfied in order
**PASS.** All blocker references are correct and form a valid DAG. Task 3.2b correctly depends on 3.2a.

### 9. Vague tasks that two developers would interpret differently
**PASS.** Fixed in commit 8169baa. Task 6.2 now specifies each error class with exact message text, exit code, and recovery action (network ENOTFOUND, 404, 401/403, corrupt JSON backup+regenerate, EACCES/EPERM).

### 10. Hidden dependencies between tasks
**PASS with note.** Task 3.1 (init) uses chalk for colored output but only lists Task 2.1 as a blocker. chalk is an npm dependency available after `npm install` in Task 1.1, so this is not a real blocker — just an implicit dependency on package installation, not a task.

### 11. Risk register
**PASS with note.** The register covers 8 risks with concrete mitigations. The ora version was corrected to 8.x and the npm name check now references Task 1.1. The following risks were identified in the initial review but are acceptable as v2 deferred items:
- Registry schema migration (cache/installed.json invalidation on schema change)
- Conflicting package names across vaults (resolve_order handles priority but no disambiguation UX)
- File system permissions on global install paths
- Interrupted downloads (partial write corruption)

### 12. Plan aligns with requirements.md
**PASS.** All acceptance criteria are covered. The `-i` flag mismatch was fixed in the task definitions. See residual item below.

---

## Architecture & Dependencies

**PASS** — All specification mismatches from the initial review have been addressed.

1. **`plug install <name>`:** Fixed in commit 8169baa. The `-i` flag was removed from Task 3.2a, 3.2b, and VERIFY Core Commands. Command is now `plug install <name>` matching requirements.

2. **ora version:** Fixed in commit 8169baa. Risk register now correctly says "ora 8.x".

3. **Test infrastructure:** Fixed in commit 8169baa. Task 2.0 added at the start of Phase 2 — sets up vitest with a smoke test.

4. **Commit strategy:** Fixed in commit 8169baa. Commit Strategy section added with per-phase suggested messages and the 1-commit-per-phase rule.

**Residual:** Phase 6 VERIFY checkpoint (lines 220, 222) still contains stale `-i` flag references:
- `plug install -i nonexistent` should be `plug install nonexistent`
- `plug --verbose install -i code-review` should be `plug --verbose install code-review`

This is a minor copy error — the task definitions are correct, only the VERIFY text was missed.

---

## Risk Coverage

**PASS** — The register is adequate for v1.

- npm name mitigation now references Task 1.1 (verified)
- ora version corrected to 8.x (verified)
- Missing risks (schema migration, cross-vault name conflicts, global install permissions, interrupted downloads) are noted as deferred to v2 — acceptable for a greenfield v1 CLI

---

## Requirements Alignment

**PASS.**

| Requirement | Plan Coverage | Status |
|------------|---------------|--------|
| `plug --help` shows all commands | Task 1.2 | OK |
| `plug init` creates dirs | Task 3.1 | OK |
| `plug install <name>` | Tasks 3.2a + 3.2b | OK (fixed) |
| `plug remove <name>` | Task 3.3 | OK |
| `plug list` + `--remote` | Task 3.4 | OK |
| `plug search <keyword>` with scoring | Task 5.1 | OK |
| `plug update` | Task 5.2 | OK |
| `plug vault` subcommands | Tasks 4.1-4.3 | OK |
| Private vault with token auth | Tasks 2.2, 4.1 | OK |
| Published to npm as `plugvault` | Task 8.2 | OK (name check added to 1.1) |
| Windows-compatible paths | Task 2.1 | OK |
| ESM-only | Task 1.1 | OK |
| 1-hour cache TTL | Task 2.3 | OK |
| Local + global scopes | Tasks 2.1, 3.2b | OK |

---

## Summary

**Verdict: APPROVED**

All 7 critical findings from the initial review were addressed in commit 8169baa:
1. `-i` flag removed from install command definitions
2. ora version corrected to 8.x in risk register
3. npm name availability check added to Task 1.1
4. Task 3.2 split into 3.2a (basic) and 3.2b (advanced)
5. Task 6.2 expanded with concrete error specifications
6. Commit strategy section added
7. Task 2.0 (test infrastructure) added

**Residual items (non-blocking):**
- Phase 6 VERIFY still has 2 stale `-i` flag references (lines 220, 222 of PLAN.md) — trivial fix
- Phase 2 now has 5 tasks instead of the guideline 2-3, but all are small — acceptable
- Deferred risks (schema migration, cross-vault naming, interrupted downloads) should be tracked in a v2 backlog

The plan is ready for implementation.
