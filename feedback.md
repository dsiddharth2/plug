# PlugVault CLI — Plan Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-09
**Verdict:** CHANGES NEEDED

---

## Task Completeness

**FAIL** — Most checks pass, but several issues need resolution.

### 1. Clear "done" criteria
**PASS.** Every task has a "Done when" clause with a concrete, verifiable condition. Good use of CLI invocations as acceptance tests (e.g., `node plug/bin/plug.js --help` shows all commands).

**Doer:** no change needed — already passing.

### 2. High cohesion / low coupling
**PASS with note.** Tasks are generally well-scoped. Task 6.2 (error handling) touches nearly every file in the project — it has low cohesion. Consider splitting: one sub-task for util-level error handling (config/tracker auto-repair) and one for command-level edge cases.

### 3. Shared abstractions in earliest tasks
**PASS.** Phase 2 correctly builds all shared utilities (paths, config, auth, registry, fetcher, tracker) before any command implementation in Phase 3+.

### 4. Riskiest assumption validated in Task 1
**FAIL.** The risk register identifies "npm name 'plugvault' taken" with mitigation "Check availability early (Phase 1)", but no task in Phase 1 actually performs this check. Additionally, the ESM + chalk 5.x + ora import chain (identified as a risk) is not validated until dependencies are installed, but Task 1.1 doesn't list `npm install` or import validation as part of its "done" criteria. **Recommendation:** Add to Task 1.1's done criteria: (a) `npm info plugvault` confirms name availability, (b) chalk and ora import successfully under ESM.

**Doer:** fixed — Task 1.1 "Done when" now includes: `npm view plugvault` returns 404 (name available) and chalk/ora import successfully under ESM. Risk register mitigation updated to reference Task 1.1 explicitly.

### 5. Later tasks reuse early abstractions (DRY)
**PASS.** All Phase 3-5 commands depend on and reuse Phase 2 utilities. The dependency graph is clean.

### 6. 2-3 work tasks per phase, then VERIFY checkpoint
**FAIL.** Phase 2 has 4 work tasks (2.1–2.4) and Phase 6 has 3 work tasks plus very broad scope. All phases do have VERIFY checkpoints, which is good. **Recommendation:** Either merge Tasks 2.1+2.2 (constants/paths + config/auth are tightly coupled) or split Phase 2 into two sub-phases.

### 7. Each task completable in one session
**FAIL.** Task 3.2 (install command) is marked "premium" tier and includes: name parsing, vault resolution, registry fetch, file download, type routing, global flag, conflict prompts, auto-init, duplicate detection, tracking, and output formatting. This is at least two sessions of work. Task 6.2 (error handling for every module and every edge case) is similarly oversized. **Recommendation:** Split Task 3.2 into (a) basic install flow and (b) conflict handling + auto-init + global flag. Split Task 6.2 into (a) network/fetch error handling and (b) config/state corruption handling.

**Doer:** fixed — Task 3.2 split into Task 3.2a (basic install: parse, resolve, fetch, download, route, track) and Task 3.2b (advanced: vault prefix, conflict prompt, -g global flag, overwrite prompt, auto-init). Task 6.2 was expanded with concrete error specifications rather than split (see finding #9 annotation).

### 8. Dependencies satisfied in order
**PASS.** All blocker references are correct and form a valid DAG. No task depends on something built later.

### 9. Vague tasks that two developers would interpret differently
**FAIL.** Task 6.2 says "Handle: no internet, 404 repo, package not found, auth failure, file permission errors, corrupt config.json, corrupt installed.json" plus edge cases — this is a laundry list, not a specification. Two developers would handle these very differently (e.g., "auto-repair" corrupt JSON — restore defaults? backup + recreate? prompt user?). **Recommendation:** For each error class, specify the expected behavior (error message text pattern, exit code, recovery action).

**Doer:** fixed — Task 6.2 now specifies each error class with exact message text, exit code, and recovery action: network ENOTFOUND → "Connection failed. Check your internet connection." (exit 1); 404 → "Package '&lt;name&gt;' not found in any vault." (exit 1); 401/403 → "Authentication failed for vault '&lt;name&gt;'. Run: plug vault set-token &lt;name&gt; &lt;token&gt;" (exit 1); corrupt config → backup to .bak + regenerate defaults + warning; corrupt installed.json → backup to .bak + regenerate empty + warning; EACCES/EPERM → "Cannot write to &lt;path&gt;. Check permissions." (exit 1).

### 10. Hidden dependencies between tasks
**PASS with note.** Task 3.1 (init) uses chalk for colored output but only lists Task 2.1 as a blocker. chalk is an npm dependency so it will be available after `npm install` in Task 1.1, but this implicit dependency on the package being installed isn't tracked. Not blocking, but worth noting.

### 11. Risk register
**FAIL — incomplete.** The risk register exists and covers 8 risks, which is a solid start. Missing risks:
- **Registry schema migration:** If registry.json or meta.json schema changes in v2, existing caches and installed.json become invalid. No migration strategy.
- **Conflicting package names across vaults:** Two vaults could have a package with the same name but different content. The plan mentions resolve_order but doesn't address what happens when a user expects one and gets the other.
- **File system permissions on global install:** `~/.claude/` or `~/.plugvault/` may have restrictive permissions, especially on shared machines or CI environments.
- **Interrupted downloads:** If fetch succeeds but file write fails mid-way, the .md file is corrupt but installed.json may already be updated (or vice versa).

### 12. Plan aligns with requirements.md
**FAIL — minor but real mismatch.** See Architecture section below for details.

---

## Architecture & Dependencies

**FAIL** — Dependency order is correct, but there are specification mismatches.

1. **`plug install -i <name>` vs `plug install <name>`:** Task 3.2 introduces an `-i` flag that does not appear in requirements.md. The requirements say `plug install <name>`. The `-i` flag is non-standard for install commands (npm, pip, brew all use positional arguments). If `-i` is intentional (interactive mode?), it should be documented in requirements first. If it's a typo, fix it.

**Doer:** fixed — removed `-i` flag from Task 3.2a and 3.2b titles/descriptions, VERIFY Core Commands, and all other PLAN.md references. Command is now `plug install <name>` throughout.

2. **ora version inconsistency:** Requirements say "ora 8.x" (constraint section), but the risk register says "Pin to chalk 5.x and ora 7.x". These contradict. ora 8.x is the correct ESM-only version — update the risk register.

**Doer:** fixed — Risk Register row updated from "ora 7.x" to "ora 8.x".

3. **No testing strategy:** Phase 2 VERIFY mentions "unit tests pass" but no task creates a test framework, test runner, or test files. Either add a Task 1.3 or 2.0 for test setup, or remove unit test references from VERIFY checkpoints.

**Doer:** fixed — added Task 2.0 "Test infrastructure setup" at the start of Phase 2. Sets up vitest, tests/ directory, and `npm test` script. Done when `npm test` passes with a trivial test.

4. **Commit strategy missing:** The project-specific constraint "1 commit per phase" is not mentioned anywhere in the plan. Each phase should end with a note about committing.

**Doer:** fixed — added "Commit Strategy" section at the bottom of PLAN.md with a table mapping each phase to a suggested commit message and the 1-commit-per-phase rule (up to 2–3 for large phases).

---

## Risk Coverage

**FAIL** — The register exists but has gaps (see check #11 above). Additionally:

- The mitigation for "npm name taken" says "Check availability early (Phase 1)" but no Phase 1 task does this.
- The mitigation for "ESM imports fail" says "Pin to ora 7.x" which contradicts the requirements (ora 8.x).
- No risk entry for "GitHub API rate limiting on authenticated requests" (separate from raw URL rate limiting — the API has different limits).

---

## Requirements Alignment

**FAIL — minor gaps.**

| Requirement | Plan Coverage | Issue |
|------------|---------------|-------|
| `plug --help` shows all commands | Task 1.2 | OK |
| `plug init` creates dirs | Task 3.1 | OK |
| `plug install <name>` | Task 3.2 | Uses `-i` flag not in requirements |
| `plug remove <name>` | Task 3.3 | OK |
| `plug list` + `--remote` | Task 3.4 | OK |
| `plug search <keyword>` with scoring | Task 5.1 | OK |
| `plug update` | Task 5.2 | OK |
| `plug vault` subcommands | Tasks 4.1–4.3 | OK |
| Private vault with token auth | Tasks 2.2, 4.1 | OK |
| Published to npm as `plugvault` | Task 8.2 | Name availability not validated early |
| Windows-compatible paths | Task 2.1 | OK |
| ESM-only | Task 1.1 | OK, but ora version mismatch in risk register |
| 1-hour cache TTL | Task 2.3 | OK |
| Local + global scopes | Tasks 2.1, 3.2 | OK |

The plan covers all acceptance criteria but introduces the `-i` flag deviation and doesn't validate the npm name early despite listing it as a risk.

---

## Summary

**What passed:**
- Solid phased structure with VERIFY checkpoints after every phase
- Clean dependency graph — abstractions built before consumers
- Good coverage of all requirements acceptance criteria
- Risk register exists with meaningful mitigations

**What must change before implementation begins:**
1. **Fix `plug install -i`** — either remove the `-i` flag to match requirements, or update requirements first
2. **Fix ora version** — risk register says 7.x, requirements say 8.x
3. **Add npm name check to Task 1.1** — the risk register already says to do this
4. **Split Task 3.2** — too large for one session; separate basic install from conflict/global handling
5. **Split Task 6.2** — too vague; specify expected error behavior for each class
6. **Add commit strategy** — document "1 commit per phase" in the plan header
7. **Add test infrastructure task** — Phase 2 VERIFY references unit tests but no task sets up testing

**What can be deferred:**
- Missing risks (schema migration, cross-vault name conflicts) can be tracked as known technical debt for v2
- Phase 2 having 4 tasks is acceptable if Tasks 2.1+2.2 stay small, but consider merging
