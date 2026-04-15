# plug

A package manager for Claude Code. Install reusable skills and commands into any project from GitHub-hosted registries.

```bash
npm install -g plugvault
plug          # launch the interactive TUI (primary interface)
```

## What is this?

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) supports three types of extensions:

- **Skills** (`.claude/skills/*.md`) — background context that shapes how Claude works in your project. Think coding standards, API patterns, architecture rules.
- **Commands** (`.claude/commands/*.md`) — on-demand actions you invoke with `/command-name`. Think code review, test generation, documentation.
- **Agents** (`.claude/agents/*.md`) — specialized sub-agents that Claude can delegate tasks to via the `Agent` tool. Think background research, long-running analysis, parallel workstreams.

These are just markdown files. `plug` makes it easy to share, discover, and install them across projects — like npm, but for `.md` files.

## Install

```bash
npm install -g plugvault
```

Requires Node.js 18+.

## TUI (Interactive Mode)

Running `plug` with no arguments launches the interactive terminal UI — the primary way to use plug.

```bash
plug        # open TUI
plug tui    # explicit subcommand
```

### Using plug from Claude Code

You can launch the TUI directly from a Claude Code session:

```
! plug
```

The `!` prefix runs shell commands from within Claude Code. This opens the full interactive TUI where you can browse, install, and manage packages without leaving your workflow.

### TUI Navigation

The TUI has three tabs navigated with **left/right arrows**:

```
[ Discover ]   Installed   Vaults
```

#### Discover tab

Browse and install packages from all configured vaults.

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move cursor |
| `Enter` | Open package detail |
| `Space` | Toggle selection (multi-install) |
| `i` | Install cursor/selected packages |
| `/` | Focus search box |
| `Esc` | Unfocus search / go back |

- Type after pressing `/` to filter packages live. The status line shows how many results match.
- If no packages match your search, the list shows a "No results for '…'" message.
- When offline, plug shows a warning and uses cached registry data if available.

#### Installed tab

Manage packages already installed in the current project or globally.

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move cursor |
| `Enter` | Open package detail |
| `Space` | Toggle selection |
| `u` | Update cursor/selected packages |
| `r` | Remove cursor/selected (with confirmation) |

#### Vaults tab

Manage registry sources (vaults).

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move cursor |
| `a` | Add a new vault |
| `r` | Remove selected vault |
| `d` | Set selected vault as default |
| `s` | Sync all vaults (re-fetch registries) |

Press **Esc** or **Ctrl+C** to exit the TUI at any time.

---

## CLI Scripting

The TUI is the primary interface, but all operations are also available as CLI commands for scripting and CI pipelines.

### `plug init`

Creates `.claude/skills/`, `.claude/commands/`, `.claude/agents/`, and `.plugvault/installed.json` in the current directory. Safe to re-run.

### `plug install <name>`

```bash
plug install code-review              # from any vault (resolve order)
plug install official/code-review     # from a specific vault
plug install -g code-review           # install globally to ~/.claude/
```

### `plug remove <name>`

```bash
plug remove code-review
plug remove -g code-review            # remove a global install
```

### `plug list`

```bash
plug list                             # installed packages
plug list --remote                    # everything available across vaults
plug list --remote --type skill       # filter by type
plug list --remote --vault official   # filter by vault
```

### `plug search <keyword>`

```bash
plug search review
plug search api --type skill
plug search assistant --type agent
```

### `plug update`

```bash
plug update code-review               # update one package
plug update --all                     # update everything
```

### `plug vault <subcommand>`

```bash
plug vault list
plug vault add work https://github.com/mycompany/claude-skills
plug vault remove work
plug vault set-default work
plug vault set-token private ghp_new
plug vault sync
```

## Global flags

```bash
plug --verbose install code-review    # debug output to stderr
plug --json list                      # machine-readable JSON to stdout
plug --yes install code-review        # skip all prompts
```

## Vaults

A vault is a GitHub repository with a `registry.json` at its root. The official vault is registered by default.

### Private vaults

Private repos need a GitHub personal access token with `repo` read scope.

```bash
plug vault add corp https://github.com/corp/skills --token ghp_xxx --private

# Or use environment variables
export PLUGVAULT_TOKEN_CORP=ghp_xxx          # vault-specific
export PLUGVAULT_GITHUB_TOKEN=ghp_xxx        # fallback for all vaults
```

Token resolution: `PLUGVAULT_TOKEN_{VAULT_NAME}` > `PLUGVAULT_GITHUB_TOKEN` > config file.

## How it works

```
~/.plugvault/
  config.json          # vault registrations
  cache/               # registry.json cache (1-hour TTL)

<project>/
  .plugvault/
    installed.json     # tracks installed packages
  .claude/
    commands/          # installed commands
    skills/            # installed skills
    agents/            # installed agents
```

Registries are cached for 1 hour. When offline, plug uses cached data automatically and shows a warning.

## Creating packages

See the [Skill Authoring Guide](docs/authoring-guide.md) for the full walkthrough. The short version:

```
registry/my-package/
  meta.json            # name, version, type, description, tags, entry
  my-package.md        # the actual skill or command content
```

```json
{
  "name": "my-package",
  "type": "command",
  "version": "1.0.0",
  "description": "One-line description for search results",
  "tags": ["tag1", "tag2"],
  "entry": "my-package.md"
}
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and code style.
To contribute packages to the official registry, see the [registry CONTRIBUTING guide](../plugvault/CONTRIBUTING.md).

## License

MIT
