# plugvault

A CLI for installing reusable Claude skills and commands from GitHub-hosted vaults.

```
npm install -g plugvault
```

Requires **Node.js 18+**.

---

## Quick Start

```bash
# 1. Initialize a project
cd my-project
plug init

# 2. Search for available packages
plug search review

# 3. Install a package
plug install code-review

# 4. Use it in Claude
# Commands: /code-review
# Skills:   automatically available in your Claude project
```

---

## Commands

### `plug init`

Sets up `.claude/skills/`, `.claude/commands/`, and `.plugvault/installed.json` in the current directory. Safe to run multiple times — skips existing directories.

```bash
plug init
```

---

### `plug install <name>`

Downloads a skill or command from a vault and places it in the correct `.claude/` directory.

```bash
plug install code-review            # install from any vault
plug install official/code-review   # install from a specific vault
plug install -g code-review         # install globally to ~/.claude/
```

**Options:**

| Flag | Description |
|------|-------------|
| `-g, --global` | Install to `~/.claude/` instead of the project directory |

If the same package exists in multiple vaults, you will be prompted to choose. Use `--yes` to auto-pick the first match.

---

### `plug remove <name>`

Removes an installed skill or command and updates `installed.json`.

```bash
plug remove code-review
plug remove -g code-review   # remove a globally installed package
```

**Options:**

| Flag | Description |
|------|-------------|
| `-g, --global` | Remove from the global `~/.claude/` installation |

---

### `plug list`

Shows all installed packages. Use `--remote` to list everything available across your vaults.

```bash
plug list                    # show installed packages
plug list --remote           # show all packages in all vaults
plug list --vault official   # filter by vault
plug list --type skill       # filter by type (skill or command)
```

**Options:**

| Flag | Description |
|------|-------------|
| `--remote` | Fetch and display all packages from vaults |
| `--vault <name>` | Filter by vault name |
| `--type <type>` | Filter by type: `skill` or `command` |

---

### `plug search <keyword>`

Searches package names, descriptions, and tags across all vaults with relevance scoring.

```bash
plug search review
plug search api --vault official
plug search design --type skill
```

**Options:**

| Flag | Description |
|------|-------------|
| `--vault <name>` | Search in a specific vault only |
| `--type <type>` | Filter by type: `skill` or `command` |

---

### `plug update <name>`

Checks for a newer version and re-downloads if one is available.

```bash
plug update code-review      # update a single package
plug update --all            # update all installed packages
```

**Options:**

| Flag | Description |
|------|-------------|
| `--all` | Update all installed packages |

---

### `plug vault`

Manages vault registries.

#### `plug vault add <name> <url>`

Registers a GitHub repository as a vault.

```bash
plug vault add myorg https://github.com/myorg/plugvault
plug vault add private-vault https://github.com/myorg/private-vault --token ghp_xxx --private
```

**Options:**

| Flag | Description |
|------|-------------|
| `--token <token>` | GitHub token for private repositories |
| `--private` | Mark the vault as private |

#### `plug vault remove <name>`

Removes a vault and clears its cache.

```bash
plug vault remove myorg
plug vault remove official --force   # the official vault requires --force
```

#### `plug vault list`

Shows all registered vaults with their URL, visibility, default status, and cached package count.

```bash
plug vault list
```

#### `plug vault set-default <name>`

Changes the default vault and moves it to the top of the resolve order.

```bash
plug vault set-default myorg
```

#### `plug vault set-token <name> <token>`

Updates the auth token for a vault and tests connectivity.

```bash
plug vault set-token private-vault ghp_newtoken
```

#### `plug vault sync`

Clears and re-fetches all vault registries to pick up new packages.

```bash
plug vault sync
```

---

## Global Flags

These flags work with every command and must be placed before the subcommand:

```bash
plug --verbose install code-review   # debug output: URLs, auth method, cache hits
plug --json list                     # machine-readable JSON output
plug --yes install code-review       # skip all interactive prompts
```

| Flag | Description |
|------|-------------|
| `--verbose` | Print debug info to stderr |
| `--json` | Output results as JSON to stdout |
| `--yes` | Auto-confirm overwrites, auto-pick first vault on conflict |

---

## Vault Management

### Multiple Vaults

You can register multiple vaults. Packages are resolved in the configured order — the default vault is checked first.

```bash
plug vault add work https://github.com/mycompany/claude-skills
plug vault set-default work
plug vault list
```

### Private Vaults

Private GitHub repositories require a personal access token with `repo` read scope.

**Option 1 — Store in config:**

```bash
plug vault add private-vault https://github.com/myorg/private-vault \
  --token ghp_yourtoken \
  --private
```

**Option 2 — Environment variables:**

```bash
# Vault-specific token (takes priority)
export PLUGVAULT_TOKEN_PRIVATE_VAULT=ghp_yourtoken

# Generic fallback token
export PLUGVAULT_GITHUB_TOKEN=ghp_yourtoken
```

Token resolution order: `PLUGVAULT_TOKEN_{VAULT_NAME}` → `PLUGVAULT_GITHUB_TOKEN` → config file token.

---

## How Packages Work

**Commands** are placed in `.claude/commands/` and invoked with a `/` prefix in Claude:

```
/code-review
```

**Skills** are placed in `.claude/skills/` and are automatically loaded as context in your Claude project.

**Global vs. project-local:** Use `-g` to install to `~/.claude/` (available in all projects). Without `-g`, packages are installed in the current project's `.claude/` directory.

---

## Error Reference

| Error | Cause | Fix |
|-------|-------|-----|
| `Connection failed. Check your internet connection.` | No network | Check connectivity |
| `Package '<name>' not found in any vault.` | Package doesn't exist | Run `plug search <name>` |
| `Authentication failed for vault '<name>'.` | Missing or invalid token | `plug vault set-token <name> <token>` |
| `Cannot write to <path>. Check permissions.` | File permission denied | Fix directory permissions |
| `Warning: config.json was corrupt. Backed up and reset.` | Corrupt config | Automatically recovered; check `config.json.bak` |

---

## Storage Layout

```
~/.plugvault/
  config.json           # vault registrations and settings
  cache/                # cached registry.json files (1-hour TTL)

<project>/
  .plugvault/
    installed.json      # tracks locally installed packages
  .claude/
    commands/           # installed Claude commands
    skills/             # installed Claude skills
```

---

## License

MIT
