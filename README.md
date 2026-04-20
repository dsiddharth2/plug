# Plug

[![CI](https://github.com/dsiddharth2/plug/actions/workflows/ci.yml/badge.svg)](https://github.com/dsiddharth2/plug/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/plugvault)](https://www.npmjs.com/package/plugvault)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](https://nodejs.org)

**Plug** is a package manager for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Discover, install, and manage reusable Skills, Commands, and Agents across your projects through an interactive Terminal UI or the CLI.

## Why Plug?

Managing Claude Code extensions manually gets messy fast. Plug solves this:

- **Corporate & Private Ecosystems** — Set up internal "Vaults" (GitHub repos) to share proprietary coding standards, security guardrails, and specialized agents within your organization.
- **Consolidated Management** — One tool to discover, install, update, and remove extensions instead of manually copying Markdown files across projects.
- **PlugVault Ecosystem** — Access a growing registry of community-contributed extensions through the official [PlugVault](https://github.com/dsiddharth2/plugvault), or add your own custom vaults.
- **Zero-Bloat Workflow** — Install only what you need, either locally to a project (`.claude/`) or globally (`~/.claude/`).

---

## Quick Start

![Plug TUI](docs/images/tui-screenshot.png)

### 1. Install

```bash
npm install -g plugvault
```

### 2. Launch the TUI

Run `plug` with no arguments to open the interactive browser:

```bash
plug
```

### 3. Browse & Install

Use the TUI to explore packages across all your configured vaults:

| Key | Action |
|-----|--------|
| `Arrow Up/Down` | Navigate the package list |
| `Arrow Left/Right` | Switch tabs (Discover / Installed / Vaults) |
| `/` | Search by name or tags |
| `t` | Filter by type (skill, command, agent) |
| `Space` | Toggle selection |
| `Enter` | View package details |
| `i` | Install selected packages |
| `Esc` | Exit |

---

## What is Plug?

Claude Code extensions are Markdown files that live in `.claude/` directories. Plug manages these files like `npm` manages Node.js packages.

- **Skills** — Background context that shapes Claude's behavior (coding standards, architecture rules).
- **Commands** — Custom actions invoked with `/command-name` (code review, test generation).
- **Agents** — Specialized sub-agents for delegation (research, analysis).

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `plug` | Launch the interactive TUI |
| `plug tui` | Explicitly launch the TUI |
| `plug install <name>` | Install a package (with dependency resolution) |
| `plug remove <name>` | Remove a package (with dependent checking) |
| `plug update <name>` | Update a package to the latest version |
| `plug update --all` | Update all installed packages |
| `plug search <keyword>` | Search across all vaults |
| `plug list` | List installed packages |
| `plug list --remote` | List all available packages across vaults |
| `plug vault add` | Add a new vault (GitHub repo) |
| `plug vault remove` | Remove a configured vault |
| `plug init` | Initialize `.claude/` directory structure |

### Global flags

- `--global, -g` — Target the global `~/.claude/` scope instead of local `.claude/`
- `--verbose` — Show debug output (fetch URLs, auth method, cache hits)
- `--json` — Machine-readable JSON output
- `--yes` — Skip interactive prompts

---

## Vaults

Vaults are GitHub repositories that contain a `registry.json` index of packages. Plug ships with the official [PlugVault](https://github.com/dsiddharth2/plugvault) pre-configured, but you can add your own:

```bash
plug vault add https://github.com/your-org/your-vault
```

Private vaults are supported — Plug will prompt for a GitHub Personal Access Token when needed.

---

## Features

- **Interactive TUI** — Full-screen terminal UI with tabs for Discover, Installed, and Vaults
- **Dependency Resolution** — DFS resolver automatically installs required dependencies
- **Multi-File Packages** — Packages spanning multiple files are tracked and cleaned up correctly
- **Private Vaults** — Authenticate with GitHub PATs for private repositories
- **Smart Removal** — Dependent checking, cascade removal, and orphan pruning
- **Offline Cache** — Registry data is cached locally (1 hour TTL) for fast lookups

---

## Documentation

- **[TUI Guide](docs/features/tui.md)** — Detailed breakdown of the interactive interface and hotkeys
- **[Architecture](docs/architecture.md)** — How Plug works under the hood
- **[Authoring Guide](docs/authoring-guide.md)** — Create and publish your own packages
- **[Vaults & Registries](docs/features/vaults.md)** — Managing public and private package sources

---

## Contributing

Contributions welcome! See the [Contributing Guidelines](plug/CONTRIBUTING.md) for details.

---

## License

MIT © [Siddharth](https://github.com/dsiddharth2)
