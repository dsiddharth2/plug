---
name: plug
description: "Package manager for Claude Code extensions. Triggers on: plug install, plug remove, plug search, plug list, plug update, plug vault, plug init, install X from vault, remove X from vault, search vault, list installed packages."
argument-hint: "<command> [args...]"
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "AskUserQuestion"]
---

# Plug — Claude Code Package Manager Skill

You are the `plug` skill. When triggered by any phrase matching the description above, execute the appropriate operation using the constants, routing table, and procedures in this file.

---

## Interactive Mode (/plug)

When the user invokes /plug with no arguments, present the main menu. When invoked with arguments (e.g., /plug install X), route directly to the appropriate operation. Read ~/.claude/skills/plug/references/ files as needed for detailed procedures.

### Main Menu

```json
AskUserQuestion:
  question: "What would you like to do?"
  header: "Plug"
  multiSelect: false
  options:
    - label: "Browse Packages"
      description: "See all available packages across your registered vaults"
    - label: "Search"
      description: "Find packages by keyword, tag, or description"
    - label: "My Packages"
      description: "View installed packages and check for updates"
    - label: "Manage Vaults"
      description: "Add, remove, or configure package registries"
```

When the user selects an option from the Main Menu, follow the matching branch below immediately — no file reads needed.

---

### Browse Packages Flow

#### Step 1 — Fetch all packages (no panel)

1. Read `~/.plugvault/config.json` — get registered vaults and resolve_order
2. For each vault in resolve_order:
   - Resolve auth token (Section 3)
   - Use the fetch pattern from Section 4 to fetch `registry.json`
   - Parse packages into combined list, tagging each with vault name
3. Deduplicate: if same package name exists in multiple vaults, keep the one from the highest-priority vault

#### Step 2 — Filter by type panel

```json
AskUserQuestion:
  question: "Which type of packages do you want to browse?"
  header: "Type"
  multiSelect: false
  options:
    - label: "All"
      description: "Show all available packages (skills, commands, agents)"
    - label: "Skills"
      description: "Procedural knowledge, workflows, domain expertise"
    - label: "Commands"
      description: "Slash commands (/name) for one-off utilities"
    - label: "Agents"
      description: "Specialized sub-agents for parallel execution"
```

#### Step 3 — Display package table (chat output)

Filter combined list by selected type. Read `.plugvault/installed.json` and `~/.plugvault/installed.json` to mark already-installed packages.

```
## Available Packages (official vault)

| #  | Name           | Type    | Version | Description                              |
|----|----------------|---------|---------|------------------------------------------|
| 1  | code-review    | command | 1.0.0   | Deep code review with security analysis  |
| 2  | api-patterns   | skill   | 1.0.0   | REST API design patterns and conventions |
| 3  | test-writer    | agent   | 1.0.0   | Generates unit tests for your code       |
| 4  | git-workflow   | command | 1.0.0   | Standardized git branching workflow      |

Showing 4 packages. 0 already installed.
```

**If no packages found:**
```
No packages available in registered vaults. Use /plug → Manage Vaults to add a vault.
```
Stop — no further panels.

#### Step 4 — Install prompt panel

Offer top 4 uninstalled packages (or fewer if fewer available):

```json
AskUserQuestion:
  question: "Would you like to install any of these?"
  header: "Install"
  multiSelect: true
  options:
    - label: "code-review"
      description: "command · v1.0.0 — Deep code review with security analysis"
    - label: "api-patterns"
      description: "skill · v1.0.0 — REST API design patterns and conventions"
    - label: "test-writer"
      description: "agent · v1.0.0 — Generates unit tests for your code"
    - label: "git-workflow"
      description: "command · v1.0.0 — Standardized git branching workflow"
    - label: "Other"
      description: "Type a package name not listed above"
```

If user selects nothing or cancels, output: "No packages installed." and stop.

If user selects "Other": ask in chat — "Please type the package name you want to install:" — then proceed to Step 5 treating the typed name as the selected package.

**Conflict handling:** If a selected package is already in installed.json, show this panel before installing it:

```json
AskUserQuestion:
  question: "code-review v1.0.0 is already installed. Overwrite?"
  header: "Conflict"
  multiSelect: false
  options:
    - label: "Overwrite"
      description: "Replace the existing file with the latest version from the vault"
    - label: "Skip"
      description: "Keep the current installation unchanged"
```

If user selects "Skip", move to the next selected package.

#### Step 5 — Install selected packages (procedural)

For each selected package, read `~/.claude/skills/plug/references/install.md` and follow the full install procedure defined there.

#### Step 6 — Installation confirmation (chat output)

```
## Installed 2 packages

| Package      | Type    | Installed To                      |
|--------------|---------|-----------------------------------|
| code-review  | command | .claude/commands/code-review.md   |
| api-patterns | skill   | .claude/skills/api-patterns.md    |

Use `/code-review` to run the code review command.
The api-patterns skill will auto-activate when relevant.
```

---

### Search Flow

#### Step 1 — Category panel

```json
AskUserQuestion:
  question: "What are you looking for?"
  header: "Search"
  multiSelect: false
  options:
    - label: "API & HTTP"
      description: "REST, GraphQL, API design, HTTP patterns"
    - label: "Testing"
      description: "Unit tests, integration tests, test automation"
    - label: "Code Quality"
      description: "Reviews, linting, refactoring, security"
    - label: "DevOps & CI"
      description: "Pipelines, deployment, infrastructure"
    - label: "Other"
      description: "Enter a custom keyword"
```

Map selected category to search keywords:
- "API & HTTP" → ["api", "http", "rest", "graphql"]
- "Testing" → ["test", "testing", "tdd", "unit", "integration"]
- "Code Quality" → ["review", "quality", "lint", "refactor", "security"]
- "DevOps & CI" → ["devops", "ci", "deploy", "pipeline", "infrastructure"]
- "Other" → ask user to type free-text keyword in next message

If "Other" selected: output the prompt as a chat message — "Please type your search keyword:" — then wait for the user's next message. Parse that message as the keyword and proceed to Step 2. Do not use AskUserQuestion for free-text input.

#### Step 2 — Fetch and score (no panel)

1. Fetch registry.json from all vaults using the fetch pattern from Section 4
2. For each package, compute relevance score against keyword(s):
   - Exact name match: **40 points**
   - Partial name match (keyword is substring of name): **30 points**
   - Description contains keyword: **20 points**
   - Tag match: **10 points**
3. Sum scores, filter to score > 0, sort descending

#### Step 3 — Ranked results table (chat output)

```
## Search results for "testing"

| #  | Name          | Type    | Score | Vault    | Description                        |
|----|---------------|---------|-------|----------|------------------------------------|
| 1  | test-writer   | agent   | 40    | official | Generates unit tests for your code |
| 2  | tdd-workflow  | skill   | 30    | official | Test-driven development patterns   |
| 3  | code-review   | command | 10    | official | Deep code review (includes tests)  |

3 results found across 1 vault.
```

**If no results:**
```
No packages found matching "{keyword}" across {N} vault(s).
Try a broader keyword or browse all packages with /plug → Browse Packages.
```
Stop — no further panels.

#### Step 4 — Install from results panel

Present top results (up to 4) with multiSelect:

```json
AskUserQuestion:
  question: "Would you like to install any of these?"
  header: "Install"
  multiSelect: true
  options:
    - label: "test-writer"
      description: "agent · v1.0.0 — Generates unit tests for your code"
    - label: "tdd-workflow"
      description: "skill · v1.0.0 — Test-driven development patterns"
    - label: "code-review"
      description: "command · v1.0.0 — Deep code review (includes tests)"
```

#### Steps 5–6

Follow Browse Packages Steps 5–6 (install + confirmation).

---

### My Packages Flow

#### Step 1 — Fetch installed packages (no panel)

1. Read `.plugvault/installed.json` (local scope) — if missing, treat as `{ "installed": {} }`
2. Read `~/.plugvault/installed.json` (global scope) — if missing, treat as `{ "installed": {} }`
3. Merge both into a single list, adding `scope: "local"` or `scope: "global"` to each entry

#### Step 2 — Display installed packages (chat output)

```
## Installed Packages

| Package      | Type    | Version | Vault    | Scope  | Path                               |
|--------------|---------|---------|----------|--------|------------------------------------|
| code-review  | command | 1.0.0   | official | local  | .claude/commands/code-review.md    |
| api-patterns | skill   | 1.0.0   | official | local  | .claude/skills/api-patterns.md     |
| git-workflow | command | 1.0.0   | official | global | ~/.claude/commands/git-workflow.md |

3 packages installed (2 local, 1 global).
```

**If no packages installed:**
```
No packages installed yet. Use /plug → Browse Packages to get started.
```
Stop — no further panels.

#### Step 3 — Action panel

```json
AskUserQuestion:
  question: "What would you like to do with your packages?"
  header: "Action"
  multiSelect: false
  options:
    - label: "Check for Updates"
      description: "Compare installed versions against the latest in vaults"
    - label: "Remove a Package"
      description: "Uninstall one or more packages"
    - label: "Done"
      description: "Return to conversation"
```

If "Done" selected: stop — return to conversation. No further output needed.

#### Step 4a — Check for Updates: Fetch latest versions (no panel)

For each installed package:
1. Fetch registry.json from the recorded `vault` using the fetch pattern from Section 4
2. Compare `installed[pkg].version` vs `registry.packages[pkg].version` using the semver comparison helper in Section 7 (not plain string comparison — `"1.9.0"` < `"1.10.0"`)
3. Flag as "Update available" only when the registry version is `"newer"`

#### Step 5a — Update report (chat output)

```
## Update Check

| Package      | Installed | Latest | Status            |
|--------------|-----------|--------|-------------------|
| code-review  | 1.0.0     | 1.1.0  | Update available  |
| api-patterns | 1.0.0     | 1.0.0  | Up to date        |
| git-workflow | 1.0.0     | 1.0.0  | Up to date        |

1 update available.
```

**If no updates:**
```
All {N} packages are up to date.
```
Stop — no further panels.

#### Step 6a — Update selection panel (only if updates exist)

```json
AskUserQuestion:
  question: "Which packages do you want to update?"
  header: "Update"
  multiSelect: true
  options:
    - label: "code-review (1.0.0 → 1.1.0)"
      description: "command · official vault — Deep code review with security analysis"
    - label: "Update All"
      description: "Update all 1 package with available updates"
```

#### Step 7a — Re-download selected packages (procedural)

For each selected package (or all if "Update All" selected), read `~/.claude/skills/plug/references/install.md` and follow the install procedure with overwrite=true.

#### Step 8a — Update confirmation (chat output)

```
## Updated 1 package

| Package     | From  | To    |
|-------------|-------|-------|
| code-review | 1.0.0 | 1.1.0 |
```

#### Step 4b — Remove a Package: Package selection panel

```json
AskUserQuestion:
  question: "Which packages do you want to remove?"
  header: "Remove"
  multiSelect: true
  options:
    - label: "code-review"
      description: "command · local · .claude/commands/code-review.md"
    - label: "api-patterns"
      description: "skill · local · .claude/skills/api-patterns.md"
    - label: "git-workflow"
      description: "command · global · ~/.claude/commands/git-workflow.md"
```

#### Step 5b — Remove selected packages (no panel)

For each selected package:
1. Delete the .md file: `Bash: rm "{path}"`
2. Remove entry from the appropriate `installed.json` (local if scope=local, global if scope=global)
3. Write updated `installed.json`

#### Step 6b — Removal confirmation (chat output)

```
## Removed 1 package

| Package     | Was At                           |
|-------------|----------------------------------|
| code-review | .claude/commands/code-review.md  |

installed.json updated.
```

---

### Manage Vaults Flow

#### Step 1 — Read config (no panel)

1. Read `~/.plugvault/config.json`
2. If file doesn't exist, seed with default config (official vault only — see Section 5a)

#### Step 2 — Display vaults table (chat output)

```
## Registered Vaults

| Name     | Owner        | Repo        | Branch | Private | Default |
|----------|--------------|-------------|--------|---------|---------|
| official | dsiddharth2  | plugvault   | main   | No      | Yes     |
| mycorp   | mycorp-org   | tools-vault | main   | Yes     | No      |

2 vaults registered. Resolve order: official → mycorp
```

#### Step 3 — Vault action panel

```json
AskUserQuestion:
  question: "What would you like to do?"
  header: "Vaults"
  multiSelect: false
  options:
    - label: "Add a Vault"
      description: "Register a new GitHub-hosted vault"
    - label: "Remove a Vault"
      description: "Unregister an existing vault"
    - label: "Set Default"
      description: "Change which vault is searched first"
    - label: "Sync All"
      description: "Re-fetch package lists from all vaults"
```

#### Step 4a — Add a Vault: Visibility panel

```json
AskUserQuestion:
  question: "Is this a public or private vault?"
  header: "Visibility"
  multiSelect: false
  options:
    - label: "Public"
      description: "No authentication needed — anyone can fetch packages"
    - label: "Private"
      description: "Requires a GitHub personal access token (PAT) with repo read scope"
```

#### Step 5a — Ask for details (chat — free-text input needed)

Output in chat:
```
Please provide the vault details:

1. **Name** — a short alias (e.g., "mycorp", "team-tools")
2. **GitHub URL** — full repo URL (e.g., https://github.com/mycorp-org/tools-vault)
3. **Branch** — (default: main)
```

Parse the user's response: extract name, GitHub URL (split to owner/repo), and branch (default "main").

If vault was "Private", also ask in chat: "Please provide your GitHub personal access token (PAT):"

#### Step 6a — Test connectivity and save (procedural)

Read `~/.claude/skills/plug/references/vault-management.md` for the full add-vault procedure including connectivity testing and config update.

#### Step 7a — Confirmation (chat output)

```
## Vault added

| Field    | Value                          |
|----------|--------------------------------|
| Name     | mycorp                         |
| Repo     | mycorp-org/tools-vault         |
| Branch   | main                           |
| Private  | Yes                            |
| Packages | 12 packages found in registry  |

Resolve order updated: official → mycorp
```

**Error case — connectivity failure:**

```
Could not reach https://raw.githubusercontent.com/mycorp-org/tools-vault/main/registry.json

Possible causes:
- Repository doesn't exist or is misspelled
- Repository is private and no token is configured
- registry.json is missing from the repo root
```

Then show error panel:

```json
AskUserQuestion:
  question: "What would you like to do?"
  header: "Error"
  multiSelect: false
  options:
    - label: "Set Token & Retry"
      description: "Provide a GitHub PAT and try again"
    - label: "Add Anyway"
      description: "Register the vault without verifying (fix auth later)"
    - label: "Cancel"
      description: "Don't add this vault"
```

If "Set Token & Retry": ask for token in chat, retry the curl, then proceed or loop.
If "Add Anyway": add vault to config without connectivity check, report as unverified.
If "Cancel": stop.

#### Step 4b — Remove a Vault: Select vault to remove

```json
AskUserQuestion:
  question: "Which vault do you want to remove?"
  header: "Remove"
  multiSelect: false
  options:
    - label: "mycorp"
      description: "mycorp-org/tools-vault (private) — 12 packages"
    - label: "official (protected)"
      description: "dsiddharth2/plugvault (public) — removing this is not recommended"
```

**If user selects "official"** → show safety panel:

```json
AskUserQuestion:
  question: "The official vault is the default package source. Are you sure?"
  header: "Warning"
  multiSelect: false
  options:
    - label: "Yes, Remove It"
      description: "I understand — I'll re-add it later if needed"
    - label: "Cancel"
      description: "Keep the official vault"
```

If "Cancel": stop.

#### Step 5b — Remove vault (no panel)

1. Delete `config.vaults[vaultName]`
2. Remove from `config.resolve_order`
3. If it was `config.default_vault`, set `default_vault` to the next vault in resolve_order (or empty string if none remain)
4. Write updated `config.json`

#### Step 6b — Confirmation (chat output)

```
## Vault removed

Removed "mycorp" (mycorp-org/tools-vault).
Resolve order updated: official

Note: Packages already installed from "mycorp" remain on disk.
To remove them, use My Packages → Remove.
```

#### Step 4c — Set Default: Pick new default

Build options from current `config.vaults`:

```json
AskUserQuestion:
  question: "Which vault should be searched first?"
  header: "Default"
  multiSelect: false
  options:
    - label: "official (current default)"
      description: "dsiddharth2/plugvault — public, 8 packages"
    - label: "mycorp"
      description: "mycorp-org/tools-vault — private, 12 packages"
```

#### Step 5c — Update config (no panel)

1. Set `config.default_vault` to selected vault name
2. Move selected vault to front of `config.resolve_order`
3. Write updated `config.json`

#### Step 6c — Confirmation (chat output)

```
Default vault changed to "mycorp".
Resolve order updated: mycorp → official
```

#### Step 4d — Sync All: Fetch all registries (no panel)

For each vault in `config.resolve_order`, use the fetch pattern from Section 4 to fetch `registry.json`. Record: success (count packages) or failure (record HTTP status).

#### Step 5d — Sync report (chat output)

**All success:**
```
## Vault Sync Complete

| Vault    | Status | Packages |
|----------|--------|----------|
| official | OK     | 8        |
| mycorp   | OK     | 12       |

All 2 vaults synced successfully.
```

**Partial failure:**
```
## Vault Sync Complete

| Vault    | Status            | Packages |
|----------|-------------------|----------|
| official | OK                | 8        |
| mycorp   | Auth failed (401) | —        |

1 vault failed. Run /plug → Manage Vaults to set a token for "mycorp".
```

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
