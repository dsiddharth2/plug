# TUI (Terminal User Interface)

Plug features a rich, interactive Terminal User Interface (TUI) built with **Ink** (React for CLI). The TUI is available in both the Node.js CLI and as part of the `/plug` command in the Claude Code Skill.

## Core Features

*   **Interactive Browsing**: Explore available packages from all your registered vaults.
*   **Search**: Find packages by name, description, or tags with real-time results.
*   **Batch Operations**: Select multiple packages for installation or removal.
*   **Vault Management**: Add, remove, and configure vaults (including private vault tokens) directly in the UI.
*   **Contextual Feedback**: See detailed installation progress and result summaries.

---

## Screens

### 1. Discover
The entry point for finding new extensions.
*   **Tabs**: Filter by package type (Skills, Commands, Agents).
*   **Search Bar**: Activate with `/` to filter the package list.
*   **Install Queue**: Toggle packages with `Space` and install them all at once with `Enter`.

### 2. My Packages
Manage your currently installed extensions.
*   **Scope View**: See both local and global installations.
*   **Update Checks**: Check for newer versions and update them individually or in batch.
*   **Safe Removal**: Uninstall packages and clean up their tracking data.

### 3. Vaults
Configure your package sources.
*   **Resolve Order**: Change which vaults are prioritized during installation.
*   **Private Vaults**: Interactively enter and update GitHub Personal Access Tokens (PAT).
*   **Connectivity Test**: Instantly verify if a vault is reachable.

---

## Technical Architecture: Context-Aware Capture

A major challenge in building a TUI that runs background commands (like `git clone`) is capturing their output without breaking the TUI's own rendering cycle.

### The Problem
Traditional output capture (`stdout` monkey-patching) intercepts *all* writes. Since Ink relies on background re-render cycles to draw the UI, these frames would be swallowed into the captured output, causing the terminal to "freeze" or "ghost".

### The Solution
Plug uses `AsyncLocalStorage` to implement **Context-Aware Capture**:
1.  When a command starts, we enter an asynchronous "capture context".
2.  The `stdout.write` patch checks the current context using `AsyncLocalStorage.getStore()`.
3.  **If in context**: The output comes from the command and is captured.
4.  **If out of context**: The output comes from Ink's background re-render and is passed directly to the real terminal.

This ensures the TUI remains responsive and visually correct while background operations proceed.

---

## Hotkeys

| Key      | Action                                     |
|----------|--------------------------------------------|
| `Tab`    | Switch between main screens                |
| `Arrows` | Navigate lists                             |
| `/`      | Focus search box                           |
| `Space`  | Toggle package selection                   |
| `Enter`  | Confirm action (Install, Update, Select)   |
| `Esc`    | Back / Clear search / Exit                 |
| `q`      | Quit Plug                                  |
