---
name: plug
description: "Package manager for Claude Code extensions. Triggers on: plug install, plug remove, plug search, plug list, plug update, plug vault, plug init, install X from vault, remove X from vault, search vault, list installed packages."
argument-hint: "<command> [args...]"
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
---

# Plug — Claude Code Package Manager Skill

You are the `plug` skill. When triggered by any phrase matching the description above, execute the appropriate operation using the constants, routing table, and procedures in this file.

---

## 1. Constants

```
OFFICIAL_VAULT_NAME    = "official"
OFFICIAL_VAULT_OWNER   = "dsiddharth2"
OFFICIAL_VAULT_REPO    = "plugvault"
OFFICIAL_VAULT_BRANCH  = "main"

GITHUB_RAW_BASE        = "https://raw.githubusercontent.com"

CONFIG_PATH            = "~/.plugvault/config.json"
INSTALLED_LOCAL        = ".plugvault/installed.json"
INSTALLED_GLOBAL       = "~/.plugvault/installed.json"

TARGET_SKILLS          = ".claude/skills/"
TARGET_COMMANDS        = ".claude/commands/"
TARGET_AGENTS          = ".claude/agents/"
```

---

## 2. Command Routing Table

| User intent                     | Operation  | Reference                          |
|---------------------------------|------------|------------------------------------|
| `init`                          | Inline      | Section 5 below                    |
| `install X` / `install X from Y`| Install     | references/install.md              |
| `remove X` / `uninstall X`      | Remove      | Section 5 below                    |
| `list` / `list --remote`        | List        | references/search-and-list.md      |
| `search X`                      | Search      | references/search-and-list.md      |
| `update X` / `update --all`     | Update      | references/install.md              |
| `vault add/remove/list/...`     | Vault mgmt  | references/vault-management.md     |

When the user's intent matches a reference file, read that file and execute the procedure defined there.

---

## 3. Auth Resolution

Before any authenticated fetch, resolve the token for the target vault using this priority order:

1. Environment variable `PLUGVAULT_TOKEN_{VAULT_NAME_UPPERCASE}` (e.g., `PLUGVAULT_TOKEN_OFFICIAL`)
2. Environment variable `PLUGVAULT_GITHUB_TOKEN`
3. `token` field in `config.json` under `vaults[vaultName].token`
4. No token (public vault — proceed without auth header)

**Never echo or print the resolved token to the conversation.**

To resolve:
```bash
# Check env vars first (Bash tool)
TOKEN="${PLUGVAULT_TOKEN_OFFICIAL:-${PLUGVAULT_GITHUB_TOKEN:-}}"
# If empty, read from config.json using Read tool
```

---

## 4. Fetch Pattern

Use this pattern whenever fetching a file from a vault:

1. Read `~/.plugvault/config.json` to get vault details (`owner`, `repo`, `branch`)
2. Resolve auth token (Section 3)
3. Build the raw URL: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
4. Execute fetch:
   ```bash
   # Without auth (public vault):
   curl -sf "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"

   # With auth (private vault):
   curl -sf -H "Authorization: Bearer $TOKEN" "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
   ```
5. If curl exits non-zero or returns empty:
   - Exit code 22 / HTTP 404 → package or file not found
   - Exit code 22 / HTTP 401 or 403 → authentication failed
   - Other non-zero → network failure
6. Parse JSON output with built-in JSON parsing if needed

---

## 5. Inline Operations

### 5a. init

Initialize the plug directory structure in the current project:

```bash
mkdir -p .claude/skills .claude/commands .claude/agents .plugvault
```

If `.plugvault/installed.json` does not exist, create it:
```json
{ "installed": {} }
```

If `~/.plugvault/config.json` does not exist, create it with the default seed:
```json
{
  "vaults": {
    "official": {
      "name": "official",
      "owner": "dsiddharth2",
      "repo": "plugvault",
      "branch": "main",
      "private": false
    }
  },
  "resolve_order": ["official"],
  "default_vault": "official"
}
```

Report: "Initialized plug in current project."

### 5b. remove / uninstall

Remove an installed package by name:

1. Read the appropriate `installed.json` (local or global, based on scope)
2. Look up `installed[packageName]`
3. If not found: report "Package `{name}` is not installed." and stop
4. Get the `path` field from the entry
5. Delete the file: `Bash: rm "{path}"`
6. Remove the entry from `installed` object
7. Write the updated `installed.json`
8. Report: "Removed `{name}` from `{path}`."

---

## 6. Scope Handling

**Default scope:** local (current working directory paths — `.plugvault/installed.json`, `.claude/skills/`, etc.)

**Global scope:** triggered when user says `-g`, `--global`, or "globally"
- Use `~/.plugvault/installed.json` instead of `.plugvault/installed.json`
- Use `~/.claude/skills/`, `~/.claude/commands/`, `~/.claude/agents/`

When reading "My Packages," always read **both** scopes and merge with a `scope` label (`local` or `global`).

---

## Reference Files

For detailed procedures, read the appropriate file from `~/.claude/skills/plug/references/`:

- **references/config-schema.md** — JSON schemas for config.json, installed.json, registry.json, meta.json
- **references/install.md** — step-by-step install and update procedures
- **references/search-and-list.md** — list local, list remote, and search procedures
- **references/vault-management.md** — vault add, remove, list, set-default, set-token, sync
