# PlugVault TUI — Plan Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-15T00:00:00+05:30
**Verdict:** CHANGES NEEDED

> See the recent git history of this file to understand the context of this review.

---

## 1. Done Criteria — PASS

Every task has a "Done when" section with testable, specific criteria. Task 4.1 is the broadest ("all empty/error states have user-friendly messages, no crashes on edge cases") but it enumerates the specific edge cases in the "Change" description (empty vault, no vaults, no internet, zero search results, terminal resize), making it verifiable. No task lacks a definition of done.

---

## 2. Cohesion and Coupling — PASS

Tasks are well-scoped. Phase 1 builds the shell and reusable components. Phases 2-3 build screens that consume those components. Phase 4 polishes. Task 2.3 (detail panel + install action + batch install) is the densest single task — it combines three related but distinct concerns — but they share enough state (selected package, toggle set) that splitting them would create more coupling, not less. Acceptable.

---

## 3. Shared Interfaces in Earliest Tasks — PASS

The two most-reused components — `package-list` and `tab-bar` — are both in Phase 1 (Tasks 1.2 and 1.3). The `status-line`, `hotkey-bar`, and `spinner` are introduced alongside their first consumer. Hooks follow the same pattern: `use-packages` in Phase 2, `use-installed` and `use-vaults` in Phase 3, each introduced when first needed. The ordering is correct.

---

## 4. Riskiest Assumption Validated Early — PASS

The riskiest technical bet is Ink + Commander coexistence in the same Node.js entry point, plus JSX transform configuration. This is exactly what Task 1.1 validates. The risk register correctly identifies this as Medium likelihood / High impact. The done criteria for 1.1 explicitly require both paths to work: `node bin/plug.js` (TUI) and `node bin/plug.js install code-review` (CLI). Good.

---

## 5. DRY / Reuse of Early Abstractions — PASS

`package-list` is reused by Discover (Phase 2) and Installed (Phase 3). `tab-bar` and `hotkey-bar` are used by the app shell across all tabs. All four hooks wrap existing utility modules rather than reimplementing logic. The "What We Reuse vs. What We Build" table is accurate and demonstrates zero rewrite of existing commands. The search scoring algorithm reuse is mentioned (from `src/commands/search.js`) — see finding #10 for a dependency note on this.

---

## 6. Phase Structure (2-3 Tasks + VERIFY) — PASS with NOTE

| Phase | Work tasks | VERIFY | Assessment |
|-------|-----------|--------|------------|
| 0 | 2 | Yes | OK |
| 1 | 3 | Yes | OK |
| 2 | 3 | Yes | OK |
| 3 | 2 | Yes | OK |
| 4 | 4 | Yes | Over guideline |

**NOTE:** Phase 4 has 4 work tasks. Tasks 4.3 (README) and 4.4 (publish workflow) are both marked "cheap" and could be merged into a single "distribution prep" task without loss of clarity. This is cosmetic — it doesn't block implementation — but strictly violates the 2-3 guideline.

---

## 7. One-Session Completability — PASS

All tasks are scoped to a single session. Task 2.3 is the largest (detail panel, single install, batch install, progress UI, installed-state checkmark), but all pieces share the same component and state, so a competent implementer can complete it in one sitting. Task 4.1 ("edge cases across multiple TUI files") is broad but the done criteria constrain it to a known list.

---

## 8. Dependency Order — PASS

Dependency chain traces correctly:

```
0.1, 0.2 → 0.V
1.1 → 1.2 → 2.1 → 2.2
1.1 → 1.3 → 2.1 → 2.3
1.2 + 1.3 → 3.1
1.2 → 3.2
3.2 → 4.1 → 4.2 → 4.3 → 4.4
```

No cycles. No task depends on something built later. Tasks 1.2 and 1.3 can run in parallel after 1.1 — the plan doesn't explicitly call this out but it's implied by the separate blocker lists.

---

## 9. Vague or Ambiguous Tasks — NOTE

**Task 4.1 ("Multiple TUI files"):** The files field says "Multiple TUI files" without listing them. Two developers might touch different files to implement resize handling. However, the done criteria are specific enough to constrain the output, so this is a minor clarity issue, not a blocking ambiguity.

**Keyboard input disambiguation:** The plan states "Type any char → Live filter search" as a global behavior alongside `i` (install), `u` (update), `r` (remove) as action keys. The plan resolves this with "when items toggled" — action keys only fire when packages are Space-selected. But this creates an edge case: if a user has items toggled and wants to search for a package starting with `i`, `u`, or `r`, the keystroke will trigger the action instead. Neither PLAN.md nor tui-plan.md addresses this. It needs a design decision (e.g., action keys only in a confirmation prompt, or a modifier key, or search-mode toggle with `/`). This should be resolved before implementation reaches Task 2.2.

---

## 10. Hidden Dependencies — FAIL

**stdout interference (not assigned to any task):** Risk #3 in the risk register identifies that existing command functions write to stdout, which will corrupt Ink's rendering. The mitigation says "Wrap existing commands — capture stdout during Ink rendering, only use return values." But no task is responsible for building this stdout capture wrapper. Task 2.3 calls `runInstall()` and will hit this problem. Either Task 2.1 or 2.3 must explicitly include stdout wrapping as a deliverable, or a new task should be added.

**Search scoring extraction:** Task 2.2 says it will reuse "the existing scoring algorithm from `src/commands/search.js`." If `search.js` exports the scoring function as a standalone utility, this is trivial. If the scoring logic is embedded inside a command handler that also writes to stdout, extraction work is needed. The plan doesn't specify which case applies. The implementer needs to verify this before starting Task 2.2 — add a note to Task 2.2's description stating "verify that search scoring is importable as a pure function; if not, extract it first."

---

## 11. Risk Register — NOTE (Incomplete)

The risk register covers 5 risks and is well-structured. Three additional risks should be added:

1. **Keyboard input conflict between search and action keys.** As described in finding #9, `i`/`u`/`r` overlap with type-to-search when items are toggled. Likelihood: High (will be encountered during development). Impact: Medium (UX confusion, not a crash). Mitigation: Design decision needed before Task 2.2.

2. **Vault add form complexity underestimated.** The tui-plan.md spec shows a multi-field form (name, owner, repo, branch, private checkbox) with Tab navigation between fields and a connectivity check. Task 3.2 describes this as "inline prompts for owner/repo." Building a multi-field form in Ink is non-trivial — it may need a reusable form component or a library. Likelihood: Medium. Impact: Medium (could blow Task 3.2's one-session scope). Mitigation: Evaluate Ink form libraries in Task 1.1 dependency research; simplify to sequential prompts if full form is too complex.

3. **Agent package type compatibility.** The requirements.md established agent as a third package type. The TUI must display `[agent]` badges and route agent installs correctly. The plan's wireframes (from tui-plan.md) show `[skill]` and `[command]` badges but don't explicitly show `[agent]`. Since the existing commands already handle agents, the TUI should work — but the done criteria for Tasks 2.1 and 3.1 should mention verifying agent-type packages render correctly. Likelihood: Low. Impact: Low. Mitigation: Add agent-type verification to Phase 2 and Phase 3 VERIFY checklists.

---

## 12. Alignment with tui-plan.md Spec — FAIL

The PLAN.md is clearly derived from tui-plan.md and covers the major features. However, several spec details are missing or underspecified in the implementation plan:

### Missing: Vault sync feature (`s` key)

The tui-plan.md wireframes show a `s` key in the Vaults tab hotkey bar for syncing vault registries, with a dedicated "Syncing vaults..." progress screen. The PLAN.md keyboard controls table does not include `s`. Task 3.2's description does not mention sync. This is a specified feature that was dropped without explanation. Either add it to Task 3.2 or explicitly defer it in "Out of Scope" with rationale.

### Underspecified: Vault add form

The tui-plan.md shows a 5-field form (vault name, GitHub owner, GitHub repo, branch, private checkbox) with Tab-to-navigate, Enter-to-save, and a connectivity check flow. Task 3.2 says "inline prompts for owner/repo" — this is a significant simplification of the spec. If the simpler approach is intentional, the plan should say so. If not, Task 3.2 needs more detail and possibly a scope increase.

### Missing: Installed tab shows file path, not description

The tui-plan.md wireframes show installed packages displaying their file path (`.claude/commands/code-review.md`) on line 2 instead of a description. The PLAN.md's Task 3.1 doesn't mention this difference from the Discover tab's package-item rendering. The `package-item` component may need a `mode` prop or the Installed screen may need a custom item renderer.

### Missing: Vault metadata display

The tui-plan.md shows each vault row displaying: package count, public/private status, last sync time, and GitHub URL. Task 3.2 only mentions "name/owner/repo/branch/default status." The additional metadata either requires API calls or registry cache reads — this affects the scope of `use-vaults` hook.

### Missing: Install progress and completion screens

The tui-plan.md shows distinct UI states for: "Installing N packages..." (with per-package spinner/checkmark), and "Installed N packages" (summary with file paths and usage hints like "Use /code-review to run the command"). Task 2.3 mentions "shows progress, updates installed state" but doesn't specify these as separate UI components or states. The install-complete screen with usage hints is a non-trivial UX element that should be in the done criteria.

---

## Summary

**3 PASS, 2 PASS-with-NOTE, 2 NOTE, 2 FAIL** across the 12 review checks.

### What passed
The plan's overall architecture is sound. Phase structure is correct, dependencies are ordered properly, the riskiest assumption is validated first, shared components are built early, and done criteria are specific. The reuse strategy (new TUI layer over existing commands) is the right approach.

### What must change before implementation
1. **Assign stdout wrapping to a task** (finding #10). Either add it to Task 2.1/2.3 or create a new task. Without this, the first real command invocation from the TUI will corrupt the Ink render.
2. **Resolve tui-plan.md spec gaps** (finding #12). The five missing/underspecified features need to be either incorporated into the relevant tasks or explicitly deferred in "Out of Scope." The vault sync feature and install progress screens are the most significant.
3. **Add a note to Task 2.2** about verifying search scoring is extractable as a pure function (finding #10).

### What should be addressed but doesn't block
- Add 3 missing risks to the risk register (finding #11): keyboard conflict, vault form complexity, agent type verification.
- Resolve the keyboard input disambiguation design question before Task 2.2 (finding #9).
- Consider merging Tasks 4.3 + 4.4 to stay within the 2-3 tasks/phase guideline (finding #6).
