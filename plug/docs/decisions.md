# Architectural Decisions

## Why Ink + React for the TUI

**Chosen over:** blessed, tui-rs (Rust), terminal-kit, pure ANSI escape sequences

Ink renders React components to the terminal. The decision to use Ink came from several converging factors:

- **Same stack as Claude Code's `/plugins`** — Claude Code's own plugin browser is built on Ink. Using the same library means the UX model (tabs, lists, keyboard input via hooks) will feel native to Claude Code users.
- **Existing Node.js project** — plug is already a Node.js ESM package. Adding Ink is one `npm install`; no language boundary, no subprocess, no IPC.
- **Component model fits the problem** — a tab-router that swaps screen components, each owning its own state, is a natural fit for React. Alternative libraries would require managing screen lifecycles manually.
- **Declarative re-render on state change** — Ink re-renders on state update automatically. This is important for live search (every keystroke triggers a re-filter and re-render) and install progress (per-package status updates stream in).

## Why tsx for the JSX transform

**Chosen over:** Babel + `@babel/register`, esbuild, SWC, manual JSX pragma

The project uses Vitest for tests, which already requires a dev-time transform step. tsx (TypeScript Execute) provides JSX transform for both `node` invocation and Vitest without requiring a separate Babel config or build step. It works with Node's native ESM (`"type": "module"` in `package.json`) and doesn't require changing existing `.js` files — only the new TUI files use `.jsx`.

This keeps the toolchain minimal: no Webpack, no Rollup config, no separate compile step before running the CLI.

## Why the stdout capture wrapper (rather than rewriting commands)

The existing commands (`runInstall`, `runRemove`, `runUpdate`, `runVaultSync`, etc.) write their progress and results to `process.stdout`. Ink owns the terminal during rendering — any external write to stdout corrupts the screen layout.

Two alternatives were considered:

1. **Rewrite command functions** to return structured data instead of writing to stdout. This would have required touching every command file and changing their public API, risking regressions in the CLI path.
2. **Subprocess + IPC** — spawn each command as a child process and capture its stdout. Adds process-management complexity and latency.

The stdout capture wrapper (`src/tui/utils/capture-stdout.js`) takes a third path: temporarily monkey-patch `process.stdout.write` and `process.stderr.write` to accumulate output into a string, then restore them in a `finally` block. The existing command functions run unchanged. The TUI receives the captured string and parses the JSON output (commands run with `ctx.set({ json: true })` in TUI mode) to extract structured results.

This approach is:
- Zero-diff on the command files
- Reliable (always restores stdout, even on error)
- Sufficient — commands already support `--json` output for structured data

See: `src/tui/utils/capture-stdout.js`

## Why a shared search-scoring utility

The search ranking algorithm (exact name: 40, partial name: 30, description: 20, tag: 10) was originally embedded inside `src/commands/search.js` as a local function. The TUI's `useSearch` hook needed the same logic for live filtering in the Discover and Installed screens.

Rather than copy the algorithm, it was extracted into `src/utils/search-scoring.js` as a pure, side-effect-free function (`scoreMatch(name, pkg, keyword) → number`). Both `src/commands/search.js` and `src/tui/hooks/use-search.js` import from this shared utility.

This matters because scoring tuning (adding new tiers, adjusting weights) now needs to happen in one place and both CLI search and TUI live-filter stay in sync automatically.

See: `src/utils/search-scoring.js`

## Why direct ANSI sequences instead of Ink `fullScreen`

**The problem:** Ink re-renders by tracking line count and rewriting in place. When a tall list view transitions to a shorter result view (e.g. list → install progress → install complete), stale lines from the previous render remain visible in the scrollback — the "ghost / double-render" symptom (issue #9).

**Ink's API:** Ink 5.2.1 does not expose a `fullScreen` option. There is no built-in way to switch the terminal into the alternate screen buffer via Ink.

**Alternatives considered:**

1. **Bump Ink** — Ink 5.x does not add a fullScreen API. Bumping to a hypothetical future version with this feature would be speculative, and bumping the dep at all risked breaking the TTY fix in PR #6 (which depends on Ink's specific signal-exit integration) and other internal integrations.
2. **Per-screen manual clear** — Insert a `\x1b[2J` (clear screen) before each view transition. This would require instrumenting every state transition in every screen and still wouldn't properly handle scrollback.

**Chosen approach:** Write `\x1b[?1049h` (alt-screen enter) before `render()` and `\x1b[?1049l` (alt-screen leave) on exit, directly from `launchTui()`. This is:
- A single change point — all screens and state transitions benefit uniformly.
- Version-safe — the sequences are part of the VT100/xterm standard and work across all terminals plug targets.
- Non-invasive — no changes to screen components or state machines.

The same pattern is layered for bracketed paste (`\x1b[?2004h/l`), which also has no Ink API equivalent.

See: `src/index.js` (`launchTui`) and `docs/features/paste.md`.

---

## Why `/` to focus search

**The problem:** The TUI needs both live text search and single-key action shortcuts (`i` install, `u` update, `r` remove). A user typing `i` to search for packages starting with "i" would inadvertently trigger the install action.

**Alternatives considered:**
- Require `Ctrl+F` or `F3` to enter search — non-obvious, not muscle-memory for most users
- Disable action keys always — too restrictive, forces extra steps for common operations
- Separate search input at top, always focused — loses keyboard-navigation feel

**Chosen design:** Two explicit modes, toggled by `/` and `Esc`:
- **Navigation mode** (default): arrow keys move cursor, action keys are active when items are toggled
- **Search mode** (entered with `/`): all printable characters append to the search query, action keys are disabled

`/` is the conventional "search" key in many TUI tools (vim, less, man pages). It is not a printable character that would appear in a package name, so it is unambiguous as a mode toggle. `Esc` is the universal "back/cancel" key.

The key invariant: action keys only fire when **both** (a) at least one item is toggled and (b) the search box is not focused. This is checked in each screen's `useInput` handler before dispatching any action.

## Fix: Terminal Corruption and Input Echo during Installation

**The problem:** When installing packages via the TUI, the terminal would often become corrupted, showing "ghost" renders or echoing unconsumed input (e.g., `fdfdfdfdfdfdq`). This made the TUI appear frozen or broken after an installation.

**Root Causes:**
1. **Global stdout hijacking:** The original `captureOutput` implementation intercepted *all* writes to `stdout` and `stderr` while a command was running. This included Ink's own background re-render cycles (e.g., for the TUI's animated spinners). These frames were swallowed into the captured string instead of being drawn to the terminal, causing the TUI to "freeze" and desynchronize.
2. **Spinner Interference:** The `ora` spinners used in `runInstall` and `runUpdate` were still attempting to write to the terminal even when `stdout` was captured, often leading to terminal mode conflicts.
3. **Input Race Conditions:** Rapid keypresses during the transition from the "Installing" to "Complete" screens could trigger multiple state updates, leading to double-renders or unexpected view swaps.

**Chosen Fixes:**

1. **Context-Aware Output Capture:** Refactored `src/tui/utils/capture-stdout.js` to use `AsyncLocalStorage`. The monkey-patched `write` functions now check if the current execution context is "inside" the `captureOutput` call.
   - **Writes from the command** (e.g., `runInstall`) are captured.
   - **Writes from Ink's background ticks** (outside the command's context) bypass the capture and go straight to the real terminal.
   This allows the TUI to continue rendering its own UI (including spinners) while the background installation output is being captured.

2. **Silenced Spinners in JSON Mode:** Modified `src/utils/ui.js` to make `createSpinner` return a no-op object whenever `ctx.json` is true. Since the TUI always sets `json: true` before running commands, this effectively silences all `ora` output that would otherwise interfere with Ink.

3. **Input Guards:** Added `useRef` guards to `InstallComplete` and `OperationResult` components to ensure that `onDone` (and thus the view transition back to the list) is only called exactly once, regardless of how many keys are pressed or queued.

See: `src/tui/utils/capture-stdout.js`, `src/utils/ui.js`, and `src/tui/components/install-complete.jsx`.
