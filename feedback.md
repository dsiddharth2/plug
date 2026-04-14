# Phase 1 Code Review — Core Skill + Command

**Reviewer:** Plug Reviewer Agent
**Date:** 2026-04-14
**Branch:** feat/skill-redesign
**Files reviewed:** plug/skill/SKILL.md, plug/skill/references/config-schema.md, plug/skill/plug-command.md
**Spec:** roadmap/skill-redesign-plan.md

---

### Verdict: ~~CHANGES NEEDED~~ → APPROVED (re-review 2026-04-14)

---

### Findings

#### HIGH

1. **SKILL.md — Word count significantly under target**
   - **File:** plug/skill/SKILL.md
   - **Description:** The design spec calls for ~1500 words in the body. The current file is roughly 600–700 words. All 6 sections are present and structurally correct, but several are thin — Auth Resolution (Section 3) is only 6 lines of prose, Fetch Pattern (Section 4) could include more error-handling guidance, and Scope Handling (Section 6) is 4 lines.
   - **Suggestion:** Expand Sections 3, 4, and 6 with more operational detail. For example: (a) Auth Resolution should spell out what to do when no token is found but the vault is marked `private: true` — prompt the user? Fail with a message? (b) Fetch Pattern should document how to distinguish 404 vs 401 from curl exit codes (both return exit code 22 with `-f`; you need `-w '%{http_code}'` or check stderr to differentiate). (c) Scope Handling should clarify behavior when both local and global have the same package name (which takes precedence for remove/update?).
   - **Doer:** fixed — expanded SKILL.md to ~1700 words. Section 3 now covers private-vault-with-no-token error path and token resolution bash snippet. Section 4 restructured into 4 subsections (setup, execute with HTTP capture, error-handling table, JSON parsing). Section 5b (remove) now has 8 explicit steps including stale-entry cleanup. Section 6 (scope) now has a table, conflict-resolution rules for same-package-in-both-scopes, and auto-init on missing dirs. Added new Section 7 (semver comparison) with bash helper function.

2. **SKILL.md — Fetch Pattern cannot distinguish HTTP error codes as written**
   - **File:** plug/skill/SKILL.md, Section 4, step 5
   - **Description:** The fetch pattern states "Exit code 22 / HTTP 404 → package not found" and "Exit code 22 / HTTP 401 or 403 → auth failed." However, `curl -sf` returns exit code 22 for any HTTP error >= 400. The current instructions give no way to distinguish 404 from 401/403.
   - **Suggestion:** Change the curl invocation to capture the HTTP status code, e.g., `curl -sf -o /tmp/plug_resp -w '%{http_code}'`, then branch on the numeric code. Alternatively, use `curl -sS -f` and parse the stderr output which includes the HTTP code.
   - **Doer:** fixed — Section 4.2 now uses `curl -s -o /tmp/plug_response -w '%{http_code}'` to capture the numeric status separately from the response body. Section 4.3 is a full error-handling table branching on 200/404/401/403/other-4xx/000/5xx with specific user-facing messages for each case.

#### MEDIUM

3. **plug-command.md — Browse Step 4 missing "Other" option for free-text package name**
   - **File:** plug/skill/plug-command.md, Browse Step 4 (line ~108)
   - **Description:** The design spec notes: "If user selects 'Other' they can type a package name not in the top 4." The Search branch correctly includes an explicit "Other" option in Step 1, but the Browse install prompt panel does not.
   - **Suggestion:** Add an "Other" option to the Browse Step 4 AskUserQuestion: `label: "Other"`, `description: "Type a package name not listed above"`. Then handle the free-text follow-up the same way Search handles "Other."
   - **Doer:** fixed — added `label: "Other" / description: "Type a package name not listed above"` to Browse Step 4 install panel, plus follow-up instruction to ask in chat and treat the typed name as the selected package.

4. **SKILL.md / plug-command.md — Version comparison is plain string comparison, not semver**
   - **File:** plug/skill/SKILL.md (implicit), plug/skill/plug-command.md line 302
   - **Description:** The update check uses string comparison to detect version differences. String comparison breaks for multi-digit segments: `"1.9.0" > "1.10.0"` evaluates as true in string sort. The design spec says "semver string comparison" which implies semantic awareness.
   - **Suggestion:** Add a semver comparison note in SKILL.md Section 4 or a new inline helper: split on `.`, compare each segment as an integer. This doesn't need a library — 3 lines of bash or a simple algorithmic note for Claude to follow.
   - **Doer:** fixed — added Section 7 (Semver Comparison) to SKILL.md with a bash `compare_versions()` helper that splits on `.` and compares each segment as an integer. Updated plug-command.md Step 4a to reference SKILL.md Section 7 instead of using string comparison.

5. **SKILL.md — Routing table uses vague `...` for vault subcommands**
   - **File:** plug/skill/SKILL.md, Section 2
   - **Description:** The routing table entry reads `vault add/remove/list/...` which is ambiguous. The design spec explicitly lists `set-default`, `set-token`, and `sync` as vault subcommands.
   - **Suggestion:** Expand to: `vault add/remove/list/set-default/set-token/sync` to match the spec. This ensures Claude routes all vault operations correctly without guessing.
   - **Doer:** fixed — routing table now reads `vault add/remove/list/set-default/set-token/sync`.

#### LOW

6. **config-schema.md — registry.json `version` field semantics could be clearer**
   - **File:** plug/skill/references/config-schema.md, line 141
   - **Description:** The registry.json schema has a top-level `version` field documented as "registry schema version (not package version)." The comment is helpful, but there's no indication of what values are valid or what happens when this version changes.
   - **Suggestion:** Add a note: "Currently `1`. Future schema changes will increment this value. The skill should check this field and warn if it encounters an unrecognized version."
   - **Doer:** fixed — inline comment now reads: `Currently "1". Future schema changes will increment this value. The skill should warn if it encounters an unrecognized version.`

7. **plug-command.md — Search "Other" handling could be more explicit**
   - **File:** plug/skill/plug-command.md, Search Step 1 (line ~191)
   - **Description:** When user selects "Other", the command says `ask in chat: "Please type your search keyword:"`. This works but it's unclear whether Claude should use AskUserQuestion with a text input or just output the prompt as chat text and wait for the user's next message.
   - **Suggestion:** Clarify: "Output the prompt as a chat message. The user's next message will contain the keyword. Parse it and proceed to Step 2."
   - **Doer:** fixed — clarified: "Output the prompt as a chat message. The user's next message will contain the keyword. Parse it and proceed to Step 2. Do not use AskUserQuestion for free-text input."

8. **plug-command.md — My Packages "Done" option has no implementation note**
   - **File:** plug/skill/plug-command.md, My Packages Step 3 (line ~292)
   - **Description:** The "Done" option in the Action panel has no explicit handling instruction. It's obvious (just stop), but for consistency with other branches which all have explicit handling for every option, a one-liner would be cleaner.
   - **Suggestion:** Add after Step 3: `If "Done" selected: stop — return to conversation.`
   - **Doer:** fixed — added `If "Done" selected: stop — return to conversation. No further output needed.` after Step 3 panel.

---

### Summary

| Severity | Count |
|----------|-------|
| HIGH     | 2     |
| MEDIUM   | 3     |
| LOW      | 3     |

**config-schema.md** is the strongest deliverable — all 4 schemas present, complete field types, good examples, default seed included, and the File Location Summary table is a nice addition not in the original spec.

**plug-command.md** is comprehensive and faithful to the design spec. All 4 branches are fully implemented with correct AskUserQuestion structures, edge cases are handled well, and the shortcut routing table is complete. The Search branch improves on the spec by adding an explicit "Other" option and keyword mappings.

**SKILL.md** needs the most work — the structure is correct (all 6 sections present), but the content is too thin for a ~1500-word target and the fetch pattern has a technical flaw that will cause incorrect error handling in practice.

**Cross-references** between files are correct. SKILL.md points to `references/` paths that match the actual filenames, and plug-command.md correctly references SKILL.md sections and reference file paths.

Recommend addressing the 2 HIGH findings before merging. MEDIUM findings are quality improvements that strengthen the deliverable. LOW findings are polish.

---

## Re-Review (2026-04-14)

**All 8 findings verified as fixed.** Checking each against the updated files:

| # | Severity | Finding | Status | Verification |
|---|----------|---------|--------|-------------|
| 1 | HIGH | SKILL.md word count | FIXED | File expanded to 7 sections, 294 lines. Sections 3, 4, 5b, 6 all substantially expanded. New Section 7 (semver) added. |
| 2 | HIGH | Fetch pattern HTTP codes | FIXED | Section 4.2 uses `curl -s -o /tmp/plug_response -w '%{http_code}'`. Section 4.3 has full error table branching on 200/404/401/403/other-4xx/000/5xx. |
| 3 | MEDIUM | Browse "Other" option | FIXED | Browse Step 4 now includes `label: "Other"` with follow-up chat instruction (plug-command.md lines 124–130). |
| 4 | MEDIUM | Semver comparison | FIXED | SKILL.md Section 7 has `compare_versions()` bash helper. plug-command.md Step 4a references Section 7 explicitly. |
| 5 | MEDIUM | Vault routing ellipsis | FIXED | Routing table now reads `vault add/remove/list/set-default/set-token/sync` (SKILL.md line 45). |
| 6 | LOW | registry.json version semantics | FIXED | Inline comment expanded with version guidance and warning instruction (config-schema.md lines 144–147). |
| 7 | LOW | Search "Other" handling | FIXED | Explicit instruction: "Output the prompt as a chat message... Do not use AskUserQuestion for free-text input." (plug-command.md line 197). |
| 8 | LOW | "Done" option handling | FIXED | Added: "If 'Done' selected: stop — return to conversation. No further output needed." (plug-command.md line 298). |

### Re-Review Verdict: APPROVED

Phase 1 passes. All deliverables (SKILL.md, config-schema.md, plug-command.md) meet the design spec requirements. Ready to proceed to Phase 2 (reference files: install.md, search-and-list.md, vault-management.md).

---

## Phase 2 Review — Reference Files

**Reviewer:** Plug Reviewer Agent
**Date:** 2026-04-14
**Branch:** feat/skill-redesign
**Files reviewed:** plug/skill/references/install.md, plug/skill/references/search-and-list.md, plug/skill/references/vault-management.md
**Cross-reference files:** plug/skill/SKILL.md, plug/skill/plug-command.md, plug/skill/references/config-schema.md
**Spec:** roadmap/skill-redesign-plan.md

---

### Verdict: APPROVED

---

### Findings

#### MEDIUM

1. **search-and-list.md — Multi-keyword scoring algorithm is underspecified**
   - **File:** plug/skill/references/search-and-list.md, Step 4 (line 197)
   - **Description:** Step 4 states: "If the keyword maps to a known category (e.g., 'API & HTTP' → search for 'api', 'http', 'rest', 'graphql'), apply multi-keyword scoring by averaging across keywords." However, the scoring function defined in Step 3 handles only a single keyword. When the interactive command maps a category to multiple keywords (e.g., "Testing" → `["test", "testing", "tdd", "unit", "integration"]`), the expected scoring behavior is ambiguous. Should each keyword be scored independently then averaged? Should a package's final score be the max across keywords? Should overlapping name/description matches across keywords be deduplicated before averaging?
   - **Suggestion:** Add a `score_package_multi(pkg_name, pkg, keywords)` pseudocode function. Recommend: score each keyword independently using `score_package()`, then take the **maximum** score (not average) — averaging penalizes packages that match one keyword strongly but not others. Alternatively, if averaging is intentional, clarify that zero-scoring keywords are excluded from the denominator.

#### LOW

2. **vault-management.md — vault set-token uses free-text prompt instead of AskUserQuestion panel for vault selection**
   - **File:** plug/skill/references/vault-management.md, vault set-token Step 1 (line 325–329)
   - **Description:** When the vault name is not provided as an argument, the procedure says "output in chat: Which vault do you want to set a token for?" and "If still ambiguous, list the registered vaults and ask." Other vault subcommands that require vault selection (vault remove Step 2, vault set-default Step 2) use AskUserQuestion panels with structured options. This inconsistency means set-token relies on free-text parsing while similar operations use panels.
   - **Suggestion:** Add a fallback AskUserQuestion panel when the vault name is missing, matching the pattern used in vault remove/set-default. The token itself must remain free-text (security rule), but the vault selection can be a panel.

3. **install.md — Update `--all` only targets one scope**
   - **File:** plug/skill/references/install.md, Update Step 1–2 (lines 239–255)
   - **Description:** The update procedure determines scope at Step 1 (local by default), then `update --all` iterates all packages in that scope. There is no way to update packages across both scopes simultaneously via the shortcut (e.g., `plug update --all` only updates local). The interactive flow (plug-command.md My Packages → Check for Updates) reads both scopes and presents them together, so interactive users are unaffected.
   - **Suggestion:** Document this as expected behavior or add a note: "To update packages in both scopes, run `plug update --all` then `plug update --all -g`." Alternatively, add a `--all-scopes` flag, though this may be over-engineering for the current use case.

4. **vault-management.md — vault add "Add Anyway" path produces awkward report**
   - **File:** plug/skill/references/vault-management.md, vault add Steps 3–5 (lines 159, 186–197)
   - **Description:** When the user selects "Add Anyway" after a connectivity failure, Step 3 sets `packageCount = "unknown"`. Step 5's report template then reads `Packages | {packageCount} packages found`, producing "unknown packages found" — grammatically awkward.
   - **Suggestion:** Handle the "unknown" case explicitly in Step 5: `Packages | Unverified (connectivity test skipped)` or similar.

---

### Checklist Verification

| Check | Status | Notes |
|-------|--------|-------|
| **install.md — 12 install steps** | PASS | All 12 steps present (parse → auto-init → fetch registry → lookup → multi-vault conflict → check installed → fetch meta → fetch file → route by type → write → update installed.json → report). |
| **install.md — Update procedure** | PASS | 7-step update procedure: read installed → determine targets → fetch registry → semver compare (references SKILL.md Section 7) → report table → re-download → confirm. |
| **install.md — Error handling table** | PASS | Defers to SKILL.md Section 4.3 for HTTP errors (404/401/403/5xx/000). Additional 6-row table covers config missing, resolve_order empty, corrupt JSON, missing meta.entry, write failure. |
| **install.md — Scope support** | PASS | Scope table with trigger words, installed.json paths, and target dirs. Global config always read regardless of scope. |
| **install.md — AskUserQuestion panels** | PASS | Two panels: multi-vault conflict (Step 5) and already-installed conflict (Step 6). Both have valid JSON structure. |
| **search-and-list.md — 3 operations** | PASS | List Local, List Remote, Search — all fully defined. |
| **search-and-list.md — Scoring algorithm** | PASS | 40/30/20/10 scoring with correct rules: name is highest-only (exact OR partial), description and tag are additive. Python pseudocode provided. |
| **search-and-list.md — Example tables** | PASS | Three standalone examples at bottom (list, list --remote, search) plus inline examples in each section. |
| **vault-management.md — 6 subcommands** | PASS | vault list, add, remove, set-default, set-token, sync — all fully defined. |
| **vault-management.md — AskUserQuestion panels** | PASS | 5 panels: vault add visibility (Step 1), vault add error retry (Step 3), vault remove selection (Step 2), vault remove safety for official (Step 2), vault set-default selection (Step 2). All have valid JSON structure. |
| **vault-management.md — Error handling** | PASS | Connectivity test with retry loop (bounded at 2 attempts). Error handling summary table with 7 conditions. Remediation hints for failed vaults in sync. |
| **Cross-references to SKILL.md** | PASS | All three files correctly reference SKILL.md Section 3 (auth), Section 4 (fetch pattern), Section 4.3 (error table). install.md also references Section 5a (init) and Section 7 (semver). |
| **Cross-references from plug-command.md** | PASS | Shortcut routing table correctly points to `~/.claude/skills/plug/references/install.md`, `search-and-list.md`, `vault-management.md`. |
| **JSON field consistency with config-schema.md** | PASS | install.md writes `{type, vault, version, path, installedAt}` matching installed.json schema. All files access `config.vaults`, `config.resolve_order`, `config.default_vault`, `registry.packages` with correct field names. vault-management.md writes `{name, owner, repo, branch, private, token?}` matching config.json vault schema. |

---

### Summary

| Severity | Count |
|----------|-------|
| HIGH     | 0     |
| MEDIUM   | 1     |
| LOW      | 3     |

**install.md** is the strongest deliverable — all 12 install steps are complete with clear flow, the update procedure correctly references semver comparison, error handling is thorough, scope support is well-documented, and both AskUserQuestion panels have valid structure. The conflict and multi-vault resolution flows are faithful to the design spec.

**search-and-list.md** is comprehensive. All 3 operations are fully specified with step-by-step procedures, the scoring algorithm is correct with a clean Python implementation, filter flags are well-documented, and examples are plentiful. The only gap is the underspecified multi-keyword scoring path (Finding #1).

**vault-management.md** covers all 6 subcommands with complete procedures, AskUserQuestion panels, and error handling. The vault add flow handles connectivity testing with a bounded retry loop and "Add Anyway" escape hatch. The vault remove flow correctly protects the official vault and prevents removing the only registered vault. vault sync provides per-vault status with remediation hints.

**Cross-references** between all files are consistent. Reference file paths in SKILL.md and plug-command.md match the actual filenames. SKILL.md section references (3, 4, 4.3, 5a, 7) from the reference files point to the correct sections. JSON field names are consistent across all files and the config-schema.md schemas.

No HIGH findings. The 1 MEDIUM finding (multi-keyword scoring) is a clarity issue, not a correctness bug — the single-keyword path works correctly. The 3 LOW findings are polish items. Phase 2 deliverables meet the design spec requirements.

---

## Phase 4 Review — Documentation

**Reviewer:** Plug Reviewer Agent
**Date:** 2026-04-14
**Branch:** feat/skill-redesign
**Files reviewed:** plug/README.md, README.md (root), plug/skill/install.sh, plug/skill/uninstall.sh, .gitattributes
**Commits reviewed:** ca766b4, 8943579, f579b3e

---

### Verdict: APPROVED

---

### Findings

#### LOW

1. **plug/README.md — "Getting started" section still shows CLI-only workflow**
   - **File:** plug/README.md, lines 57–72
   - **Description:** The "Getting started" section (after the Install section) shows `plug init`, `plug search review`, `plug list --remote`, `plug install code-review` — all CLI commands. Since the README now positions the skill as the recommended installation method, new users who installed via the skill bootstrap will reach this section and see commands they can't run (they don't have the CLI). The section should either note that these commands assume CLI installation, or show the skill-equivalent workflow first (e.g., "Run `/plug` and select Browse").
   - **Suggestion:** Add a brief note at the top of "Getting started": "The examples below use the CLI. If you installed plug as a skill, run `/plug` in Claude Code to access the same functionality interactively."

2. **plug/README.md — "registry CONTRIBUTING guide" link points to sibling directory**
   - **File:** plug/README.md, line 223
   - **Description:** The link `[registry CONTRIBUTING guide](../plugvault/CONTRIBUTING.md)` resolves to a sibling `plugvault/` directory relative to the repo root. This works if the user has both repos cloned side by side, but will be a broken link on GitHub and for most cloners. The root README.md correctly uses the full GitHub URL for this same link.
   - **Suggestion:** Change to the full URL: `https://github.com/dsiddharth2/plugvault/blob/main/CONTRIBUTING.md` (matching root README.md line 65).

3. **Root README.md — No mention of uninstall.sh**
   - **File:** README.md (root)
   - **Description:** The root README mentions the bootstrap one-liner for install but provides no guidance on how to uninstall the skill. The uninstall script exists (`plug/skill/uninstall.sh`) but is not referenced anywhere in either README.
   - **Suggestion:** Add a brief "Uninstall" section or note under the Skill quick start: "To remove: `bash <(curl -sf https://raw.githubusercontent.com/dsiddharth2/plug/main/plug/skill/uninstall.sh)`"

---

### Checklist Verification

| Check | Status | Notes |
|-------|--------|-------|
| **plug/README.md — "Skill Installation (Recommended)" section before CLI** | PASS | Lines 23–43 present skill installation first, CLI section follows at line 45 labeled "CLI Installation (Legacy/CI)". |
| **plug/README.md — Bootstrap one-liner present and URL correct** | PASS | Line 31: `bash <(curl -sf https://raw.githubusercontent.com/dsiddharth2/plug/main/plug/skill/install.sh)` — URL points to correct repo and path. |
| **plug/README.md — CLI section renamed to legacy** | PASS | Line 45: "### CLI Installation (Legacy/CI)" — clearly labeled as legacy/CI alternative. |
| **plug/README.md — Two entry points explained** | PASS | Lines 27–29: `/plug` interactive command and natural language are listed as the two ways to use plug via skill. |
| **plug/README.md — How It Works section** | PASS | Lines 39–42: "### How It Works (Skill)" explains progressive disclosure architecture and `/plug` command. |
| **Root README.md — Quick Start shows skill installation first** | PASS | Lines 26–33: "### Skill (Recommended)" with bootstrap one-liner appears before CLI section. |
| **Root README.md — /plug command mentioned** | PASS | Line 35: "run `/plug` to browse and install packages interactively". |
| **Root README.md — CLI kept as alternative** | PASS | Lines 37–45: "### CLI (Alternative)" with npm install and link to CLI README. |
| **No broken links — URLs point to dsiddharth2/plug** | PASS | All GitHub URLs use `dsiddharth2/plug`. Internal relative links (plug/README.md, plug/docs/authoring-guide.md, plug/CONTRIBUTING.md, LICENSE) all resolve to existing files. One exception: plug/README.md line 223 `../plugvault/CONTRIBUTING.md` is a cross-repo relative link (see Finding #2). |
| **Shell scripts have LF line endings** | PASS | `git ls-files --eol` confirms both scripts have `i/lf` (LF in git index). `.gitattributes` rule `*.sh text eol=lf` ensures LF on checkout. |
| **.gitattributes added** | PASS | Single rule: `*.sh text eol=lf`. Committed in ca766b4. |
| **install.sh — correct behavior** | PASS | Creates directories (`~/.claude/skills/plug/`, `references/`, `~/.claude/commands/`), copies SKILL.md, all reference/*.md files, and plug-command.md → plug.md. Reports installed count and warns on overwrites. Uses `set -euo pipefail`. |
| **uninstall.sh — correct behavior** | PASS | Removes all 6 known files (SKILL.md, 4 reference files, plug.md), cleans up empty directories. Reports removed/skipped counts. Uses `set -euo pipefail`. |

---

### Summary

| Severity | Count |
|----------|-------|
| HIGH     | 0     |
| MEDIUM   | 0     |
| LOW      | 3     |

Both READMEs correctly implement the skill-first approach. The root README is clean and concise — Quick Start leads with the skill bootstrap, CLI is clearly positioned as an alternative, and `/plug` is mentioned. The plug/README.md is comprehensive with the recommended/legacy split, How It Works section, and correct bootstrap URL.

The install/uninstall scripts are well-structured with proper error handling (`set -euo pipefail`), informative output, and overwrite warnings. `.gitattributes` correctly enforces LF line endings for shell scripts, confirmed by git index inspection.

All 3 findings are LOW — a CLI-centric "Getting started" section that could confuse skill-only users, a cross-repo relative link that won't resolve on GitHub, and a missing uninstall reference. No blocking issues. Phase 4 deliverables meet the design spec requirements.
