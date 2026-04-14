# Phase 1 Code Review — Core Skill + Command

**Reviewer:** Plug Reviewer Agent
**Date:** 2026-04-14
**Branch:** feat/skill-redesign
**Files reviewed:** plug/skill/SKILL.md, plug/skill/references/config-schema.md, plug/skill/plug-command.md
**Spec:** roadmap/skill-redesign-plan.md

---

### Verdict: CHANGES NEEDED

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
