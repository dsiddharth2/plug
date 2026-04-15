# PlugVault TUI — Implementation Plan

> Add a full-screen interactive TUI to the existing plug CLI, replicating the `/plugins` experience from Claude Code. User launches with `! plug` from Claude Code and gets instant, keyboard-driven package management.

## Context

The plug CLI (`C:\2_WorkSpace\Plug\plug-doer\plug\`) already has all core logic:
- `src/utils/registry.js` — fetch registry, find packages, caching
- `src/utils/tracker.js` — installed.json tracking
- `src/utils/config.js` — vault config management
- `src/utils/fetcher.js` — GitHub file downloads
- `src/utils/auth.js` — token resolution
- `src/utils/paths.js` — path resolution
- `src/commands/` — install, remove, search, list, update, vault

**What's missing:** A full-screen TUI. Currently uses Commander + plain text output. We need an Ink (React for terminals) interface that matches `/plugins`.

## Target UX

See `roadmap/tui-plan.md` for exact screen maps, keyboard controls, and all UI states per tab (Discover, Installed, Vaults). The detailed wireframes there are the source of truth for UI behavior.

### Tab Screens

| Tab | Content | Maps to existing code |
|-----|---------|----------------------|
| **Discover** | All packages from all vaults, live search, toggle to install | `registry.js` → `fetchRegistry()`, `findAllPackages()` |
| **Installed** | Packages from installed.json (both scopes), update/remove actions | `tracker.js` → `getInstalled()`, `commands/update.js`, `commands/remove.js` |
| **Vaults** | Vault list, add/remove/set-default | `config.js` → `getConfig()`, `commands/vault.js` |

### Keyboard Controls

| Key | Action | Context |
|-----|--------|---------|
| `←` `→` | Switch tabs | Global |
| `↑` `↓` | Move cursor in list | Any list |
| `Enter` | Open detail panel for selected package | Discover, Installed |
| `Space` | Toggle select/deselect for batch install/remove | Discover, Installed |
| `Esc` | Back (close detail → list → exit) | Global |
| Type any char | Live filter search (appends to search box) | Discover, Installed |
| `Backspace` | Delete last search char | When search active |
| `i` | Install selected packages | Discover (when items toggled, search not focused) |
| `u` | Update selected packages | Installed (when items toggled, search not focused) |
| `r` | Remove selected packages | Installed (when items toggled, search not focused) |
| `s` | Sync all vault registries | Vaults tab |
| `a` | Add new vault | Vaults tab |
| `d` | Set selected vault as default | Vaults tab |
| `/` | Focus search box (disables action keys) | Discover, Installed |

**Keyboard conflict resolution:** Action keys (`i`, `u`, `r`) are only active when (a) at least one item is toggled AND (b) the search box is not focused. Typing `/` focuses the search box, enabling type-to-search. `Esc` unfocuses search (returns to list navigation mode where action keys work). This prevents the conflict where pressing `i` during search would trigger install instead of typing the letter.

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| TUI framework | **Ink 5.x** (React for terminals) | Same stack as Claude Code's `/plugins`, existing Node.js project |
| Layout | **ink-box**, flexbox via Ink | Tabs, panels, lists |
| Input handling | **ink-use-input** hook | Keyboard events |
| Styling | **chalk** (already a dependency) | Colors, bold, dim |
| Core logic | **Existing `src/utils/` and `src/commands/`** | Zero rewrite |

## File Structure

```
plug/
├── src/
│   ├── index.js                    # Existing CLI entry (commander) — ADD: `plug tui` subcommand
│   ├── commands/                   # Existing — no changes
│   ├── utils/                      # Existing — no changes
│   └── tui/                        # NEW — all TUI code
│       ├── app.jsx                 # Root <App /> component — tab router, error boundary
│       ├── utils/
│       │   └── capture-stdout.js   # Stdout/stderr wrapper for existing commands
│       ├── hooks/
│       │   ├── use-packages.js     # Fetch + cache packages from all vaults
│       │   ├── use-installed.js    # Read installed.json (both scopes)
│       │   ├── use-search.js       # Live filter logic over package list
│       │   └── use-vaults.js       # Read vault config
│       ├── components/
│       │   ├── tab-bar.jsx         # Horizontal tab strip — Discover | Installed | Vaults
│       │   ├── package-list.jsx    # Scrollable list with cursor, toggle, search
│       │   ├── package-item.jsx    # Single row: name · vault · installs + description
│       │   ├── package-detail.jsx  # Full detail panel (Enter on a package)
│       │   ├── install-progress.jsx # Per-package install progress with spinner/checkmark
│       │   ├── install-complete.jsx # Install summary with paths and usage hints
│       │   ├── search-box.jsx      # Search... input with live filtering (activated by /)
│       │   ├── status-line.jsx     # "Discover plugins (1/24)" context line
│       │   ├── hotkey-bar.jsx      # Bottom bar: "type to search · Space to toggle · ..."
│       │   ├── vault-list.jsx      # Vault management screen
│       │   └── spinner.jsx         # Loading indicator for fetches
│       └── screens/
│           ├── discover.jsx        # Discover tab — package-list + search + install action
│           ├── installed.jsx       # Installed tab — package-list + update/remove actions
│           └── vaults.jsx          # Vaults tab — vault-list + add/remove
├── bin/
│   └── plug.js                     # Existing — no changes (commander entry)
├── package.json                    # ADD: ink, react, ink-use-input deps
└── tests/
    └── tui/                        # NEW — TUI component tests
        ├── tab-bar.test.jsx
        ├── package-list.test.jsx
        ├── discover.test.jsx
        └── installed.test.jsx
```

## Entry Point

When the user runs `plug` with no arguments (or `plug tui`), launch the TUI instead of showing commander help:

```js
// src/index.js — modify default action
if (process.argv.length === 2) {
  // No subcommand — launch TUI
  const { render } = await import('ink');
  const { default: App } = await import('./tui/app.jsx');
  render(<App />);
} else {
  // Existing commander CLI for scripting: plug install X, plug search X, etc.
  program.parse();
}
```

This preserves the existing CLI for scripting (`plug install code-review`) while adding the TUI for interactive use (`! plug`).

---

## Tasks

### Phase 0: Clean Up Old Skill Implementation

#### Task 0.1: Remove old skill files from repo
- **Change:** Delete the entire `skill/` directory (SKILL.md, references/, install.sh, uninstall.sh). Delete old project tracking files: `PLAN.md`, `progress.json`, `feedback.md`. Delete old design spec: `roadmap/skill-redesign-plan.md`.
- **Files to delete:** `skill/` (entire directory), `PLAN.md`, `progress.json`, `feedback.md`, `roadmap/skill-redesign-plan.md`
- **Tier:** cheap
- **Done when:** None of the old skill-redesign files remain in the repo. Existing CLI (`plug install`, `plug search`, etc.) still works. All 186 existing tests pass.
- **Blockers:** None

#### Task 0.2: Remove installed skill copies from user home
- **Change:** Delete the installed plug skill directory at `~/.claude/skills/plug/` (SKILL.md + references/).
- **Files to delete:** `~/.claude/skills/plug/` (entire directory)
- **Tier:** cheap
- **Done when:** `~/.claude/skills/plug/` no longer exists.
- **Blockers:** None

#### VERIFY: Phase 0 — Cleanup
- No `skill/` directory in repo
- No old PLAN.md, progress.json, feedback.md, or skill-redesign-plan.md in repo
- No `~/.claude/skills/plug/` directory
- Existing CLI commands still work
- All 186 existing tests pass
- Push to `feat/tui` branch

---

### Phase 1: TUI Foundation

#### Task 1.1: Add Ink dependencies and JSX support
- **Change:** Add `ink`, `react`, `ink-use-input` to package.json. Configure JSX transform (either via `@babel/register` with JSX runtime or switch to ink's built-in JSX support). Add `plug tui` command and default no-arg behavior to launch TUI.
- **Files:** `package.json`, `src/index.js`
- **Tier:** standard
- **Done when:** `node bin/plug.js` with no args renders a blank Ink app that shows "PlugVault" and exits cleanly on Esc. `node bin/plug.js install code-review` still works (existing CLI preserved). All 186 existing tests pass.
- **Blockers:** None

#### Task 1.2: Create tab-bar and app shell
- **Change:** Create `src/tui/app.jsx` with tab routing state (activeTab). Create `src/tui/components/tab-bar.jsx` rendering horizontal tabs: Discover | Installed | Vaults. Left/right arrow keys switch tabs. Active tab is highlighted (inverse/bold). Create `src/tui/components/hotkey-bar.jsx` showing context-sensitive key hints at the bottom.
- **Files:** `src/tui/app.jsx`, `src/tui/components/tab-bar.jsx`, `src/tui/components/hotkey-bar.jsx`
- **Tier:** standard
- **Done when:** Running `plug` shows the tab bar with 3 tabs, arrow keys switch between them, active tab visually highlighted, bottom bar shows key hints, Esc exits cleanly.
- **Blockers:** 1.1

#### Task 1.3: Create package-list and package-item components
- **Change:** Create `src/tui/components/package-list.jsx` — a scrollable list with cursor tracking (up/down arrows), viewport windowing (only render visible rows based on terminal height), scroll indicators (more above / more below). Create `src/tui/components/package-item.jsx` — single package row rendering: `> name · vault-name · version` on line 1, `  description truncated to terminal width...` on line 2. Selected item has `>` cursor and bold name. Space toggles a checkbox `[x]` for batch operations.
- **Files:** `src/tui/components/package-list.jsx`, `src/tui/components/package-item.jsx`
- **Tier:** standard
- **Done when:** Package list renders with mock data, cursor moves up/down, list scrolls when cursor exceeds viewport, space toggles selection, scroll indicators appear when list overflows.
- **Blockers:** 1.1

#### VERIFY: Phase 1 — TUI Foundation
- Ink renders without errors
- Tab bar switches tabs with arrow keys
- Package list scrolls and selects
- Existing CLI commands still work
- All 186 existing tests pass
- Push to `feat/tui` branch

---

### Phase 2: Discover Screen

#### Task 2.1: Create use-packages hook, stdout wrapper, and Discover screen
- **Change:** Create `src/tui/utils/capture-stdout.js` — a wrapper that intercepts stdout/stderr writes from existing command functions during Ink rendering. Existing commands (`runInstall`, `runRemove`, `runUpdate`, etc.) write directly to stdout which corrupts Ink's terminal rendering. The wrapper temporarily redirects `process.stdout.write` and `process.stderr.write` while a command runs, captures the output, and returns it as a string for the TUI to display in its own components. Create `src/tui/hooks/use-packages.js` — calls existing `fetchRegistry()` from `src/utils/registry.js` for each vault in resolve_order, merges results into a flat array of `{ name, type, version, vault, description, tags, installs }`, exposes loading/error states. Create `src/tui/screens/discover.jsx` — wires use-packages into package-list, shows status line "Discover plugins (cursor/total)", shows spinner while loading.
- **Files:** `src/tui/utils/capture-stdout.js`, `src/tui/hooks/use-packages.js`, `src/tui/screens/discover.jsx`, `src/tui/components/status-line.jsx`, `src/tui/components/spinner.jsx`
- **Tier:** standard
- **Done when:** stdout wrapper captures command output without corrupting Ink rendering. Discover tab fetches real packages from the official vault, displays them in the scrollable list with name/vault/description (including `[agent]` type badge for agent packages), shows loading spinner during fetch, shows error state if fetch fails.
- **Blockers:** 1.2, 1.3

#### Task 2.2: Create search-box with live filtering
- **Change:** Create `src/tui/components/search-box.jsx` — renders `Search...` placeholder, activated by pressing `/`. When focused, captures keystrokes (any printable char appends, backspace deletes), displays typed query. `Esc` unfocuses search box and returns to list navigation mode. Create `src/tui/hooks/use-search.js` — takes full package list + search query, returns filtered list using the existing scoring algorithm from `src/commands/search.js` (exact name 40, partial 30, description 20, tag 10), sorted by score descending. Wire into Discover screen. **Important:** Before implementing, verify that the search scoring logic in `src/commands/search.js` is importable as a pure function. If it's embedded inside a command handler that writes to stdout, extract it into a shared utility first.
- **Files:** `src/tui/components/search-box.jsx`, `src/tui/hooks/use-search.js`, update `src/tui/screens/discover.jsx`
- **Tier:** standard
- **Done when:** `/` focuses search, typing live-filters the package list, results re-sort by relevance score, `Esc` unfocuses search, clearing search restores full list, status line updates count to reflect filtered results. Action keys (`i`/`u`/`r`) do not fire while search is focused.
- **Blockers:** 2.1

#### Task 2.3: Create package-detail panel, install action, and progress screens
- **Change:** Create `src/tui/components/package-detail.jsx` — full detail view shown when user presses Enter on a package. Shows: name, description (full), type, version, vault, tags, entry file, install-to path, [Install] action. Esc returns to list. Create `src/tui/components/install-progress.jsx` — shows "Installing N packages..." with per-package spinner/checkmark progress. Create `src/tui/components/install-complete.jsx` — shows "Installed N packages" summary with file paths and usage hints (e.g. "Use /code-review to run the command", "The superpowers skill will auto-activate when relevant"). Implement install action using stdout wrapper from Task 2.1: calls existing `runInstall()`, captures output, shows progress, updates installed state. Implement batch install: when items are toggled with Space, pressing `i` installs all selected (only active when search is not focused).
- **Files:** `src/tui/components/package-detail.jsx`, `src/tui/components/install-progress.jsx`, `src/tui/components/install-complete.jsx`, update `src/tui/screens/discover.jsx`
- **Tier:** standard
- **Done when:** Enter opens detail panel with full package info (including entry/path), Esc returns to list. Install shows per-package progress with spinner/checkmark. Install-complete shows summary with paths and usage hints. Batch select + `i` installs multiple. All package types (skill, command, agent) render correctly. Installed packages show a checkmark in the list.
- **Blockers:** 2.1

#### VERIFY: Phase 2 — Discover Screen
- Discover tab fetches and displays real packages
- All package types (skill, command, agent) render with correct badges
- stdout wrapper prevents command output from corrupting Ink rendering
- `/` focuses search, live-filters and re-sorts; `Esc` unfocuses
- Action keys (`i`) only active when items toggled and search unfocused
- Detail panel shows full info including entry and install-to path
- Install progress shows per-package spinner/checkmark
- Install complete shows summary with paths and usage hints
- Batch install works
- Installed packages marked in list
- Push to `feat/tui` branch

---

### Phase 3: Installed & Vaults Screens

#### Task 3.1: Create Installed screen with update/remove
- **Change:** Create `src/tui/hooks/use-installed.js` — reads installed.json from both scopes (local + global) using existing `getInstalled()`, merges with scope labels. Create `src/tui/screens/installed.jsx` — package-list showing installed packages with scope badge (`[local]`/`[global]`), type badge (`[skill]`/`[command]`/`[agent]`), version, vault, and **file path on line 2** (not description — per tui-plan.md spec, installed items show their install path e.g. `.claude/commands/code-review.md`). The `package-item` component needs a `mode` prop or the Installed screen needs a custom item renderer to display path instead of description. Show update-available indicator when newer version exists (`v1.2.0 → v1.3.0 ⬆`). Status line "Installed plugins (cursor/total) — N updates available". Actions: Enter for detail (shows full info + Update/Remove buttons), Space to toggle, `u` to update selected (calls existing `runUpdate()` via stdout wrapper), `r` to remove selected (calls existing `runRemove()` via stdout wrapper). Show confirmation dialog before remove per tui-plan.md wireframe.
- **Files:** `src/tui/hooks/use-installed.js`, `src/tui/screens/installed.jsx`
- **Tier:** standard
- **Done when:** Installed tab shows all installed packages from both scopes with file paths on line 2, scope/type badges, update-available indicators. Update checks for newer versions and updates tracking. Remove shows confirmation then deletes and updates tracking. All package types (skill, command, agent) render correctly. List refreshes after actions.
- **Blockers:** 1.2, 1.3

#### Task 3.2: Create Vaults screen with sync and add form
- **Change:** Create `src/tui/hooks/use-vaults.js` — reads vault config using existing `getConfig()`, enriches each vault with metadata: package count (from cached registry), public/private status, last sync time, and GitHub URL. Create `src/tui/screens/vaults.jsx` — list of configured vaults showing name/owner/repo/branch, default star indicator, package count, public/private, last sync time, and GitHub URL on line 2. Actions: `a` to add vault — sequential inline prompts for vault name, GitHub owner, GitHub repo, branch (default: main), private toggle. After input, run connectivity check (fetch registry from the new vault) and show result. `r` to remove selected vault (with safety check: official vault cannot be removed). `d` to set selected as default. `s` to sync all vault registries — shows per-vault progress with spinner/checkmark and package count update. Calls existing vault command functions via stdout wrapper.
- **Files:** `src/tui/hooks/use-vaults.js`, `src/tui/screens/vaults.jsx`
- **Tier:** standard
- **Done when:** Vaults tab shows all configured vaults with metadata (package count, public/private, last sync, URL). Add vault flow prompts sequentially, runs connectivity check, confirms success. Remove protects official vault. Set-default works. Sync (`s`) refreshes all vaults with progress. Vault list refreshes after all changes. Empty state shows helpful message when no custom vaults configured.
- **Blockers:** 1.2

#### VERIFY: Phase 3 — Installed & Vaults Screens
- All 3 tabs fully functional
- Installed tab shows file paths (not descriptions) on line 2
- All package types (skill, command, agent) render with correct badges in both Discover and Installed
- Update-available indicator shows when newer versions exist
- Install/update/remove operations work end-to-end via stdout wrapper
- Remove shows confirmation dialog before proceeding
- Vault sync (`s`) refreshes registries with per-vault progress
- Vault add flow runs connectivity check
- Vault metadata displayed (package count, public/private, last sync, URL)
- Official vault protected from removal
- Push to `feat/tui` branch

---

### Phase 4: Polish & Distribution

#### Task 4.1: Terminal resize handling and edge cases
- **Change:** Handle terminal resize (Ink's `useStdout` for dimensions, re-render on resize). Handle edge cases: empty vault (no packages), no vaults configured, no internet (show cached if available, error if not), zero search results message. Truncate long descriptions to terminal width. Ensure clean exit (no dangling listeners, proper Ink unmount).
- **Files:** Multiple TUI files
- **Tier:** standard
- **Done when:** TUI adapts to terminal resize, all empty/error states have user-friendly messages, no crashes on edge cases, clean exit on Esc/Ctrl+C.
- **Blockers:** 3.2

#### Task 4.2: TUI tests
- **Change:** Add tests for TUI components using `ink-testing-library`. Test: tab switching, package list cursor movement, search filtering, install/remove actions (mocked). Keep tests focused on behavior, not pixel-perfect rendering.
- **Files:** `tests/tui/tab-bar.test.jsx`, `tests/tui/package-list.test.jsx`, `tests/tui/discover.test.jsx`, `tests/tui/installed.test.jsx`
- **Tier:** standard
- **Done when:** At least 12 TUI tests covering: tab navigation, list scrolling, search filter, install action, remove action, empty states. All pass alongside existing 186 tests.
- **Blockers:** 3.2

#### Task 4.3: Update README, npm publish prep, and GitHub Actions workflow
- **Change:** Update plug/README.md: add TUI screenshots, document `! plug` usage from Claude Code, update feature list. Ensure `bin/plug.js` entry point works for both `npx plugvault` and `! plug`. Bump version in package.json. Add `files` field to package.json to include `src/tui/` directory. Create `.github/workflows/publish.yml` — triggered on GitHub Release (published). Runs tests first, then publishes to npm using `NPM_TOKEN` secret. Workflow: checkout → setup Node 20 → npm ci → npm test → npm publish. Only runs on release events, not on push/PR (CI already covers that in `ci.yml`).
- **Files:** `README.md`, `package.json`, `.github/workflows/publish.yml`
- **Tier:** cheap
- **Done when:** README documents TUI usage, `npx plugvault` launches TUI, version bumped, `files` field includes `src/`, `bin/`. Workflow file exists, is valid YAML, uses `NPM_TOKEN` secret for auth, runs tests before publish, triggers only on release published event. Manual step: add `NPM_TOKEN` secret to GitHub repo settings.
- **Blockers:** 4.2

#### VERIFY: Phase 4 — Polish & Distribution
- All edge cases handled (empty states, no internet, resize, clean exit)
- 12+ TUI tests passing
- README updated with TUI usage
- Publish workflow in place and valid YAML
- Full regression: all existing + new tests pass
- Push to `feat/tui` branch
- Ready for PR
- **Manual after merge:** Create GitHub Release → workflow auto-publishes to npm

---

## Commit Strategy

One commit per phase (per project convention):
0. `chore: remove old skill-redesign implementation`
1. `feat: add Ink TUI foundation — tab bar, package list, hotkey bar`
2. `feat: add Discover screen — live search, detail panel, install`
3. `feat: add Installed and Vaults screens — update, remove, vault management`
4. `feat: add TUI polish — resize handling, edge cases, tests, publish workflow`

---

## What We Reuse vs. What We Build

| Existing (no changes) | New (TUI layer) |
|------------------------|-----------------|
| `src/utils/registry.js` — fetch + cache | `src/tui/app.jsx` — root component |
| `src/utils/tracker.js` — installed tracking | `src/tui/screens/` — 3 tab screens |
| `src/utils/config.js` — vault config | `src/tui/components/` — 9 UI components |
| `src/utils/fetcher.js` — GitHub downloads | `src/tui/hooks/` — 4 data hooks |
| `src/utils/auth.js` — token resolution | `tests/tui/` — component tests |
| `src/utils/paths.js` — path resolution | |
| `src/commands/install.js` — install logic | |
| `src/commands/remove.js` — remove logic | |
| `src/commands/update.js` — update logic | |
| `src/commands/search.js` — scoring algorithm | |
| `src/commands/vault.js` — vault CRUD | |
| All 186 existing tests | |

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Ink 5.x JSX transform conflicts with existing Commander CLI | Medium | High | Task 1.1 validates coexistence before building more TUI code |
| Terminal rendering differences across Windows/Mac/Linux | Medium | Medium | Test on Windows (primary dev env); Ink abstracts most terminal differences |
| Existing command functions have side effects (stdout writes) that interfere with Ink rendering | Medium | High | Wrap existing commands — capture stdout during Ink rendering, only use return values |
| Large registry fetches slow down TUI startup | Low | Medium | use-packages hook shows spinner; existing registry.js has caching |
| ink-testing-library incompatible with current test runner (vitest/jest) | Low | Medium | Validate in Task 4.2 early; fall back to testing hooks directly if needed |
| Keyboard input conflict between search and action keys | High | Medium | Resolved: `/` focuses search (disables action keys), `Esc` unfocuses. Action keys only fire when items toggled AND search not focused |
| Vault add form complexity underestimated | Medium | Medium | Simplified to sequential inline prompts instead of full multi-field form. Evaluate Ink form libraries in Task 1.1; if too complex, sequential prompts are acceptable |
| Agent package type compatibility | Low | Low | Existing commands handle agents; TUI must render `[agent]` badges. Added agent verification to Phase 2 and Phase 3 VERIFY checklists |

## Out of Scope
- MCP server — not needed, TUI handles everything
- Skill/command .md files — replaced by TUI
- Install count tracking — requires a backend; show "N/A" or vault-provided counts if available in registry
- Multi-file packages — deferred to v2
- Auto-update of plug itself — deferred
