# TUI (Terminal User Interface)

Plug features a rich, interactive Terminal User Interface (TUI) built with **Ink** (React for CLI). The TUI is available in both the Node.js CLI and as part of the `/plug` command in the Claude Code Skill.

## Core Features

![Plug TUI Screenshot](../images/tui-screenshot.png)
*(The interactive TUI for Discover, Installed, and Vaults management)*

*   **Interactive Browsing**: Explore available packages from all your registered vaults.
*   **Search**: Find packages by name, description, or tags with real-time results.
*   **Batch Operations**: Select multiple packages for installation or removal.
*   **Vault Management**: Add, remove, and configure vaults (including private vault tokens) directly in the UI.
*   **Contextual Feedback**: See detailed installation progress and result summaries.

## Screens & Workflows

The Plug TUI is designed to be the primary interface for all operations. No commands to memorize—just run `plug`.

### Flow 1: Discover and Search
The entry point for finding new extensions. Results from all registered vaults are merged into one list.

```
┌──────────────────────────────────────────────────────────────────────┐
│  plug  [Discover]  Installed  Vaults                           v2.0  │
├──────────────────────────────────────────────────────────────────────┤
│  / search...                                                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  NAME               TYPE     VER     DEPS        VAULT               │
│  ▶ superpowers      skill    v1.0.0  ★ 3 deps    my-skills-repo 🔒  │
│    senior-engineer  agent    v1.0.3  · no deps   official            │
│    code-review      skill    v1.1.0  · no deps   official            │
│    onboarding-kit   skill    v2.0.0  ★ 4 deps    company 🔒         │
│                                                                       │
│  🔒 = private vault    ✓ = already installed                         │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  [Enter] detail   [i] install   [/] search   [Tab] next tab          │
└──────────────────────────────────────────────────────────────────────┘
```

*   **Real-time Filtering**: Press `/` to search. The list filters instantly as you type.
*   **Private Badges**: Packages from private vaults are marked with a `🔒` badge.

---

### Flow 2: Package Detail & Dependency Awareness
Press `Enter` on any package to see its full metadata, source vault, and dependency status.

```
┌──────────────────────────────────────────────────────────────────────┐
│  superpowers                                  [skill]  v1.0.0        │
│  Gives Claude superpowers                                             │
│                                                                       │
│  Source: my-skills-repo (github.com/developer/my-skills-repo)        │
│                                                                       │
│  Dependencies:                                                        │
│    ✓ senior-engineer   agent    v1.0.3   official           installed │
│    ✗ code-review       skill    v1.1.0   official       not installed │
│                                                                       │
│  Installing this will also install: code-review (from official)      │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Flow 3: Install Plan & Scope Selection
Press `i` to trigger the installation. Plug builds a "Plan" showing exactly what will be written.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Install plan — superpowers                                          │
├──────────────────────────────────────────────────────────────────────┤
│  Install scope:  ◉ Project (.claude/)   ○ Global (~/.claude/)       │
│                                                                       │
│  Required — always installed:                                         │
│    [✓] superpowers       skill    v1.0.0   new        my-skills-repo │
│    [✓] code-review       skill    v1.1.0   new        official       │
│                                                                       │
│  Already satisfied — skipped:                                         │
│    [✓] senior-engineer   agent    v1.0.3   installed  official       │
└──────────────────────────────────────────────────────────────────────┘
```

*   **Scope Toggle**: Use `Tab` to switch between Project (`.claude/`) and Global (`~/.claude/`) installation.
*   **Dependency Closure**: Plug automatically includes all required dependencies in the plan.

---

### Flow 4: My Packages (Installed)
Manage your extensions across different scopes.

```
┌──────────────────────────────────────────────────────────────────────┐
│  plug  Discover  [Installed]  Vaults                                 │
├──────────────────────────────────────────────────────────────────────┤
│  SCOPE  NAME              TYPE     VER     VAULT                     │
│  [G]    senior-engineer   agent    v1.0.3  official                  │
│  [P]  ▶ superpowers       skill    v1.0.0  my-skills-repo            │
│                                                                       │
│  [G] global ~/.claude/   [P] project .claude/                        │
├──────────────────────────────────────────────────────────────────────┤
│  [Enter] detail   [d] uninstall   [u] update                         │
└──────────────────────────────────────────────────────────────────────┘
```

*   **Uninstall Safety**: If you try to remove a package that others depend on, Plug will prompt you to either cascade the removal or force-remove just the target.

---

### Flow 5: Vault Management
Add sources and manage authentication without touching a config file.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Add vault                                                           │
├──────────────────────────────────────────────────────────────────────┤
│  Name: company                                                        │
│  URL:  https://github.com/myco/claude-skills                         │
│  Token: ••••••••••••••••  (for private repos)                        │
└──────────────────────────────────────────────────────────────────────┘
```

*   **Community Discovery**: Browse a curated list of community vaults and add them with a single click.

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
