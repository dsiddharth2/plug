# plug

A package manager for Claude Code. Install reusable skills and commands into any project from GitHub-hosted registries.

```bash
npm install -g plugvault
plug init
plug install code-review
```

## What is this?

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) supports two types of extensions:

- **Skills** (`.claude/skills/*.md`) — background context that shapes how Claude works in your project. Think coding standards, API patterns, architecture rules.
- **Commands** (`.claude/commands/*.md`) — on-demand actions you invoke with `/command-name`. Think code review, test generation, documentation.

These are just markdown files. `plug` makes it easy to share, discover, and install them across projects — like npm, but for `.md` files.

## Install

```bash
npm install -g plugvault
```

Requires Node.js 18+.

## Getting started

```bash
# Set up your project
cd my-project
plug init

# Browse what's available
plug search review
plug list --remote

# Install a package
plug install code-review

# Now use it in Claude Code
# /code-review  (for commands)
# Skills load automatically as project context
```

## Commands

### `plug init`

Creates `.claude/skills/`, `.claude/commands/`, and `.plugvault/installed.json` in the current directory. Safe to re-run.

### `plug install <name>`

```bash
plug install code-review              # from any vault (resolve order)
plug install official/code-review     # from a specific vault
plug install -g code-review           # install globally to ~/.claude/
```

Downloads the package from a vault and places it in the correct `.claude/` subdirectory. If the package exists in multiple vaults, you'll be prompted to choose (or use `--yes` to auto-pick the first match).

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
plug search design --vault official
```

Searches names, descriptions, and tags across all vaults. Results are ranked by relevance.

### `plug update`

```bash
plug update code-review               # update one package
plug update --all                     # update everything
```

Checks the registry for newer versions and re-downloads if available.

### `plug vault <subcommand>`

Manage registry sources.

```bash
plug vault list                       # show registered vaults
plug vault add work https://github.com/mycompany/claude-skills
plug vault add private https://github.com/myorg/vault --token ghp_xxx --private
plug vault remove work
plug vault set-default work           # change resolve order
plug vault set-token private ghp_new  # update auth token
plug vault sync                       # re-fetch all registries
```

## Global flags

Placed before the subcommand:

```bash
plug --verbose install code-review    # debug output to stderr
plug --json list                      # machine-readable JSON to stdout
plug --yes install code-review        # skip all prompts
```

## Vaults

A vault is a GitHub repository with a `registry.json` at its root. The official vault is registered by default.

### Multiple vaults

```bash
plug vault add work https://github.com/mycompany/claude-skills
plug vault set-default work
```

Packages resolve in configured order. The default vault is checked first.

### Private vaults

Private repos need a GitHub personal access token with `repo` read scope.

```bash
# Store token in config
plug vault add corp https://github.com/corp/skills --token ghp_xxx --private

# Or use environment variables
export PLUGVAULT_TOKEN_CORP=ghp_xxx          # vault-specific (highest priority)
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
```

`plug install` fetches `registry.json` from the vault, looks up the package, downloads its `meta.json` and `.md` file, and places the `.md` in the right directory. Package metadata is tracked in `installed.json` for updates and removal.

## Creating packages

See the [Skill Authoring Guide](docs/authoring-guide.md) for the full walkthrough. The short version:

A package is a directory in a vault registry containing two files:

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
