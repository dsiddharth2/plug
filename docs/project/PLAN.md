# plug — Implementation Plan

> Batch-fix dsiddharth2/plug issues #8, #9, #10, #11 on branch `sprint/ui-and-install-fixes`. Four phases — each closes one issue with its own commit. Phase order is chosen so safer/independent fixes land first (#8 non-TTY guard, #10 skill path) before the TUI-render surgery (#9) and the input-handling work that depends on it (#11).

**Base branch:** main
**Feature branch:** `sprint/ui-and-install-fixes`

---

## Tasks

### Phase 1: Non-TTY guard (#8)

#### Task 1.1: Locate CLI entry and `render(<App />)` call sites
- **Change:** `git grep -n "render(" -- 'src/**' 'bin/**'` and `git grep -n "shebang\|#!/usr/bin/env" -- 'bin/**'` to find the CLI entry file and every place Ink's `render` is called. Confirm whether the entry is `bin/plug.js` calling into `src/index.js`, or `src/index.js` directly.
- **Files:** read-only — outputs the list of entry/render call sites into task notes.
- **Tier:** cheap
- **Done when:** task notes list the entry file(s) and every `render(<App />)` call site with line numbers.
- **Blockers:** none.

#### Task 1.2: Add non-TTY early guard
- **Change:** Add the guard below at the top of the CLI entry, **before** any `render(<App />)` call. If the entry dispatches subcommands (e.g. `--version`, `--help`), place the guard inside the interactive-launch branch only — non-interactive subcommands must not be gated. The exact code:
  ```js
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
- **Files:** whichever file holds the CLI entry (determined in 1.1) — likely `bin/plug.js` or `src/index.js`.
- **Tier:** standard
- **Done when:** guard is in place; `plug < /dev/null`, `plug | cat`, and `plug` run inside Claude Code's Bash tool all exit 1 with the guard message (no React/Ink stack trace); `plug --version` still prints `package.json` version; `plug` in a real terminal still launches the TUI.
- **Blockers:** none.

#### Task 1.3: Tests
- **Change:** Add a test that invokes the CLI with stdin set to a non-TTY stream (spawn child process with `stdio: ['pipe', 'pipe', 'pipe']`) and asserts exit code 1 + guard message on stderr. Add a smoke assertion that `plug --version` is unaffected.
- **Files:** `test/` (locate the vitest config and mirror existing CLI test conventions).
- **Tier:** standard
- **Done when:** new tests pass; `npm test` green.
- **Blockers:** if no existing CLI spawn-test harness exists, write the minimal one — do not attempt a broader test refactor.

#### VERIFY: Phase 1
- Run full `npm test` — zero new failures.
- Manually: `plug < /dev/null`, `plug | cat`, `plug` from Claude Code Bash tool all produce guard message + exit 1.
- Manually: `plug --version` still returns `package.json` version.
- Manually: `plug` in PowerShell launches the TUI normally.
- Commit: `fix: guard TUI against non-TTY stdin (#8)`. Push.

---

### Phase 2: Skill install path (#10)

#### Task 2.1: Locate skill install writer and manifest model
- **Change:** `git grep -n "\.claude/skills\|skills/SKILL\.md\|commands/.*\.md" -- 'src/**'` to find the install writer for skills and commands. Read both paths; confirm commands path works correctly (per-file `<name>.md`), confirm skills path uses a fixed `SKILL.md`. Identify the install manifest / install record (where the TUI reads installed-skill metadata from) and confirm the `path` field is currently the shared one.
- **Files:** read-only; outputs location of skill install writer, command install writer, and manifest reader into task notes.
- **Tier:** cheap
- **Done when:** task notes list: (a) the skill install writer path + line range, (b) the install manifest schema, (c) the TUI component that renders the Installed tab's path text for each skill.
- **Blockers:** none.

#### Task 2.2: Change skill destination to `<skill-name>/SKILL.md`
- **Change:** Update the skill install writer to resolve the destination as `.claude/skills/<skill-name>/SKILL.md`. Create the subdir with `fs.mkdirSync(path, { recursive: true })`. Commands path is untouched.
- **Files:** skill install writer (determined in 2.1).
- **Tier:** standard
- **Done when:** a fresh install of `api-patterns`, `code-style`, `error-handling`, `code-review` into an empty project produces:
  ```
  .claude/commands/code-review.md
  .claude/skills/api-patterns/SKILL.md
  .claude/skills/code-style/SKILL.md
  .claude/skills/error-handling/SKILL.md
  ```
  Each `SKILL.md` contains its own content (not overwritten).
- **Blockers:** none.

#### Task 2.3: Update install manifest + TUI path display
- **Change:** Wherever the install record stores `path`, write the new per-skill path. The TUI's Installed-tab path text must render the real on-disk path. Do not change how command paths are stored.
- **Files:** install manifest writer + TUI Installed tab renderer (determined in 2.1).
- **Tier:** standard
- **Done when:** the Installed tab shows distinct paths per skill (`.claude/skills/<name>/SKILL.md`), not the shared `.claude/skills/SKILL.md`.
- **Blockers:** none.

#### Task 2.4: Legacy layout migration
- **Change:** Before writing a new skill on install, check for a flat `.claude/skills/SKILL.md` left over from the old layout. If present, parse its frontmatter for `name`. If the name parses, create `.claude/skills/<name>/` and move the flat file into it as `SKILL.md`. Update the install manifest to point at the new path. If parsing fails, log a warning and leave the flat file alone (non-destructive).
- **Files:** skill install writer (same file as 2.2).
- **Tier:** standard
- **Done when:** on a project containing a pre-migration flat `.claude/skills/SKILL.md` with a parseable `name: foo` frontmatter, running an install of *any other skill* migrates the flat file into `.claude/skills/foo/SKILL.md` before writing the new one; a flat file with an unparseable frontmatter is left alone and a warning is logged.
- **Blockers:** none. Uses only `fs` + a minimal frontmatter parser (a regex for `^name:\s*(\S+)` in the first `---`-fenced block is acceptable — do not pull in a new dependency).

#### Task 2.5: Tests
- **Change:** Add install-path tests (unit-level if the install writer is easily unit-testable; otherwise a small integration test that invokes the install logic against a tmpdir). Cover: (a) fresh install of 3 skills produces 3 subdirs with correct content, (b) install alongside a legacy flat `SKILL.md` migrates it, (c) install with an unparseable flat `SKILL.md` leaves it alone.
- **Files:** `test/`.
- **Tier:** standard
- **Done when:** new tests pass; `npm test` green.
- **Blockers:** none.

#### VERIFY: Phase 2
- Run full `npm test` — zero new failures.
- Manually: install 3 skills + 1 command into a fresh empty project, confirm the on-disk layout matches the expected structure.
- Manually: verify the Installed tab in the TUI shows per-skill paths (launch `plug` in a real terminal).
- Manually: confirm Claude Code can load the skills from the project after install (drop a trivial one and see it appear in `/plugins`, if that's the discovery mechanism the project relies on).
- Commit: `fix: install skills into per-skill subdirs (#10)`. Push.

---

### Phase 3: TUI action→result double-render (#9)

#### Task 3.1: Reproduce both flows + capture diagnostic
- **Change:** Reproduce the install flow (Discover → Space → `i`) and the uninstall flow (Installed → Space → uninstall key) in a real terminal. For each, capture the pre-action and post-action frames (screenshot or terminal dump into task notes). Verify the stacked-chrome symptom matches the issue description.
- **Files:** read-only; outputs diagnostic notes.
- **Tier:** cheap
- **Done when:** task notes contain a confirmed repro for both flows with captured output, plus confirmation of which key binds to uninstall on the Installed tab.
- **Blockers:** requires running `plug` in a real terminal — doer must run this locally, not through Claude Code's Bash tool (which is now guarded by #8's fix).

#### Task 3.2: Determine root cause
- **Change:** Verify which of the three hypotheses in requirements.md actually apply:
  - **(3) no fullscreen / alt-screen mode** — check the `render(<App />)` call. If no `{ patchConsole }` / fullscreen option is set and the terminal is in the main buffer, this is the cause. A quick confirmation: check whether the ANSI alt-screen sequence (`ESC [?1049h`) is written on startup. If not, this is the bug.
  - **(1) stacked siblings** — check `src/tui/screens/discover.jsx` and `src/tui/screens/installed.jsx` (or current paths via `git ls-files src/tui`). Look for JSX that renders `{list}{resultView}` as siblings instead of switching.
  - **(2) input-capture without unmount** — check the `<App>` input-capture lock originally cited at `src/tui/app.jsx:16` (verify current line).
- **Files:** read-only; outputs the identified root cause(s) into task notes.
- **Tier:** premium
- **Done when:** task notes identify the root cause with evidence (which hypothesis, why — cite specific lines). Multiple hypotheses may apply; note all that do.
- **Blockers:** if none of the three hypotheses match, flag to PM and stop — do not improvise a fourth theory without alignment.

#### Task 3.3: Apply fix
- **Change:** Apply the minimal fix that resolves all action→result flows uniformly, based on 3.2's diagnosis:
  - **If (3):** enable Ink fullscreen / alt-screen at the TUI entry. Use Ink's documented API for the installed version. Write tests to cover the non-TTY path (now guarded by #8) so fullscreen mode does not bypass the guard.
  - **If (1):** lift the list↔result switching into a shared state-machine helper, used by Discover, Installed, and any other screen with action→result transitions. Do not duplicate the pattern per screen.
  - **If (2):** ensure the list unmounts when a result view is active, at the `<App>` level so all screens benefit.
- **Files:** TUI entrypoint and/or `src/tui/screens/*.jsx` (depends on 3.2).
- **Tier:** premium
- **Done when:** both install and uninstall result views **replace** their originating list; no duplicated chrome; outer frame not clipped.
- **Blockers:** if fullscreen mode (3) fix regresses #8 guard or PR #6 non-TTY behavior, stop — fallback to (1) or (2) instead.

#### Task 3.4: Audit other action→result flows
- **Change:** `git grep -n "Install complete\|Uninstall complete\|complete —\|successfully" -- 'src/tui/**'` to find any other action→result confirmation views (e.g. vault add/remove, sync complete). Verify each either benefits from the same fix or doesn't exhibit the bug.
- **Files:** read-only; outputs audit results into task notes and into the commit message.
- **Tier:** cheap
- **Done when:** audit results documented; any additional flows requiring the same fix are either fixed in this phase or explicitly listed as not-applicable with a one-line reason each.
- **Blockers:** none.

#### Task 3.5: Tests
- **Change:** Add a regression test for the double-render behavior. Exact shape depends on which fix was applied:
  - **(3):** assert that the render options include fullscreen / alt-screen mode.
  - **(1):** snapshot tests of Discover in `list` vs `actionResult` state — exactly one of the two views present in the snapshot.
  - **(2):** unmount assertion — after entering result view, the list component is no longer mounted.
  If snapshot testing the Ink tree requires infrastructure that doesn't exist, add a lightweight unit test instead and document the gap. Do not attempt a broader test-harness refactor.
- **Files:** `test/`.
- **Tier:** standard
- **Done when:** new tests pass; `npm test` green.
- **Blockers:** none.

#### VERIFY: Phase 3
- Run full `npm test` — zero new failures.
- Manually: install flow on Win11/PowerShell — clean result→list transition.
- Manually: uninstall flow on Win11/PowerShell — clean transition.
- Manually: repeat install + uninstall in Windows Terminal OR Git Bash.
- Manually: tab-switch (Discover ↔ Installed ↔ Vaults), detail (Enter), search (`/`), Esc exit — all still work.
- Manually: `plug < /dev/null` still fires #8's guard (no regression of Phase 1).
- Commit: `fix: replace list on TUI action result views (#9)`. Push.

---

### Phase 4: Paste in TUI text inputs (#11)

#### Task 4.1: Diagnostic — raw key event dump
- **Change:** Temporarily instrument the Add Vault input (or the nearest free-form text input) to log raw key events to stderr or a file. Paste via Ctrl+V and Shift+Insert in Windows 11 / PowerShell (Windows Terminal host). Record what arrives:
  - **Nothing** → terminal mode (bracketed paste) not configured.
  - **Burst of per-char events** → input handler is dropping the burst.
  - **Stray control chars** → partial capture, likely a mix of the two.
  Remove the instrumentation after the diagnostic.
- **Files:** Add Vault input component (located via `git grep -n "Add Vault" -- 'src/tui/**'` or similar).
- **Tier:** standard
- **Done when:** task notes contain the raw-event observation for both Ctrl+V and Shift+Insert.
- **Blockers:** none.

#### Task 4.2: Enable bracketed paste mode + handle paste events
- **Change:** Based on 4.1:
  - **If nothing arrives:** emit `\x1b[?2004h` on TUI startup to enable bracketed paste; emit `\x1b[?2004l` on exit. Check if Ink exposes a helper for this; if not, write directly to `process.stdout.write`. Register a paste handler that collects the `\x1b[200~...\x1b[201~` wrapped payload as a single insert.
  - **If burst arrives but is dropped:** add a paste branch to the input handler that accumulates multi-char bursts within a short window (e.g. 50ms) into a single insert.
- **Files:** TUI entrypoint (mode setup/teardown) + the text input component(s).
- **Tier:** premium
- **Done when:** Ctrl+V and Shift+Insert paste clipboard contents as a single insert in the Add Vault input on Win11/PowerShell (Windows Terminal).
- **Blockers:** Phase 3's fix may interact — if fullscreen / alt-screen mode affects bracketed paste delivery, adjust startup sequence ordering (enable bracketed paste *after* entering alt-screen).

#### Task 4.3: Cover every free-form input
- **Change:** Find every `<TextInput>` / free-form prompt in the TUI (`git grep -n "TextInput\|useInput.*text" -- 'src/tui/**'`). Verify paste works in each. Typical call sites: search (`/`), Add Vault, any auth/token prompt. If multiple input components exist, consolidate the paste handling into a shared helper rather than patching each in place.
- **Files:** every input component site.
- **Tier:** standard
- **Done when:** paste works in every free-form input the TUI exposes.
- **Blockers:** none.

#### Task 4.4: Clean exit — reset terminal mode
- **Change:** On TUI exit (normal quit, Ctrl+C, `--version` path that briefly enters TUI if any), emit `\x1b[?2004l` to reset bracketed paste mode. Confirm the user's shell is left clean after exit (run `plug`, quit, then echo something — no `?2004h` leaking). Apply the same hygiene pattern for alt-screen mode if Phase 3 enabled it (and wasn't already doing so).
- **Files:** TUI entrypoint (shutdown/teardown path).
- **Tier:** standard
- **Done when:** after exiting `plug`, the shell behaves normally — no stray escape sequences, no mode leakage.
- **Blockers:** none.

#### Task 4.5: Tests + cross-terminal smoke
- **Change:** Add a unit test for the paste-handling path (simulate the bracketed paste or multi-char burst and assert the input receives a single insert). Manually smoke-test paste in a second terminal beyond Windows Terminal — Git Bash OR plain PowerShell (legacy host). Document results and any known limitations (e.g. legacy `cmd.exe` without bracketed paste support) in the commit message.
- **Files:** `test/` + task notes.
- **Tier:** standard
- **Done when:** new test passes; `npm test` green; manual smoke in second terminal documented.
- **Blockers:** none.

#### VERIFY: Phase 4
- Run full `npm test` — zero new failures.
- Manually: paste via Ctrl+V and Shift+Insert in Add Vault — single insert, no stray chars.
- Manually: paste into search (`/`) — same.
- Manually: all single-key input (typing, arrows, Enter, Esc) still works.
- Manually: exit `plug` cleanly; shell is left in a clean state (no `?2004h` leak).
- Manually: cross-terminal smoke in Git Bash or legacy PowerShell.
- Manually: all prior phases still green (spot-check #8 guard, install layout, #9 no double-render).
- Commit: `fix: enable paste in TUI text inputs (#11)`. Push.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Phase 3's fullscreen fix regresses #8's non-TTY guard or PR #6's TTY handling | HIGH | Explicit VERIFY step in Phase 3 re-runs `plug < /dev/null` to confirm the guard still fires. Fallback to hypothesis (1) or (2) if (3) is incompatible. |
| Phase 4's bracketed paste interacts badly with Phase 3's alt-screen mode | MED | Do Phase 4 AFTER Phase 3 is merged/stable on-branch. Order bracketed-paste enable AFTER alt-screen enter; reset in reverse order. |
| Phase 2's migration of flat `SKILL.md` mis-parses frontmatter and loses data | MED | Migration is conservative: only move if `name:` frontmatter parses cleanly; otherwise leave the flat file and log a warning. Covered by a dedicated test. |
| PR #7 (version-from-package.json) accidentally regressed by any phase | LOW | Each phase's VERIFY includes a `plug --version` spot-check. |
| Windows-only bugs reproduce only in specific terminal hosts (PowerShell vs Windows Terminal vs Git Bash vs cmd.exe) | MED | Every manual verification step names the terminal; PR description lists terminals verified per issue. cmd.exe and ConEmu are explicitly noted as best-effort, not blocking. |
| Line numbers cited in issues have drifted from current main | LOW | Every task that cites a line starts with `git grep` / `git ls-files` to find the actual current site. |
| Doer tries to bump Ink to get fullscreen/paste APIs | MED | Requirements.md explicitly forbids Ink bump. If a current-Ink-version path isn't available, fall back to direct ANSI writes (alt-screen + bracketed paste) rather than bumping the dep. |
| Scope creep into the LOW backlog items in status.md | MED | Explicit out-of-scope statement in requirements.md. Reviewer enforces at review time. |

---

## Notes

- Each phase commits exactly once on `sprint/ui-and-install-fixes`, message referencing its issue number.
- VERIFY tasks are checkpoints — doer stops after each phase, PM dispatches reviewer before the next phase begins.
- Per feedback: fleet member commits on feature branches are pre-approved for the duration of this sprint.
- Base branch: `main`. Rebase on top of origin/main before the PR if main has moved.
- At sprint completion: PR title `sprint: UI and install bugfix batch (#8 #9 #10 #11)`; body references `Closes #8`, `Closes #9`, `Closes #10`, `Closes #11`.
