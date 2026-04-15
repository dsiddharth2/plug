# plug — Architecture Overview

plug is an npm-installable CLI and interactive TUI package manager for Claude Code. It lets developers discover, install, update, and remove **skills**, **commands**, and **agents** from GitHub-hosted registries called **vaults**.

## What plug is

Claude Code extends its capabilities through three file-based extension types (skills, commands, agents). plug manages the full lifecycle of these extensions: finding them in vaults, downloading them to the correct `.claude/` directories, tracking what is installed, and keeping everything up to date.

plug ships as a single npm package (`plugvault`) and exposes two entry points:
- **Interactive TUI** — run `plug` (no args) or `plug tui` or `! plug` from the Claude Code terminal. Full-screen keyboard-driven interface.
- **CLI** — `plug install`, `plug search`, `plug list`, etc. Scriptable, composable with other shell tools.

---

## Core modules

All business logic lives in `src/utils/` and `src/commands/`. The TUI layer in `src/tui/` sits on top without modifying any of these.

### `src/utils/registry.js`
Fetches and caches `registry.json` from each vault's GitHub repo. Cache TTL is 1 hour (`CACHE_TTL_MS`). On a cache miss it fetches from `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/registry.json` with optional auth headers. Also provides `getStaleRegistryCache()` for offline fallback — returns cached data regardless of age.

Key exports: `fetchRegistry(vault)`, `findPackage(name, vaultName?)`, `findAllPackages(name)`, `getCachedRegistry(vaultName)`, `getStaleRegistryCache(vaultName)`.

### `src/utils/tracker.js`
Manages `installed.json` — the on-disk record of what is installed. Two scopes: local (`.plugvault/installed.json` in the current working directory) and global (`~/.plugvault/installed.json`). Records name, type, vault, version, path, and installedAt timestamp per package.

Key exports: `getInstalled(global?)`, `addInstalled(entry, global?)`, `removeInstalled(name, global?)`.

### `src/utils/config.js`
Reads and writes `~/.plugvault/config.json` — the vault registry. On first run, auto-seeds the official vault and writes the file. Handles corrupt JSON by backing up and resetting to defaults.

Key exports: `getConfig()`, `saveConfig(config)`, `getVault(name)`, `getDefaultVault()`, `getResolveOrder()`.

### `src/utils/fetcher.js`
Downloads individual files from GitHub (package entry files, `meta.json`). Handles auth headers and writes to the local filesystem.

### `src/utils/auth.js`
Resolves auth tokens for private vaults. Resolution order: environment variable (`PLUG_VAULT_{NAME}_TOKEN`, uppercased) → token stored in `config.json`. Never echoes tokens.

### `src/utils/paths.js`
Centralises all path construction. Global dir: `~/.plugvault/`. Install targets: `.claude/skills/`, `.claude/commands/`, `.claude/agents/` (local-scoped by default; global when `-g` flag is set). Config file: `~/.plugvault/config.json`. Cache dir: `~/.plugvault/cache/`.

### `src/utils/search-scoring.js`
Pure scoring function shared between the CLI `search` command and the TUI's `useSearch` hook. Avoids duplication of the scoring algorithm in two places. Score tiers: exact name match (40), partial name (30), description match (20), tag match (10).

See: `src/utils/search-scoring.js`

### `src/commands/`
One file per CLI verb: `init`, `install`, `remove`, `list`, `search`, `update`, `vault`. Each exports a `register*` function that wires the command into Commander, plus a `run*` function that implements the logic and can be called directly (used by the TUI).

---

## TUI layer

The TUI lives entirely in `src/tui/` and does not modify any existing code. It reuses core module functions directly.

### How it composes via the stdout wrapper

Existing command functions (`runInstall`, `runRemove`, `runUpdate`, etc.) write their results to `process.stdout`. During Ink rendering this would corrupt the terminal. The stdout capture wrapper (`src/tui/utils/capture-stdout.js`) temporarily replaces `process.stdout.write` and `process.stderr.write` with a capture function before calling a command, then restores them in a `finally` block. The captured string is available for the TUI to display in its own components.

```
TUI action
  └─ captureOutput(() => runInstall(...))
       └─ stdout/stderr intercepted → captured as string
       └─ runInstall executes normally, unaware it's in TUI
       └─ stdout/stderr restored
  └─ TUI parses captured JSON, updates its own state
```

See: `src/tui/utils/capture-stdout.js`

### The 3-tab TUI model

The root `App` component (`src/tui/app.jsx`) owns the active tab index and global key bindings (left/right arrows switch tabs, Esc exits). Each tab maps to a screen component:

| Tab index | Label | Screen file |
|-----------|-------|-------------|
| 0 | Discover | `src/tui/screens/discover.jsx` |
| 1 | Installed | `src/tui/screens/installed.jsx` |
| 2 | Vaults | `src/tui/screens/vaults.jsx` |

Screens can lock global tab-switching input (e.g. when a detail panel or install progress view is active) by calling `onInputCapture(true)`. When `inputLocked` is true in `App`, the `useInput` hook for tab switching is deactivated.

### Keyboard model and focus/search-mode behavior

The TUI has two input modes for the Discover and Installed screens:

**Navigation mode** (default):
- Arrow keys move the cursor in the package list
- `Space` toggles selection for batch operations
- Action keys (`i` install, `u` update, `r` remove) fire **only** when: (a) at least one item is toggled, or the cursor is on a valid item, AND (b) the search box is not focused

**Search mode** (activated by `/`):
- `/` focuses the search box
- All printable characters append to the search query (live filter)
- `Backspace` deletes the last character
- `Esc` unfocuses search and returns to navigation mode
- Action keys do not fire while search is focused

This two-mode design resolves the keyboard conflict: without it, pressing `i` in search mode would trigger install instead of typing the letter.

### Vault resolution order

When plug looks up a package, it walks the `resolve_order` array in `config.json` and checks each vault's registry in turn. The first vault that contains a package wins. The official vault (`dsiddharth2/plugvault`, branch `main`) is always pre-seeded and cannot be removed. Additional vaults are prepended or appended via `vault add` and `vault set-default`.

Resolution order is also used by `use-packages` hook to merge all vaults into a single flat package list for the Discover screen.

---

## Terminal buffer management

The TUI uses direct ANSI escape sequences for two terminal features that Ink 5.2.1 does not expose:

**Alt-screen buffer** (`\x1b[?1049h` / `\x1b[?1049l`): Switches the terminal into a separate screen buffer so Ink renders into a clean area. When the TUI exits, the terminal restores the prior buffer and cursor position. This prevents stale content from previous render frames from persisting in the scrollback (the "ghost / double-render" symptom when transitioning between screens of different heights).

**Bracketed paste mode** (`\x1b[?2004h` / `\x1b[?2004l`): Instructs the terminal to wrap pasted text between `ESC[200~` and `ESC[201~` markers. The TUI's `usePaste` hook detects these markers on stdin and delivers the complete paste as a single callback, rather than letting it arrive as a burst of individual keystroke events.

**Enter/leave ordering invariant:**
```
Enter:  alt-screen → bracketed paste
Leave:  bracketed paste → alt-screen
```

Both are managed in `launchTui()` (`src/index.js`) and apply unconditionally to all TUI screens. See `docs/decisions.md` for why a direct ANSI approach was chosen over a library bump.
