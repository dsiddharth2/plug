# Phase 3 Review — dsiddharth2/plug#9

**Verdict:** APPROVED
**Commit reviewed:** 3815c7c (Phase 3 range: 7202fb1..3815c7c)
**Scope:** Cumulative — Phase 1 + 2 regression + Phase 3 functional

## HIGH
- none

## MEDIUM
- **Test file in wrong commit** — `plug/tests/tui/alt-screen.test.js` landed in `3815c7c` (`chore: update progress.json`) instead of `7202fb1` (the code commit). Tests and the code they test should be in the same commit so a revert is atomic. Accept as-is since squash-merge will collapse them, but note for future phases: tests belong with their code commit.

## LOW
- **No explicit SIGINT/SIGTERM handler for alt-screen leave** — The code relies on `process.on('exit', leaveAltScreen)` for cleanup. This works because Ink's `signal-exit` dependency intercepts SIGINT/SIGTERM and ultimately calls `process.exit()`, which triggers the `exit` handler. However, if a future change removes Ink's signal handling or if an uncaught exception bypasses the exit path, the terminal could be stuck in alt-screen. Adding explicit `process.on('SIGINT', ...)` / `process.on('SIGTERM', ...)` handlers would make the cleanup self-contained. Cosmetic — current behavior is correct given Ink's internals.

## Notes
- npm test: 219/219 passed
- non-TTY guard: fires correctly — exit code 1, guard message on stderr, no alt-screen enter emitted
- --version: 1.1.0 (PR #7 not regressed)
- Phase 2 skill-install regression: install logic intact — per-skill subdirs with legacy migration present in `src/commands/install.js`
- Alt-screen enter placement: `\x1b[?1049h` written after non-TTY guard and `resolveStdin()`, before `render()` — correct ordering
- Alt-screen leave coverage: `process.on('exit')` handler + `waitUntilExit().then()` — double-registration is harmless (idempotent write). SIGINT/SIGTERM covered transitively via Ink's `signal-exit` dependency
- Task 3.4 audit table in commit body: present in `7202fb1` — all 8 action→result flows documented (Discover install, Installed update/remove/detail, Vaults add/remove/set-default/sync)
- Test file commit placement: in `3815c7c` (chore), not `7202fb1` — flagged as MEDIUM above
- Alt-screen ANSI sequences are hardcoded string literals — no user input near the writes, no injection risk
- Fix is renderer-level (single `launchTui()` wrapper), not per-screen — all flows benefit uniformly, matching hypothesis (3) diagnosis
