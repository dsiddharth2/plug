# PlugVault TUI — Phase 1 Code Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-15T12:00:00+05:30
**Verdict:** APPROVED

> See the recent git history of this file to understand the context of this review.

---

## Review Context

This review covers Phase 1 (TUI Foundation) of the TUI sprint. The work is in commit `3ffe0e2` on `feat/tui`. Phase 0 was previously APPROVED (commit `ad2463c`) — this is a cumulative review covering Phases 0 + 1, focused on Phase 1 changes.

---

## Phase 0 Regression Check: PASS

Phase 0 cleanup remains intact. No old skill files have reappeared. PLAN.md, progress.json, and .gitignore are all present and correct. No regressions detected.

---

## Task 1.1 — Add Ink Dependencies and JSX Support: PASS

**Dependencies added correctly.** `package.json` now includes:
- `ink: ^5.0.1` — TUI framework
- `react: ^18.3.1` — required peer dependency for Ink
- `tsx: ^4.19.3` — ESM loader for JSX without a build step

**JSX loader approach is sound.** `bin/plug.js` registers `tsx/esm/api` before dynamically importing `src/index.js`. This is a cleaner approach than `@babel/register` — tsx is lighter, requires no `.babelrc`, and works seamlessly with ESM modules. The loader registration is minimal (3 lines) and the dynamic import ensures tsx is active before any `.jsx` file is encountered. PASS.

**`ink-use-input` correctly omitted.** The PLAN.md (originally inherited from the tui-plan.md tech stack table) listed `ink-use-input` as a separate dependency. The doer correctly identified that `useInput` is built into Ink 5.x — confirmed by checking `import { useInput } from 'ink'` in both `app.jsx` and `package-list.jsx`. No separate package needed. Sound decision.

**No-arg TUI launch works.** `src/index.js` checks `process.argv.length <= 2` to launch the TUI when no subcommand is given. The `launchTui()` function dynamically imports `ink`, `react`, and `app.jsx` to avoid loading TUI code for CLI subcommands. This preserves existing Commander behavior for `plug install`, `plug search`, etc.

**`plug tui` subcommand registered.** Commander now includes a `tui` command that calls the same `launchTui()` function. Visible in `--help` output.

**All 186 tests pass.** Confirmed: 17 test files, 186 tests, 0 failures.

**CLI preserved.** `node bin/plug.js --help` shows all commands including `tui`. `node bin/plug.js list` works correctly.

---

## Task 1.2 — Tab Bar and App Shell: PASS

**`src/tui/app.jsx`** (43 lines): Root component with `activeTab` state (0-indexed). Uses Ink's `useApp().exit()` for clean Esc handling. Left/right arrows switch tabs with bounds clamping (`Math.max/min`). Layout: vertical flex column with TabBar, content area (paddingX=2, paddingY=1), and HotkeyBar. Placeholder `ActiveTabContent` renders tab name + "loading…" — correct scaffolding for Phase 2/3 screens.

**`src/tui/components/tab-bar.jsx`** (32 lines): Renders 3 tabs (Discover, Installed, Vaults). Active tab is bold, blue, underlined with bracket wrapping `[ Tab ]`. Inactive tabs are gray. Uses Ink's `Box` with `borderStyle="single"` and `borderBottom={false}` for visual framing. Exports both default component and `TAB_LABELS` array for use by `app.jsx`.

**`src/tui/components/hotkey-bar.jsx`** (56 lines): Context-sensitive key hints per tab. Three hint sets: discover (search/toggle/detail/install), installed (search/toggle/update/remove), vaults (add/default/sync). Each hint renders key in bold cyan + label in gray. Border matches tab-bar style (`borderTop={false}`). Keyboard hints match the keyboard controls table in `tui-plan.md`.

---

## Task 1.3 — Package List and Package Item: PASS

**`src/tui/components/package-list.jsx`** (161 lines): Viewport-windowed scrollable list. Key behaviors:

- **Cursor tracking:** up/down arrow keys, bounds-clamped to `[0, items.length-1]`.
- **Viewport windowing:** `buildWindow()` computes visible items based on `scrollOffset` and `viewportHeight`, accounting for variable item heights (1 line if no description, 2 if has description). Good row-height awareness.
- **Scroll indicators:** "↑ N more above" / "↓ N more below" shown when list overflows viewport. Counts are accurate (uses `countVisible()` helper).
- **Space toggle:** Toggles cursor index in a `Set()`. Immutable update pattern (creates new Set each toggle).
- **Enter callback:** Calls `onSelect(items[cursor])` when provided.
- **isActive guard:** `useInput` handler exits early when `isActive=false` or items are empty. This prevents keyboard conflicts when other UI layers (detail panel, search) are active.
- **Terminal width:** Uses `useStdout().stdout.columns` for width-aware rendering. Falls back to 80 columns.
- **Empty state:** Renders "No packages found." when items is empty.

**`adjustScroll()`** function handles both scroll-up (cursor above window → snap to cursor) and scroll-down (cursor below window → find smallest offset where cursor is visible). The backward search in scroll-down is correct but could be O(n²) in pathological cases — acceptable for typical list sizes (<100 items).

**`src/tui/components/package-item.jsx`** (60 lines): Two-line package row.
- Line 1: `[x] > name · vault · version  [type]` — checkbox, cursor indicator, name info, type badge.
- Line 2: Description, indented 4 spaces, dimmed, truncated to terminal width.
- Truncation: Both name line and description are truncated with `…` when exceeding available width. Width calculation accounts for checkbox prefix (6 chars) and type badge padding.
- Styling: Toggled checkbox is yellow, cursor item is blue+bold. Type badge is magenta.

**Reusability for Phase 3:** The `PackageList` component is generic — accepts any `items` array and delegates rendering to `PackageItem`. The Installed screen (Phase 3, Task 3.1) will need to show file paths instead of descriptions on line 2, which will require either a `mode` prop on `PackageItem` or a custom item renderer. The component is designed cleanly enough that this extension is straightforward. PASS.

---

## Security Review: PASS

- No secrets, tokens, or credentials in any new files.
- No `process.env` access, no `child_process`, no `exec`/`spawn` in TUI code.
- No user input passed to shell commands or eval.
- TUI input is handled entirely through Ink's `useInput` hook (safe keystroke handling).

---

## Code Quality: PASS

- Consistent ESM module style matching existing codebase.
- JSX components follow React conventions (PascalCase, props destructuring, `key` props on mapped elements).
- Clean separation: app shell → tab-bar → hotkey-bar → package-list → package-item. Each component is single-responsibility.
- No unnecessary abstractions or over-engineering for Phase 1 scope.
- Comments are minimal and useful (JSDoc params on component props).

---

## Notes

### NOTE #1 — "PlugVault" branding not in tab bar

The tui-plan.md wireframe shows `PlugVault   Discover   Installed   Vaults` with "PlugVault" as a title/label on the left of the tab bar. The current `tab-bar.jsx` renders only the three tabs without the branding. This is a minor UI discrepancy — can be addressed in Phase 4 polish or as the doer sees fit. Not a blocker.

### NOTE #2 — `files` field not yet in package.json

The task file check item #5 mentions "`files` field includes `src/tui/`". Per PLAN.md, this is Task 4.3 (Phase 4), so its absence in Phase 1 is expected and correct.

### NOTE #3 — progress.json task 1.V still pending

Task 1.V (VERIFY: Phase 1) is `"status": "pending"` in progress.json. This is correct — the verify step is the reviewer's responsibility. The doer should update this to `"completed"` after this review is accepted.

### NOTE #4 — Checkbox always visible even when no items toggled

`PackageItem` always renders the `[ ]` / `[x]` checkbox prefix. The tui-plan.md wireframe shows items *without* checkboxes in the default state (only showing `[x]` when toggled). This is a minor cosmetic difference — the current approach is functionally correct and arguably clearer for discoverability. Not a blocker, but worth considering in Phase 4 polish if the wireframe fidelity matters.

---

## Summary

**All 3 Phase 1 tasks PASS. 0 FAIL, 4 NOTE (all non-blocking).**

Phase 1 delivers a solid TUI foundation: tsx-based JSX loading (cleaner than babel), tab-bar with keyboard navigation, context-sensitive hotkey bar, and a viewport-windowed scrollable package list with cursor tracking and selection toggling. The doer made two sound technical decisions: using tsx instead of @babel/register, and correctly omitting the non-existent `ink-use-input` package. All 186 existing tests pass, CLI is fully preserved, and components are well-structured for reuse in Phases 2-3.

Phase 1 is complete. Ready to proceed to Phase 2 (Discover screen).
