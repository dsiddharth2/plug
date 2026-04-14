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

| User intent                                    | Operation   | Reference                          |
|------------------------------------------------|-------------|------------------------------------|
| `init`                                         | Inline       | Section 5a below                   |
| `install X` / `install X from Y`              | Install      | references/install.md              |
| `remove X` / `uninstall X`                    | Remove       | Section 5b below                   |
| `list` / `list --remote`                      | List         | references/search-and-list.md      |
| `search X`                                    | Search       | references/search-and-list.md      |
| `update X` / `update --all`                   | Update       | references/install.md              |
| `vault add/remove/list/set-default/set-token/sync` | Vault mgmt | references/vault-management.md |

When the user's intent matches a reference file, read that file using the Read tool and execute the procedure defined there. Do not guess at procedures — always read the reference file first.

---

## 3. Auth Resolution

Before any fetch that may require authentication, resolve the token for the target vault. Use this **exact priority order**:

1. **Env var per vault:** `PLUGVAULT_TOKEN_{VAULT_NAME_UPPERCASE}`
   - Example: vault named `official` → check `$PLUGVAULT_TOKEN_OFFICIAL`
   - Example: vault named `mycorp` → check `$PLUGVAULT_TOKEN_MYCORP`
2. **Generic env var:** `PLUGVAULT_GITHUB_TOKEN`
3. **Config file token:** Read `~/.plugvault/config.json`, look up `vaults[vaultName].token`
4. **No token:** If all above are empty/missing and `vault.private` is `false`, proceed without auth header

**When the vault is private and no token was found at steps 1–3:**
Do not attempt the fetch silently. Instead, report to the user:
```
Vault "{vaultName}" is marked private but no token is configured.
To fix: set env var PLUGVAULT_TOKEN_{VAULT_NAME_UPPER} or run /plug → Manage Vaults → set-token.
```
Then stop the current operation.

**Token resolution in bash:**
```bash
VAULT_UPPER=$(echo "{vaultName}" | tr '[:lower:]' '[:upper:]')
TOKEN="${PLUGVAULT_TOKEN_${VAULT_UPPER}:-${PLUGVAULT_GITHUB_TOKEN:-}}"
# If TOKEN is still empty, try config.json (read with Read tool, extract .vaults[name].token)
```

**Security rule: Never echo, print, or include the resolved token in any chat output, confirmation message, or log line.** The token must only appear as a shell variable passed directly to curl.

---

## 4. Fetch Pattern

Use this exact pattern whenever fetching any file from a vault. This pattern correctly captures and distinguishes HTTP error codes so operations can fail with precise messages rather than generic errors.

### 4.1 Setup

1. Read `~/.plugvault/config.json` using the Read tool. Extract:
   - `vaults[vaultName].owner`
   - `vaults[vaultName].repo`
   - `vaults[vaultName].branch`
2. Resolve auth token (Section 3)
3. Build the raw GitHub URL:
   ```
   https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
   ```

### 4.2 Execute Fetch with HTTP Status Capture

Use `-o` to write body to a temp file and `-w '%{http_code}'` to capture the numeric HTTP status code. This is the **only reliable way** to distinguish 404 from 401/403 — `curl -sf` alone returns exit code 22 for all HTTP errors ≥ 400.

```bash
# Without auth (public vault):
HTTP_STATUS=$(curl -s -o /tmp/plug_response -w '%{http_code}' \
  "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}")

# With auth (private vault):
HTTP_STATUS=$(curl -s -o /tmp/plug_response -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}")
```

Then read the response body:
```bash
BODY=$(cat /tmp/plug_response)
```

### 4.3 Error Handling by HTTP Status

Branch on the captured `$HTTP_STATUS`:

| HTTP Status | Meaning                 | Action                                                   |
|-------------|-------------------------|----------------------------------------------------------|
| `200`       | Success                 | Use `$BODY` — parse as JSON or read as text              |
| `404`       | Not found               | Report: "Could not find `{path}` in vault `{vaultName}`. Check that the package name and vault are correct." |
| `401`       | Auth required           | Report: "Vault `{vaultName}` requires authentication. Set `PLUGVAULT_TOKEN_{VAULT_UPPER}` or configure a token via `/plug` → Manage Vaults → set-token." |
| `403`       | Forbidden               | Report: "Access denied to vault `{vaultName}`. Your token may lack `repo` read scope or the repository is not accessible." |
| other 4xx   | Client error            | Report: "HTTP {status} fetching `{path}` from `{vaultName}`." |
| `000`       | Network failure         | Report: "Network error — could not reach GitHub. Check your connection." |
| other 5xx   | Server error            | Report: "GitHub returned HTTP {status}. Try again in a moment." |

After reporting any error, stop the current operation unless the calling procedure has explicit retry logic.

### 4.4 JSON Parsing

When the fetched file is JSON (registry.json, config.json, meta.json, installed.json), use the Bash tool with inline python or a simple grep/awk to extract fields. Example — extract all package names from registry.json:

```bash
# Using python3 (preferred):
echo "$BODY" | python3 -c "import sys,json; r=json.load(sys.stdin); [print(k) for k in r['packages']]"

# Fallback — using grep (for simple key extraction):
echo "$BODY" | grep '"name"' | head -1
```

---

## 5. Inline Operations

### 5a. init

Initialize the plug directory structure in the current project. Run all steps even if some directories already exist (`mkdir -p` is idempotent).

**Step 1 — Create local directories:**
```bash
mkdir -p .claude/skills .claude/commands .claude/agents .plugvault
```

**Step 2 — Create local installed.json if missing:**

Check with Glob: `.plugvault/installed.json`. If not found, write:
```json
{ "installed": {} }
```

**Step 3 — Create global config.json if missing:**

Check with Glob: `~/.plugvault/config.json`. If not found, create `~/.plugvault/` and write the default seed:
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

**Step 4 — Report:**
```
Initialized plug in current project.
  Created: .claude/skills/, .claude/commands/, .claude/agents/, .plugvault/
  Config:  ~/.plugvault/config.json (official vault registered)
```

If config already existed, omit the "Config:" line from the report.

### 5b. remove / uninstall

Remove an installed package and clean up its tracking entry.

**Step 1 — Determine scope:** Default = local. If user said `-g`, `--global`, or "globally", use global scope.

**Step 2 — Read installed.json:**
- Local: `.plugvault/installed.json`
- Global: `~/.plugvault/installed.json`

If the file does not exist, report: "No packages installed in {scope} scope." and stop.

**Step 3 — Look up package:**

Check `installed[packageName]`. If key not found:
```
Package `{name}` is not installed in {scope} scope.
Tip: run `plug list` to see installed packages.
```
Stop.

**Step 4 — Confirm the file path:** Read the `path` field from the installed entry. Verify the file exists using Glob. If the file is missing (already deleted manually):
- Remove the stale entry from installed.json anyway (Step 6–7 below)
- Report the file was already missing but tracking entry was cleaned up

**Step 5 — Delete the file:**
```bash
rm "{path}"
```

**Step 6 — Remove entry from installed.json:** Delete the `installed[packageName]` key from the JSON object.

**Step 7 — Write updated installed.json** using the Write tool.

**Step 8 — Report:**
```
Removed `{name}` ({type}) from `{path}`.
installed.json updated.
```

---

## 6. Scope Handling

### Default vs Global

| Trigger words              | Scope  | Config file                    | Target dirs                          |
|----------------------------|--------|--------------------------------|--------------------------------------|
| (none / default)           | local  | `.plugvault/installed.json`    | `.claude/skills/`, `.claude/commands/`, `.claude/agents/` |
| `-g`, `--global`, "globally" | global | `~/.plugvault/installed.json` | `~/.claude/skills/`, `~/.claude/commands/`, `~/.claude/agents/` |

The global `~/.plugvault/config.json` (vault list) is always read regardless of scope — it is the single source of truth for registered vaults.

### Conflict resolution when same package exists in both scopes

When reading "My Packages" (list + update check), always merge both scopes. If the same package name appears in both local and global `installed.json`:
- Show both entries with their scope labels in the table
- For `remove`: ask the user which scope to remove from (show a panel with "local", "global", or "both")
- For `update`: update each entry independently (they may have been installed from different vaults or at different times)

### Auto-init on missing dirs

If a local scope operation targets a directory that doesn't exist (e.g., `.claude/commands/` missing), run the `init` operation inline before proceeding. Do not fail — create the missing structure silently.

---

## 7. Semver Comparison

Version strings follow semver format (`major.minor.patch`, e.g., `"1.10.2"`). **Do not use plain string comparison** — it breaks for multi-digit segments (`"1.9.0"` sorts lexicographically after `"1.10.0"`).

Use this comparison approach when checking if a newer version is available:

```bash
# Split both versions and compare segment-by-segment as integers
compare_versions() {
  local installed="$1"  # e.g., "1.9.0"
  local latest="$2"     # e.g., "1.10.0"
  IFS='.' read -r i_maj i_min i_pat <<< "$installed"
  IFS='.' read -r l_maj l_min l_pat <<< "$latest"
  if [ "$l_maj" -gt "$i_maj" ]; then echo "newer"; return; fi
  if [ "$l_maj" -lt "$i_maj" ]; then echo "older"; return; fi
  if [ "$l_min" -gt "$i_min" ]; then echo "newer"; return; fi
  if [ "$l_min" -lt "$i_min" ]; then echo "older"; return; fi
  if [ "$l_pat" -gt "$i_pat" ]; then echo "newer"; return; fi
  if [ "$l_pat" -lt "$i_pat" ]; then echo "older"; return; fi
  echo "same"
}
```

Output is `"newer"`, `"older"`, or `"same"`. Flag a package as "Update available" only when output is `"newer"`.

---

## Reference Files

For detailed procedures, read the appropriate file from `~/.claude/skills/plug/references/`:

- **references/config-schema.md** — JSON schemas for config.json, installed.json, registry.json, meta.json
- **references/install.md** — step-by-step install and update procedures with conflict and error handling
- **references/search-and-list.md** — list local, list remote, and search procedures with scoring algorithm
- **references/vault-management.md** — vault add, remove, list, set-default, set-token, sync with all interactive panels
