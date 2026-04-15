# Sprint: ui-and-install-fixes-batch

**Sprint type:** single-pair-sprint (4 related bugs, phased execution, requires PLAN.md)
**Base branch:** main
**Feature branch:** `sprint/ui-and-install-fixes`
**Repo:** git@github.com:dsiddharth2/plug.git
**Working path:** C:/2_WorkSpace/Plug/plug-doer/plug
**Issues in scope:** dsiddharth2/plug#8, #9, #10, #11

---

## Summary

Batch-fix four open bugs in `plug`:

| # | Title | Category |
|---|-------|----------|
| [#8](https://github.com/dsiddharth2/plug/issues/8) | TUI crashes with `setRawMode EPERM` when stdin is not a TTY | CLI entry / error handling |
| [#9](https://github.com/dsiddharth2/plug/issues/9) | UI ghosts / double-renders after pressing install (also on uninstall) | TUI render lifecycle |
| [#10](https://github.com/dsiddharth2/plug/issues/10) | Skill installs overwrite each other — all skills write to `.claude/skills/SKILL.md` | Install / filesystem |
| [#11](https://github.com/dsiddharth2/plug/issues/11) | TUI: paste (Ctrl+V / Shift+Insert) doesn't work in text inputs | TUI input handling |

Execution order (by blast radius + dependency): **#8 → #10 → #9 → #11** — see PLAN.md.

---

## Issue #8 — `setRawMode EPERM` on non-TTY stdin

### Symptom (verbatim from issue)

```
ERROR  setRawMode EPERM
  at ReadStream.setRawMode (node:tty:81:24)
  at handleSetRawMode (node_modules/ink/src/components/App.tsx:167:11)
  at <anonymous> (node_modules/ink/src/hooks/use-input.ts:127:3)
...
The above error occurred in the <App> component:
    at App (src/tui/app.jsx:14:20)
```

### Root cause

`src/tui/app.jsx` uses Ink's `useInput`, which calls `process.stdin.setRawMode(true)` on mount. `setRawMode` requires a real TTY on stdin. Non-TTY contexts (Claude Code's Bash tool, CI, `plug | cat`, VS Code tasks, `plug < /dev/null`) fail with `EPERM` and dump a React/Ink stack trace.

### Fix (explicit — user-directed)

Add an **early guard** in the CLI entry point **before** `render(<App />)` is called. The guard must bail cleanly with a clear message naming the specific case this user hit (invocation from Claude Code's Bash tool, which is a non-TTY context).

**Exact code to add** (adjust import paths for the actual entry file — likely `bin/plug.js` or `src/index.js`):

```js
// Run before render(<App />). Works for both the Ink TUI path and any
// other code path that relies on raw mode.
if (!process.stdin.isTTY) {
  console.error(
    "plug requires an interactive terminal (TTY).\n" +
    "It cannot be rendered here — this looks like a non-TTY context such as:\n" +
    "  - Claude Code's Bash tool\n" +
    "  - a piped shell (e.g. `plug | cat`, `plug < /dev/null`)\n" +
    "  - a CI runner\n" +
    "  - a VS Code task runner\n" +
    "Run plug directly in a terminal (Windows Terminal, PowerShell, bash, etc.)."
  );
  process.exit(1);
}
```

**Placement rules:**
- Must fire **before** any `render(<App />)` call — otherwise Ink will have already tried `setRawMode` and thrown.
- Must fire for the interactive TUI invocation only. Any non-interactive subcommands (`plug --version`, `plug --help`, future `plug list` / `plug installed` scripting modes) must NOT be gated by this check. If all commands currently drop into the TUI, the guard is fine at the top of the entry. Once a non-TTY subcommand exists, move the guard inside the interactive-launch branch.

### Acceptance criteria

1. Running `plug < /dev/null` exits with code 1 and prints the guard message — no React/Ink stack trace.
2. Running `plug | cat` exits with code 1 and prints the guard message.
3. Running `plug` inside Claude Code's Bash tool exits with code 1 and prints the guard message.
4. Running `plug --version` still works (prints the `package.json` version) — the guard must not block non-interactive subcommands.
5. Running `plug` in a real terminal (PowerShell, Windows Terminal, bash) launches the TUI normally.

---

## Issue #9 — UI ghosts / double-renders after action→result transitions

### Symptom

After pressing `i` (install) in the Discover list, the "Install complete" screen renders **below** the existing list instead of replacing it — duplicated tab bar, duplicated outer frame, clipped bottom border. Same symptom reproduces on **uninstall** (user-confirmed, 2026-04-15) from the Installed tab. The bug is generic across action→result transitions, not install-specific.

### Captured visual (from issue #9)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [ Discover ]   Installed     Vaults                                          │

  [✓]   api-patterns · official · v1.0.0 [skill]
      Enforces consistent REST API design patterns
  ...
  [x] > error-handling · official · v1.0.0 [skill]
      Consistent error handling patterns across the project
┌──────────────────────────────────────────────────────────────────────────────┐   ← second frame drawn below, not replacing
│ [ Discover ]   Installed     Vaults                                          │   ← duplicate tab bar

    Install complete — 1 installed
    ...
│ ←/→ switch tab  ↑/↓ move  Enter detail  Space toggle  / search  i install  Esc exit │
└──────────────────────────────────────────────────────────────────────────────┘     ← bottom border of the original frame, new one is clipped
```

### Repro

**Install:** Launch `plug` → Discover → Space to toggle items → press `i` → observe stacked chrome.
**Uninstall:** Launch `plug` → Installed tab → Space to toggle items → trigger uninstall (verify current keybinding) → observe same stacked chrome.

### Hypotheses (from issue reporter — doer verifies empirically)

1. **Stacked siblings per screen.** Result view rendered alongside list rather than replacing it. Would have to be duplicated across Discover and Installed to explain both flows.
2. **Input-capture lock not unmounting the list.** The focus lock in `<App>` (originally cited at `src/tui/app.jsx:16`) may mount the result overlay without unmounting the list. Shared `<App>` concern — would explain both flows together.
3. **Ink not in fullscreen / alternate-screen mode.** ← **Strongest candidate.** If Ink's fullscreen renderer isn't enabled, tall lists scroll into terminal scrollback and new frames *append* rather than overwriting. A generic renderer-level bug most naturally explains why every action→result flow duplicates chrome.

### Fix shape (doer picks based on diagnosis)

- **(3) fullscreen mode:** enable Ink's alternate-screen / fullscreen mode at the TUI entry. **Must preserve PR #6's non-TTY guard behavior** (now reinforced by #8's guard). Verify on PowerShell, Windows Terminal, and Git Bash.
- **(1) stacked siblings:** normalize every list-screen into a state machine (`list` | `acting` | `actionResult`) with exactly one view per frame — lift into a shared helper, don't duplicate the pattern per screen.
- **(2) input-capture without unmount:** ensure the list unmounts when a result view is active, across every screen (fix at `<App>` level).

Prefer the smallest fix that resolves **all** action→result flows uniformly. Partial install-only fix is NOT acceptable.

### Acceptance criteria

1. Install flow fixed on Win11/PowerShell: result replaces list, no duplicated chrome, no clipped border.
2. Uninstall flow fixed on Win11/PowerShell: same.
3. Any other action→result flow audited (e.g. vault add/remove confirmations if present) — documented in commit message.
4. Keypress returns cleanly to originating list with no residual artifacts.
5. Cross-terminal smoke: install + uninstall both verified in one additional terminal (Windows Terminal or Git Bash). Documented in commit message.
6. No regressions in tab-switch, detail view (Enter), search (`/`), or Esc exit.
7. PR #6 (TTY) behavior preserved; #8's guard still fires on non-TTY.

---

## Issue #10 — Skill installs overwrite each other

### Symptom (verbatim from issue)

Installing multiple skills clobbers them into a single file. Every skill writes to `.claude/skills/SKILL.md`, so each new install overwrites the previous one. The TUI lists multiple skills as Installed, but only the last-installed skill exists on disk.

Observed:
```
$ ls .claude/skills
SKILL.md          # single file, contents = last-installed skill

$ head .claude/skills/SKILL.md
---
name: error-handling
description: Consistent error handling patterns ...
---
```

Commands path is fine — `code-review.md` lands at `.claude/commands/code-review.md` with its own filename. **Only the skills path is broken.**

### Root cause

The install writer uses a fixed path `.claude/skills/SKILL.md` for every skill, regardless of skill name.

### Fix (per issue reporter's suggestion — matches Claude Code user-level layout at `~/.claude/skills/<skill>/SKILL.md`)

1. Resolve skill install destination as `.claude/skills/<skill-name>/SKILL.md`. Create the subdirectory if missing.
2. Update the install manifest / TUI path display to match (`path` field in the install record must point at the per-skill subdir file, not the shared one).
3. **Migration of existing flat layout:** on next install, if `.claude/skills/SKILL.md` (flat file) exists, migrate it into `.claude/skills/<its-name>/SKILL.md` (read the frontmatter `name` field) before writing the new skill. If the name can't be parsed, leave the flat file alone and skip migration (log a warning).
4. If supporting files beyond `SKILL.md` exist (e.g. referenced scripts, templates), include them under the same per-skill subdir — doer verifies whether the current install writer handles any such files.

### Acceptance criteria

1. Installing `api-patterns`, `code-style`, `error-handling`, `code-review` into an empty project yields:
   ```
   .claude/commands/code-review.md
   .claude/skills/api-patterns/SKILL.md
   .claude/skills/code-style/SKILL.md
   .claude/skills/error-handling/SKILL.md
   ```
2. All three skill `SKILL.md` files contain their own content (not overwritten).
3. The Installed tab renders each skill's real per-skill path, not the shared one.
4. Claude Code discovers all three skills from the project after install (skill directory layout is a contract with Claude Code's loader).
5. Legacy flat `.claude/skills/SKILL.md` on a pre-existing project is migrated to the subdir layout on next install (or at least not worsened — doer decides based on parse-ability of existing frontmatter).
6. Commands path is unchanged (`.claude/commands/<name>.md`) — do not touch working code.
7. `npm test` green.

---

## Issue #11 — Paste doesn't work in TUI text inputs

### Symptom (verbatim from issue)

Pasting from the system clipboard into any text input in `plug` TUI does nothing. Blocks **Add Vault** (URL/token/path inputs are too long to type by hand), search, and any other free-form prompt.

Tested: Ctrl+V, Shift+Insert, right-click→Paste. Either no event fires or a stray control character is echoed. Environment: Windows 11 / PowerShell / Windows Terminal.

### Root cause (hypothesis — doer verifies)

Most TUI frameworks (Ink included) require **bracketed paste mode** to be explicitly enabled to receive paste as a single event. On Windows terminals, pastes arrive as a burst of key events; without bracketed paste, the input component either drops the burst or echoes stray control chars.

### Fix direction

1. Enable bracketed paste mode on TUI startup (check Ink's support — may require `ANSI ESC [ ? 2004 h` directly if Ink doesn't expose it). Reset the mode on exit.
2. Update the text input component(s) — likely the Add Vault input and the search (`/`) input — to handle a paste event (or a multi-char key burst) as a single insert rather than dropping it.
3. **Sanity-check step (doer does this first):** log raw key events on the Add Vault screen while pasting.
   - If **nothing arrives** → terminal mode isn't configured, fix is at the renderer/startup level.
   - If a **burst arrives but is dropped** → input handler needs a paste branch.
4. **Interaction with #9:** if #9 is fixed via Ink fullscreen / alt-screen mode, verify bracketed paste still works in that mode (alt-screen can affect input handling on some terminals).

### Acceptance criteria

1. Ctrl+V into the Add Vault input pastes clipboard contents as a single insert on Windows 11 / PowerShell (Windows Terminal host).
2. Shift+Insert has the same effect.
3. Paste works in every free-form text prompt in the TUI (search `/`, Add Vault, any auth/token inputs).
4. No stray control characters are echoed during paste.
5. Smoke-tested in at least one additional terminal (Git Bash OR plain PowerShell without Windows Terminal) — documented in commit message, including any known limitations (e.g. bracketed paste not supported in legacy `cmd.exe`).
6. No regressions in single-key input (typing, arrow keys, Enter, Esc).
7. Bracketed paste mode is properly reset on TUI exit (terminal left in a clean state — no leftover `?2004h` leaking into the user's shell).

---

## Cross-cutting constraints

- **PR #6 (TTY) + PR #7 (version-from-package.json) are load-bearing.** Every phase must preserve their behavior. `plug --version` must keep reading from `package.json`; non-TTY paths must stay guarded.
- **Windows is the canonical repro environment** for all four bugs. Every fix is verified on Win11/PowerShell first.
- **One commit per phase** (4 commits total on the feature branch), each referencing its issue number. Cleanup commit at end.
- **`npm test` must be green at every VERIFY checkpoint** — a phase doesn't end until tests pass.
- **Do not bump Ink, Node engines, or `package.json` version.** Out of scope.
- **PR title:** `sprint: UI and install bugfix batch (#8 #9 #10 #11)`. PR body must say `Closes #8`, `Closes #9`, `Closes #10`, `Closes #11`.
