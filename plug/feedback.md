# PlugVault TUI — Plan Re-Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-15T01:00:00+05:30
**Verdict:** APPROVED

> See the recent git history of this file to understand the context of this review.

---

## Prior Review Resolution

The first review (commit `e14a333`) identified 2 FAIL and 4 NOTE findings. All have been addressed in the revised plan:

### FAIL #10 — stdout wrapping: RESOLVED
Task 2.1 now explicitly includes `src/tui/utils/capture-stdout.js` as a dedicated deliverable with a clear description of what it does (intercepts `process.stdout.write`/`process.stderr.write`, captures output as string). Tasks 2.3, 3.1, and 3.2 all reference "via stdout wrapper" for command invocations. The hidden dependency is no longer hidden.

### FAIL #12 — spec gaps: RESOLVED
All five missing/underspecified features from tui-plan.md have been addressed:
- **Vault sync (`s` key):** Added to keyboard controls table and Task 3.2 description with per-vault progress UI.
- **Vault add form:** Task 3.2 now specifies sequential inline prompts for all 5 fields (name, owner, repo, branch, private) with connectivity check. The simplification from a tabbed form to sequential prompts is documented in the risk register as an intentional design decision.
- **Installed tab file paths:** Task 3.1 now explicitly states "file path on line 2 (not description)" and mentions the need for a `mode` prop on `package-item`.
- **Vault metadata:** Task 3.2 includes package count, public/private, last sync time, and GitHub URL.
- **Install progress/completion screens:** Task 2.3 now includes `install-progress.jsx` (per-package spinner/checkmark) and `install-complete.jsx` (summary with paths and usage hints) as distinct deliverables.

### NOTE — Keyboard conflict: RESOLVED
The plan now includes `/` to focus search (disabling action keys) and `Esc` to unfocus. The keyboard controls table has the explicit rule: "Action keys (`i`, `u`, `r`) are only active when (a) at least one item is toggled AND (b) the search box is not focused." Added to risk register as risk #6.

### NOTE — Search scoring extraction: RESOLVED
Task 2.2 now includes: "Before implementing, verify that the search scoring logic in `src/commands/search.js` is importable as a pure function. If it's embedded inside a command handler that writes to stdout, extract it into a shared utility first."

### NOTE — Missing risks: RESOLVED
Three risks added: keyboard conflict (risk #6), vault form complexity (risk #7), agent type compatibility (risk #8). All include likelihood, impact, and mitigation.

### NOTE — Phase 4 task count: RESOLVED
Tasks 4.3 and 4.4 merged into a single Task 4.3. Phase 4 now has 3 work tasks, within the 2-3 guideline.

### NOTE — Agent type verification: RESOLVED
Phase 2 VERIFY includes "All package types (skill, command, agent) render with correct badges." Phase 3 VERIFY includes the same check for both Discover and Installed tabs.

---

## Re-Review: 12 Checks

### 1. Done Criteria — PASS
All tasks retain clear, testable done criteria. The revised tasks have stronger criteria: Task 2.1 adds "stdout wrapper captures command output without corrupting Ink rendering." Task 2.3 adds "Install progress shows per-package spinner/checkmark" and "Install complete shows summary with paths and usage hints." Task 3.1 adds file-path rendering and update-available indicators. Task 3.2 adds sync progress and connectivity check verification.

### 2. Cohesion and Coupling — PASS
No change from prior review. The addition of `capture-stdout.js` in Task 2.1 is the right place — it's a utility consumed by all later tasks that invoke commands, and building it alongside the first consumer (use-packages/Discover) ensures it's tested immediately.

### 3. Shared Interfaces in Earliest Tasks — PASS
No structural change. `capture-stdout.js` is now in the file structure under `src/tui/utils/` and is first built in Phase 2 before being consumed by Phases 2-3. The shared component hierarchy remains correct.

### 4. Riskiest Assumption Validated Early — PASS
Task 1.1 still validates Ink + Commander coexistence. The stdout wrapping risk is now addressed in Task 2.1, which is the earliest task that invokes existing commands — the right place to validate it.

### 5. DRY / Reuse — PASS
The stdout wrapper is a single utility reused across all command invocations in Phases 2-3. The `package-item` component gains a `mode` prop for Installed vs. Discover rendering rather than creating a separate component. Good reuse.

### 6. Phase Structure — PASS
All phases now have 2-3 work tasks plus VERIFY: Phase 0 (2), Phase 1 (3), Phase 2 (3), Phase 3 (2), Phase 4 (3).

### 7. One-Session Completability — PASS
Task 3.2 (Vaults screen) grew in scope with sync and vault-add form, but the sequential-prompts simplification keeps it manageable. The connectivity check is a single `fetchRegistry()` call against the new vault — not a complex new feature. Still one-session viable.

### 8. Dependency Order — PASS
No change in dependency structure. The new `capture-stdout.js` in Task 2.1 is correctly consumed by 2.3, 3.1, and 3.2 which all depend on phases after 2.1.

### 9. Vague or Ambiguous Tasks — PASS
Prior ambiguity around keyboard behavior is now resolved with the explicit `/`-to-focus, `Esc`-to-unfocus rule. Task 4.1 still says "Multiple TUI files" but the done criteria remain specific enough to constrain it.

### 10. Hidden Dependencies — PASS
Both prior hidden dependencies are resolved: stdout wrapping is an explicit Task 2.1 deliverable, and search scoring extraction has a verification note in Task 2.2.

### 11. Risk Register — PASS
Now covers 8 risks with likelihood, impact, and mitigation for each. The three additions (keyboard conflict, vault form complexity, agent compatibility) are well-described. The keyboard conflict risk (#6) correctly notes it's already resolved by design.

### 12. Alignment with tui-plan.md — PASS
All five spec gaps from the prior review are addressed. Cross-checking the revised PLAN.md against tui-plan.md wireframes:
- Discover tab: search, detail panel, install progress/complete — all covered.
- Installed tab: file paths on line 2, scope/type badges, update indicators, remove confirmation — all covered.
- Vaults tab: metadata display, add form with connectivity check, sync with progress, official vault protection, empty state — all covered.
- Keyboard controls: all keys from tui-plan.md present in PLAN.md table, plus the new `/` for search focus.

---

## Minor Observations (non-blocking)

1. **Component count mismatch:** The "What We Reuse vs. What We Build" table says "9 UI components" but the file structure lists 11 (tab-bar, package-list, package-item, package-detail, install-progress, install-complete, search-box, status-line, hotkey-bar, vault-list, spinner). Cosmetic — update the number when convenient.

2. **capture-stdout.js not in reuse table:** The new `src/tui/utils/capture-stdout.js` is in the file structure but not reflected in the "What We Build" column. Cosmetic.

3. **progress.json alignment:** The progress.json correctly reflects the merged Task 4.3 and updated task titles. 18 entries total (was 19). Matches PLAN.md.

---

## Summary

**12 PASS, 0 FAIL, 0 NOTE** across all review checks.

All findings from the prior review have been addressed. The plan is structurally sound: dependencies are ordered correctly, shared abstractions are built early, the riskiest assumptions are validated first, every task has testable done criteria, and the implementation aligns with the tui-plan.md spec. The risk register is comprehensive with 8 identified risks and mitigations.

The plan is ready for implementation. Start with Phase 0 (cleanup).
