# Architecture

Plug is a package manager for Claude Code extensions, designed to be lightweight, decentralized, and accessible through both a CLI and a native Claude Code Skill.

## Why Plug? (The Value Proposition)

In a corporate or team environment, maintaining consistency in Claude's behavior is critical. Plug addresses this by providing:

1.  **Centralized Governance**: Define "Vaults" (registries) that house your organization's coding standards, security rules, and architectural guidelines.
2.  **Private Ecosystems**: Support for private GitHub repositories allows companies to distribute proprietary skills and agents securely using standard GitHub authentication (PAT).
3.  **Anti-Bloat Architecture**: One "harness" (Plug) manages all your extensions. You no longer need to manually sync Markdown files or maintain redundant harnesses across multiple projects.
4.  **Community Knowledge**: The official `plugvault` provides a curated set of community best practices that can be shared and improved collectively.

## High-Level Design

Plug operates on a "Vault" model. A Vault is any GitHub repository that follows a simple registry structure.

1.  **Registries**: GitHub-hosted JSON files (`registry.json`) that index available packages.
2.  **Packages**: Markdown files (`.md`) accompanied by a `meta.json` file.
3.  **Clients**:
    *   **CLI**: A Node.js application (`plugvault` on npm) for advanced use and CI/CD.
    *   **Skill**: A native Claude Code skill that allows managing packages via natural language or the interactive `/plug` command.

## Core Components

### 1. Vault Ecosystem (PlugVault)
A "Vault" is the unit of distribution. While the official `plugvault` repository serves as the primary community registry, Plug is designed to be multi-vault. Users can register any number of public or private vaults.
*   **Resolution Order**: Plug searches vaults in a user-defined order, allowing internal corporate packages to override or supplement community versions.
*   **Decentralization**: No central server is required; all package metadata and content live on GitHub.

### 2. Execution Engines

#### Claude Code Skill (Recommended)
The Skill is the primary interface for most users. It runs directly within Claude Code, using Claude's native tools (`Bash`, `Read`, `Write`) to:
*   Fetch registries via `curl`.
*   Install packages directly into `.claude/skills/`, `.claude/commands/`, or `.claude/agents/`.
*   Provide an interactive TUI experience via the `/plug` slash command.

#### CLI (Node.js)
The CLI provides similar functionality for environments where Node.js is preferred or required (e.g., automation scripts). It uses a Terminal User Interface (TUI) built with Ink for an interactive experience.

### 2. TUI (Terminal User Interface)
Built with **Ink** (React for CLI), the TUI provides a rich, interactive experience for:
*   **Discovering**: Browsing and searching the global registry.
*   **Managing**: Viewing installed packages and checking for updates.
*   **Configuring**: Adding or removing Vaults and managing authentication tokens.

**Key Technical Feature: Context-Aware Output Capture**
The TUI uses `AsyncLocalStorage` to intercept `stdout` during command execution (like `git clone` or `npm install` within a package). This allows the TUI to remain responsive and render its own UI while capturing background task output.

### 3. Storage & Configuration

*   **Global Config**: `~/.plugvault/config.json` stores registered vaults, resolve order, and authentication tokens.
*   **Tracking**: `installed.json` files (local to the project or global in `~/`) track which packages are installed, their versions, and their source vaults.

## Extension Types

Plug supports three types of Claude Code extensions:

1.  **Skills**: Procedural knowledge and background context stored in `.claude/skills/`.
2.  **Commands**: On-demand slash commands stored in `.claude/commands/`.
3.  **Agents**: Specialized sub-agents for task delegation, stored in `.claude/agents/`.

## Workflows

Plug supports two primary workflows, bridging the gap between deep terminal discovery and zero-latency in-conversation management.

### 1. TUI/CLI Workflow (The Discovery Engine)
The TUI (powered by Node.js/Ink) is the rich, interactive "Browser" for the extension ecosystem.
*   **Trigger**: User runs `plug` or `/plug` in a real terminal.
*   **Fetch**: The client pulls `registry.json` from all configured vaults (official + corporate).
*   **Search**: Real-time filtering by name, description, or tags.
*   **Batch Action**: Users can toggle multiple packages and install/update/remove them in a single operation.
*   **Capture**: Background tasks (like `git clone`) are captured via `AsyncLocalStorage` to keep the UI responsive.

### 2. Claude Native Workflow (Zero-Latency Installer)
The upcoming native integration allows managing extensions without leaving the Claude conversation, using a "smart installer" approach.
*   **Trigger**: User types `/plug` inside Claude Code.
*   **Zero-Latency**: Claude reads `~/.claude/commands/plug.md`—a pure instruction file that bypasses reasoning and immediately triggers `AskUserQuestion`.
*   **Search (Natural Language)**: Claude fetches the `community-index.json`, performs semantic matching against user intent (e.g., "I need a security tool"), and presents matches.
*   **Native Tools**: Installation is performed directly using Claude's native `Bash` (via `curl`), `Read`, and `Write` tools. No Node.js runtime is invoked during this flow.
*   **Outcome**: Extensions are written directly to `.claude/` and are immediately available for use in the next turn.

## The Unified Harness: Solving "Multi-Repo Bloat"

Before Plug, using extensions from different sources required multiple specialized harnesses, leading to fragmented configurations and "tool bloat" within projects.

Plug acts as the **unified harness**:
*   **Single Source of Truth**: All extensions, regardless of their origin (official registry, company internal repo, or personal vault), are managed via one consistent interface.
*   **Unified Pathing**: Extensions are routed to standard Claude Code directories (`.claude/skills/`, etc.) based on their type, ensuring Claude can always find them.
*   **Global vs. Project Scoping**: Plug manages the complexity of global (`~/.claude/`) vs. project-specific (`.claude/`) installation, preventing duplicate configurations and ensuring a clean development environment.

## Security

*   **Authentication**: Supports GitHub Personal Access Tokens (PAT) for private vaults. Tokens are stored in the global config or provided via environment variables (`PLUGVAULT_GITHUB_TOKEN`).
*   **Non-TTY Guard**: Ensures that the TUI and interactive prompts don't hang in non-interactive environments (like CI).

## Data Flow

1.  **Fetch**: Client retrieves `registry.json` from registered GitHub Vaults.
2.  **Resolve**: Client matches package names against the registry, respecting the vault "resolve order".
3.  **Install**: Client downloads `meta.json` and the `.md` entry point, then writes them to the appropriate `.claude/` subdirectory.
4.  **Track**: Client updates `installed.json` to record the installation for future updates or removal.
