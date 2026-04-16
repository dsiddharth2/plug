# Architectural Decisions

This document records the key architectural decisions and major technical changes in the Plug project.

---

## Transition to Claude Code Skill (Phase 1)
**Date:** April 2026

**Decision:** We are transitioning the primary execution engine from a Node.js CLI to a native Claude Code Skill.

**Rationale:**
1.  **Reduced Friction**: Users should not need to install a Node package to manage Markdown files that Claude already knows how to handle.
2.  **Native Integration**: By becoming a Skill, Plug can leverage Claude's native tools (`Bash`, `Read`, `Write`) to manage extensions directly within the conversation.
3.  **Conversational UX**: The Skill allows for natural language management (e.g., "install the code-review skill"), while the interactive `/plug` command provides a guided, TUI-like experience.

---

## Fix: Terminal Corruption and Input Echo in TUI
**Date:** April 2026

**The problem:** During TUI operations (like installation), the terminal would often become corrupted, showing "ghost" renders or echoing unconsumed input. This made the TUI appear frozen or broken.

**Root Causes:**
1.  **Global stdout hijacking**: The original `captureOutput` implementation intercepted *all* writes to `stdout` and `stderr`. This included Ink's own background re-render cycles, causing the TUI to "freeze" as its frames were swallowed.
2.  **Spinner Interference**: External spinners (`ora`) were still attempting to write to the terminal during output capture.
3.  **Input Race Conditions**: Rapid keypresses during transitions could trigger multiple state updates, leading to double-renders.

**Chosen Fixes:**
1.  **Context-Aware Output Capture**: Refactored `capture-stdout.js` using `AsyncLocalStorage`. Writes from the command being executed are captured, while Ink's own background render ticks bypass capture and reach the terminal unimpeded.
2.  **Silenced Spinners in JSON Mode**: Modified `src/utils/ui.js` to return a no-op spinner whenever `ctx.json` is true (which the TUI always sets).
3.  **Input Guards**: Added `useRef` guards to UI components to ensure views are only updated once per input event.

---

## TUI Architecture: Ink over traditional CLI
**Date:** March 2026

**Decision:** We chose **Ink** (React for CLI) for the interactive interface.

**Rationale:**
*   **Component-Based**: React's model is perfect for complex state management (like browsing, searching, and installation queues).
*   **Rich Interactive Experience**: Ink makes it easy to build dynamic layouts, spinners, and hotkey bars that feel modern and responsive.
*   **Declarative UI**: Simplifies building the "Discover," "Installed," and "Vaults" screens compared to manual ANSI escape code management.

---

## Vault Resolve Order
**Date:** March 2026

**Decision:** Implement a `resolve_order` in the global configuration.

**Rationale:**
*   **Collision Handling**: When multiple vaults contain a package with the same name, Plug needs a deterministic way to decide which to install.
*   **Priority Management**: Allows users to prioritize internal/private vaults over the official one.
*   **Customizability**: Users can easily reorder their vaults via `plug vault set-default` or by editing `config.json`.
