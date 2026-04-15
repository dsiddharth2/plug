# Phase 4 Review — dsiddharth2/plug#11

**Verdict:** APPROVED
**Commit reviewed:** c38ec94 (Phase 4 range: d90c01c..c38ec94)
**Scope:** Cumulative — Phase 1+2+3 regression + Phase 4 functional

## HIGH
- none

## MEDIUM
- none

## LOW
- `cleanup()` is called twice on normal exit: once from `waitUntilExit().then()` and again from `process.on('exit')` triggered by the subsequent `process.exit(0)`. The ANSI writes are idempotent so this is harmless, but the double invocation is unnecessary. A guard (`let cleaned = false`) would be cleaner. — `src/index.js:82-94`
- Paste buffer (`pasteBuffer` in `use-paste.js:27`) is unbounded — a multi-megabyte paste would be buffered entirely in memory. Acceptable for a local CLI tool, but worth noting. — `src/tui/hooks/use-paste.js:27`
- React effect cleanup for the stdin `data` listener (`use-paste.js:67-68`) only runs on component unmount, not on `process.exit()`. A brief dangling listener exists between exit signal and process termination. No practical impact since the process is dying. — `src/tui/hooks/use-paste.js:66-69`

## Notes
- npm test: 233/233 passing (25 test files), all green
- non-TTY guard: `node bin/plug.js < /dev/null` → exit 1 + guard message on stderr naming Claude Code's Bash tool. Phase 1 intact
- --version: `1.1.0` — PR #7 intact
- Phase 2 skill-install regression: install path still uses `.claude/skills/<name>/SKILL.md` subdirs with legacy migration. Intact
- Phase 3 alt-screen regression: `\x1b[?1049h` (enter) and `\x1b[?1049l` (leave) sequences present in `launchTui`, properly ordered. Intact
- Enter/leave ordering (enter: alt-screen → paste; leave: paste → alt-screen): CORRECT. `\x1b[?1049h` at line 72, `\x1b[?2004h` at line 77. Cleanup calls `leavePasteMode()` before `leaveAltScreen()` at line 82. Reverse order confirmed
- Leave registered on BOTH `process.on('exit')` (line 83) AND `waitUntilExit()` (line 91): mirrors Phase 3 pattern. Correct
- Shared use-paste hook: single `src/tui/hooks/use-paste.js` hook used by both SearchBox (`src/tui/components/search-box.jsx:41`) and AddVaultForm (`src/tui/screens/vaults.jsx:393`). No per-component duplication. Neither consumer contains raw paste marker literals
- Test file in fix commit (not chore): confirmed — `tests/tui/bracketed-paste.test.js` landed in d90c01c, the fix commit. Process deviation from Phase 3 not repeated
- Coverage of all TextInput call sites: all `useInput` call sites audited across `src/tui/`. Only SearchBox and AddVaultForm accept free-form text input; both use `usePaste`. Remaining `useInput` sites (app.jsx, discover.jsx, installed.jsx, package-detail.jsx, package-list.jsx, install-complete.jsx) handle navigation/action keys only — paste support not needed
- Stdin listener cleanup: React effect cleanup removes the listener on unmount. On `process.exit()` the effect cleanup does not run, but the process is terminating so no practical impact (LOW)
- No Ink version bump: `package.json` unchanged for `ink` dependency vs 6a8c110
- ANSI sequences hardcoded: no user input in string literals — no injection risk
- 14 tests cover: complete paste payload → single insert, split-across-chunks, multiple-pastes-in-one-chunk, multiline, empty paste, special characters, normal input ignored, shared hook wired into both SearchBox and AddVaultForm, teardown ordering
- Process note: doer again required PM intervention to commit (global CLAUDE.md no-auto-commit rule). This is the fourth consecutive phase with this friction. User may want to either amend the global CLAUDE.md rule for fleet contexts or grant the doer agent a commit exception in its context template
