# Doc Harvest Review

**Verdict:** APPROVED
**Commits reviewed:** faf6f3a, c8037e6
**Scope:** Doc harvest durability + accuracy

## HIGH
- (none)

## MEDIUM
- (none)

## LOW
- `docs/features/tui.md` (alt-screen teardown note): "Both registrations are harmless because the ANSI writes are idempotent." Idempotent is technically inaccurate — writing `\x1b[?2004l` twice is harmless but not idempotent in the strict sense (idempotent means f(f(x))=f(x); a terminal escape write has side effects). Better phrasing: "safe to call multiple times." No behaviour impact; wording only.
- `docs/features/tui.md` (alt-screen section): "Bumping Ink would have broken the TTY fix in PR #6 and other integrations." — mentions PR #6 without explaining what the fix was. `docs/decisions.md` handles this better: it parenthetically explains "(which depends on Ink's specific signal-exit integration)". The tui.md reference is a bare PR number with no context for a reader who hasn't seen decisions.md.

## Notes

- **docs/architecture.md (Terminal buffer management):** PASS. Enter/leave ordering (`alt-screen → bracketed paste` / `bracketed paste → alt-screen`) verified against `src/index.js` lines 72–82. Cross-reference to `docs/decisions.md` resolves correctly.
- **docs/decisions.md (Why direct ANSI sequences instead of Ink `fullScreen`):** PASS. Technical reasoning verified: Ink 5.2.1 has no `fullScreen` option; direct ANSI sequences are applied in `launchTui()`; PR #6 context explained clearly here.
- **docs/features/tui.md (alt-screen + bracketed paste sections):** PASS with LOW nits above. Ordering claims verified against source. Teardown registration on `process.on('exit')` and `waitUntilExit().then()` both confirmed in `src/index.js`.
- **docs/features/non-tty-guard.md:** PASS. Guard placement confirmed: first statement in `launchTui()`, before `resolveStdin()`, alt-screen entry, and `render()`. Code snippet in doc matches `src/index.js` exactly. Routing table (`plug` → no parse → launchTui; `plug tui` → program.parse → launchTui; `plug install` → program.parse → no guard) is accurate. Test description (spawns with `stdio: ['pipe', 'pipe', 'pipe']`) is an accurate characterisation of the test strategy.
- **docs/features/paste.md:** PASS. ANSI sequences correct. Lifecycle (enter after alt-screen, disable before alt-screen leave) matches source. `usePaste` hook description — accumulation across chunk boundaries, multiple paste sequences per chunk, `isActive` suspension, effect cleanup return — all verified against `src/tui/hooks/use-paste.js`. `SearchBox` uses `usePaste(handlePaste, { isActive: focused })` ✓. `AddVaultForm` (in `src/tui/screens/vaults.jsx`) uses `usePaste` without an explicit `isActive`, defaulting to `true` while mounted ✓. Terminal compatibility table is accurate.
- **docs/features/skills-install.md:** PASS. Per-skill subdir routing (`type === 'skill'` → `.claude/skills/<pkgName>/SKILL.md`, otherwise flat by type) matches `src/commands/install.js` lines 159–169. `ensureDir` wraps `fs.mkdir` with `{ recursive: true }` confirmed in `src/utils/paths.js`. Legacy migration flow (readFile → parse frontmatter regex → extract `name:` → rename → update manifest) matches `migrateLegacyFlatSkillFile()` exactly. Non-destructive fallback on unparseable frontmatter confirmed via two `console.warn + return` paths.

**Transients audit:** Clean. No Phase numbers, no PLAN.md references, no commit SHAs, no feedback-file references, no PM/fleet references found in any of the six files.

**Cross-reference audit:** All inter-doc links resolve. `architecture.md → decisions.md` ✓. `decisions.md → src/index.js, docs/features/paste.md` ✓. `tui.md → paste.md` ✓. No dead references.

**Code-accuracy audit:** All four cross-checked claims verified against src/:
- Non-TTY guard inside `launchTui()` before `resolveStdin()` ✓ (`src/index.js:47`)
- Alt-screen enter → bracketed paste enter; bracketed paste leave → alt-screen leave ✓ (`src/index.js:72–82`)
- Skills install to `.claude/skills/<name>/SKILL.md` with legacy migration ✓ (`src/commands/install.js:159–167`, `222–267`)
- `SearchBox` and `AddVaultForm` consume `usePaste` ✓ (`src/tui/components/search-box.jsx:41`, `src/tui/screens/vaults.jsx:393`)
