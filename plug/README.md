# Plug CLI

The `plugvault` command-line interface (CLI) is a powerful tool for managing Claude Code extensions. It features a rich, interactive Terminal User Interface (TUI) for everyday use, while also providing a full suite of traditional CLI commands for automation and CI/CD.

## Installation

```bash
npm install -g plugvault
```

---

## 🚀 Usage: The Plug TUI (Recommended)

Running `plug` with no arguments launches the interactive TUI. This is the easiest way to discover, install, and manage your extensions.

```bash
plug
```

### Key Interactions:
*   **Navigate**: Use `Arrows` to move through the package list.
*   **Search**: Press `/` to focus the search box and filter by name or tags.
*   **Select**: Press `Space` to toggle package selection for batch operations.
*   **Install**: Press `Enter` to install your selected packages.
*   **Tabs**: Press `Tab` to switch between **Discover**, **My Packages**, and **Vaults**.
*   **Quit**: Press `q` to exit.

---

## Common CLI Commands

For non-interactive use (scripts, CI, etc.), Plug provides the following commands:

### `init`
Initialize the current directory for Plug extensions.
```bash
plug init
```

### `install`
Directly install a package by name. If the package has dependencies, `plug` resolves and installs them first, then prompts for confirmation (skip with `--yes`).
```bash
plug install code-review
plug install -g my-vault/api-patterns  # Global installation
plug install subagent-driven-development --yes  # Auto-confirm dep plan
```

If an installed skill declares `hook:` in its frontmatter, a notice is printed reminding you to add the hook to `settings.json`.

### `remove`
Uninstall a package. If other packages depend on it, `plug` prompts with Cancel / Cascade / Force options. After removal, orphaned auto-installed dependencies are offered for pruning.
```bash
plug remove code-review
plug remove code-review --cascade  # Also remove dependent packages (one level)
plug remove code-review --force    # Remove only target; sever dependent edges
plug remove code-review --yes      # Auto-prune orphans without prompting
```

### `list`
List all currently installed packages. Use `--remote` to see all available packages.
```bash
plug list
plug list --remote
```

### `update`
Check for and apply updates.
```bash
plug update --all
```

### `vault`
Manage package sources.
```bash
plug vault list
plug vault add my-vault https://github.com/owner/repo
```

---

## Advanced: Non-TTY Mode

Plug automatically detects non-interactive environments (like CI) and disables the TUI. Use `--json` for machine-readable output.

```bash
plug list --json
```

---

## Technical Details

*   **Global Config**: `~/.plugvault/config.json`
*   **Local Tracking**: `./.plugvault/installed.json`
*   **Global Tracking**: `~/.plugvault/installed.json`
