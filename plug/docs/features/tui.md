# TUI Feature — Interactive Package Manager

plug includes a full-screen, keyboard-driven TUI modelled after the `/plugins` experience in Claude Code.

## Launching the TUI

| Invocation | Context |
|---|---|
| `! plug` | From within Claude Code (runs in the terminal pane) |
| `plug` | Direct terminal invocation with no subcommand |
| `plug tui` | Explicit subcommand — same as no-args |

When no arguments are passed, the entry point (`src/index.js`) detects `process.argv.length <= 2` and calls `launchTui()` instead of running Commander. This preserves the existing CLI for scripting (`plug install code-review`, `plug search auth`, etc.) while directing interactive use to the TUI.

---

## Tab-by-tab functionality

### Discover tab (tab 0)

Lists all packages from all configured vaults, merged into a single scrollable list. Each entry shows:
- Line 1: `name · vault-name · version` with a type badge (`[agent]` for agents; skills and commands are unlabelled)
- Line 2: truncated description
- Cursor prefix `>` on the selected row; `[x]` checkbox when toggled

**Loading** — while fetching registries, a spinner replaces the list. On network failure the screen shows an error with a hint to check vault config. If the network is down but a cache exists, the stale cache is used and a yellow warning banner is shown ("Using cached data…").

**Search** — press `/` to enter search mode. Type to live-filter the list. Results are re-ranked by relevance score (see `src/utils/search-scoring.js`). Press `Esc` to exit search mode; the full list is restored.

**Detail panel** — press `Enter` on any package to open the full detail view: name, description, type, version, vault, tags, entry file, install-to path, and an `[Install]` prompt. Press `Esc` to return to the list.

**Installing** — press `i` to install the cursor package, or toggle multiple with `Space` then press `i` for batch install. An install progress view shows a per-package spinner/checkmark. After all installs complete, an install-complete summary shows file paths and usage hints (e.g. "Use /code-review to invoke this command", "This skill will activate automatically").

**Empty states**:
- No packages in any vault: "No packages found. Check your vault configuration."
- No search results: "No results for '…'. Try a different search term."

### Installed tab (tab 1)

Lists packages from `installed.json` across both local and global scopes. Each entry shows:
- Line 1: `name · vault-name · version` with scope badge (`[local]` / `[global]`) and type badge
- Line 2: install path (e.g. `.claude/commands/code-review.md`) — not description
- Update-available indicator when a newer version exists: `v1.2.0 → v1.3.0 ⬆`

Status line shows total count and number of available updates.

**Actions**: `u` to update selected packages (calls `runUpdate` via stdout wrapper), `r` to remove selected packages (shows confirmation dialog first, then calls `runRemove`). Both update installed.json and refresh the list.

**Empty state**: "No packages installed. Visit the Discover tab to browse packages."

### Vaults tab (tab 2)

Lists all configured vaults. Each entry shows:
- Line 1: `★ name · owner/repo · branch · [public/private] · N pkgs`
- Line 2: GitHub URL (dimmed)
- `★` star on the default vault

**Actions**:
- `a` — add a vault: sequential inline prompts for name, GitHub URL, branch (default: `main`), and private flag. Runs a connectivity check (fetches the new vault's registry). Press `Esc` at any step to cancel.
- `r` — remove the selected vault. Confirmation required. The official vault cannot be removed.
- `d` — set the selected vault as the default (moves it to the front of resolve_order).
- `s` — sync all vault registries: re-fetches each vault's `registry.json` and shows a per-vault progress list.

**Empty state**: "No vaults configured. Press [a] to add a vault."

---

## Keyboard reference

| Key | Effect | Active when |
|---|---|---|
| `←` `→` | Switch tabs | Global (except when input is locked) |
| `↑` `↓` | Move cursor | Any list |
| `Enter` | Open detail panel | Discover, Installed |
| `Space` | Toggle selection for batch ops | Discover, Installed |
| `/` | Focus search box | Discover, Installed (navigation mode) |
| type chars | Live filter search | Discover, Installed (search mode) |
| `Backspace` | Delete last search char | Search mode |
| `Esc` | Back / unfocus search / exit | Global |
| `i` | Install selected / cursor package | Discover (navigation mode, not search) |
| `u` | Update selected packages | Installed (navigation mode, not search) |
| `r` | Remove selected / add vault flow | Installed (navigation mode); Vaults list |
| `a` | Add new vault | Vaults tab |
| `d` | Set selected vault as default | Vaults tab |
| `s` | Sync all vault registries | Vaults tab |

---

## Alt-screen buffer

The TUI runs inside the terminal's **alternate screen buffer**, entered and left using direct ANSI escape sequences in `launchTui()` (`src/index.js`):

| Sequence | Effect |
|---|---|
| `\x1b[?1049h` | Enter alt-screen (save cursor, switch to blank buffer) |
| `\x1b[?1049l` | Leave alt-screen (restore cursor and prior buffer contents) |

Alt-screen entry happens **after** the non-TTY guard and `resolveStdin()`, immediately before `render()`. This ensures Ink renders into a clean buffer — the normal terminal scrollback is preserved below and is restored when the user exits.

Without alt-screen, Ink tracks line count and rewrites in-place, but tall list contents scroll into the scrollback. When a subsequent screen renders fewer lines (e.g. transitioning from a long package list to an install-progress view), the stale content from the previous render remains visible above the new content — the "ghost / double-render" symptom.

**Why direct ANSI sequences:** Ink 5.2.1 does not expose a `fullScreen` option. Bumping Ink would have broken the TTY fix in PR #6 and other integrations. Direct ANSI sequences are intentional and version-safe.

**Teardown:** `cleanup()` is registered on both `process.on('exit')` and `waitUntilExit().then()`. Both registrations are harmless because the ANSI writes are idempotent.

---

## Bracketed paste

See [`docs/features/paste.md`](paste.md) for the full description. In brief:

- `\x1b[?2004h` / `\x1b[?2004l` enable/disable bracketed paste mode.
- Enabled immediately **after** alt-screen enter; disabled **before** alt-screen leave (reverse order on teardown).
- The shared `usePaste` hook (`src/tui/hooks/use-paste.js`) delivers complete paste payloads to text inputs.
- Active in `SearchBox` (when focused) and `AddVaultForm` (always while mounted).

---

## Offline behavior (stale cache fallback)

The registry module (`src/utils/registry.js`) has two cache read paths:
1. `getCachedRegistry` — returns cached data only if < 1 hour old (normal path)
2. `getStaleRegistryCache` — returns cached data regardless of age

When `use-packages` catches a network error, it retries with `getStaleRegistryCache`. If stale data is available it sets a `warning` string that the Discover screen renders as a yellow banner. If no cache exists at all, the error state is shown.

---

## Empty states

| Location | Trigger | Message |
|---|---|---|
| Discover list | No packages in any vault | "No packages found. Check your vault configuration." |
| Discover list | Search returns 0 results | "No results for '…'. Try a different search term." |
| Installed list | `installed.json` empty in both scopes | "No packages installed. Visit the Discover tab to browse packages." |
| Vaults list | `resolve_order` is empty | "No vaults configured. Press [a] to add a vault." |
| Any fetch | Network error, no cache | Red error text + "Check your network connection and vault configuration." |
