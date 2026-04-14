# Plan: Redesign Plug as a Claude Code Skill

## Context

Plug is currently a Node.js CLI (`npm install -g plugvault`) that manages Claude Code extensions (skills, commands, agents) by fetching .md files from GitHub-hosted "vaults." The npm-package approach is awkward — users shouldn't need to install a Node package just to manage markdown files that Claude already knows how to read and write. The fix: make plug a **Claude Code skill** that works through the conversation interface, using Claude's native tools (Bash/curl, Read, Write) instead of Node.js.

The vault/registry system on GitHub stays unchanged. The config/tracking file formats stay unchanged. Only the execution engine changes: from Node.js CLI to Claude skill instructions.

## File Structure

```
~/.claude/skills/plug/
  SKILL.md                         # Core skill (frontmatter + routing + inline ops)
  references/
    install.md                     # Install + update procedures
    vault-management.md            # Vault add/remove/list/set-default/set-token/sync
    search-and-list.md             # Search + list (local & remote)
    config-schema.md               # JSON schemas for all config/tracking files

~/.claude/commands/plug.md           # /plug slash command — interactive panel entry point
```

## Phase 0: Create `/plug` Interactive Command (Entry Point)

**File:** `~/.claude/commands/plug.md`

This is the user-facing entry point. When the user types `/plug`, Claude presents an interactive panel using `AskUserQuestion` — similar to how `/marketplace` works.

**Frontmatter:**
```yaml
---
name: plug
description: "Package manager for Claude Code extensions. Browse, install, search, and manage skills/commands/agents from vaults."
argument-hint: "[command] [args...]"
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "AskUserQuestion"]
---
```

**Interactive Flow:**

---

### Main Menu

If user invokes `/plug` with no arguments, present the main menu:

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

---

### Option 1: Browse Packages (full flow)

**Step 1 — Behind the scenes (no panel):**
- Read `~/.plugvault/config.json` to get registered vaults
- For each vault: `curl -sf https://raw.githubusercontent.com/{owner}/{repo}/{branch}/registry.json`
- Parse all packages into a combined list

**Step 2 — Panel: Filter by type**
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

**Step 3 — Chat output: Package table**

Claude filters the combined list by selected type and prints a markdown table:

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

**Step 4 — Panel: Install prompt**

Claude picks the top 4 uninstalled packages and presents them:

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
```

> Note: `multiSelect: true` — user can pick multiple packages at once.
> If user selects "Other" they can type a package name not in the top 4.

**Step 5 — Behind the scenes: Install selected packages**

For each selected package:
1. Fetch `{pkg.path}/meta.json` from the vault
2. Fetch `{pkg.path}/{entry}` (the .md file content)
3. Determine destination dir by type: `skill` → `.claude/skills/`, `command` → `.claude/commands/`, `agent` → `.claude/agents/`
4. Write the .md file using `Write` tool
5. Update `.plugvault/installed.json` with install record

**Step 6 — Chat output: Confirmation**

```
## Installed 2 packages

| Package      | Type    | Installed To                      |
|--------------|---------|-----------------------------------|
| code-review  | command | .claude/commands/code-review.md   |
| api-patterns | skill   | .claude/skills/api-patterns.md    |

Use `/code-review` to run the code review command.
The api-patterns skill will auto-activate when relevant.
```

**Edge case — Package already installed:**

If a selected package exists in installed.json, show a conflict panel:

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

---

### Option 2: Search (full flow)

**Step 1 — Panel: Search input**

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
```

> The 4 options are popular categories as quick filters.
> User can select "Other" to type any free-text keyword.

**Step 2 — Behind the scenes:**
- Map selected category to search keywords (or use free-text directly)
- Fetch registry.json from all vaults
- Score each package:
  - Exact name match: 40 points
  - Partial name match: 30 points
  - Description contains keyword: 20 points
  - Tag match: 10 points
- Sort by score descending

**Step 3 — Chat output: Ranked results**

```
## Search results for "testing"

| #  | Name          | Type    | Score | Vault    | Description                        |
|----|---------------|---------|-------|----------|------------------------------------|
| 1  | test-writer   | agent   | 40    | official | Generates unit tests for your code |
| 2  | tdd-workflow  | skill   | 30    | official | Test-driven development patterns   |
| 3  | code-review   | command | 10    | official | Deep code review (includes tests)  |

3 results found across 1 vault.
```

**Step 4 — Panel: Install from results**

Same pattern as Browse Step 4 — present top results with `multiSelect: true`:

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

**Step 5–6:** Same install + confirmation as Browse Steps 5–6.

**Edge case — No results:**

```
No packages found matching "foobar" across 1 vault.
Try a broader keyword or browse all packages with `/plug`.
```

No panel shown — just the message.

---

### Option 3: My Packages (full flow)

**Step 1 — Behind the scenes:**
- Read `.plugvault/installed.json` (local scope — current project)
- Read `~/.plugvault/installed.json` (global scope)
- Merge both lists with scope labels

**Step 2 — Chat output: Installed packages table**

```
## Installed Packages

| Package      | Type    | Version | Vault    | Scope  | Path                             |
|--------------|---------|---------|----------|--------|----------------------------------|
| code-review  | command | 1.0.0   | official | local  | .claude/commands/code-review.md  |
| api-patterns | skill   | 1.0.0   | official | local  | .claude/skills/api-patterns.md   |
| git-workflow  | command | 1.0.0   | official | global | ~/.claude/commands/git-workflow.md |

3 packages installed (2 local, 1 global).
```

**If no packages installed:**
```
No packages installed yet. Use `/plug` → Browse Packages to get started.
```
(No further panels — returns to conversation.)

**Step 3 — Panel: Action selection**

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

---

#### My Packages → Check for Updates

**Step 4a — Behind the scenes:**
- For each installed package, fetch its vault's registry.json
- Compare installed version vs registry version (semver string comparison)

**Step 5a — Chat output: Update report**

```
## Update Check

| Package      | Installed | Latest | Status      |
|--------------|-----------|--------|-------------|
| code-review  | 1.0.0     | 1.1.0  | Update available |
| api-patterns | 1.0.0     | 1.0.0  | Up to date  |
| git-workflow  | 1.0.0     | 1.0.0  | Up to date  |

1 update available.
```

**If updates exist → Panel: Select which to update**

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

**Step 6a — Behind the scenes:** Re-download selected packages (same as install Steps 5–6).

**Step 7a — Chat output: Update confirmation**

```
## Updated 1 package

| Package     | From  | To    |
|-------------|-------|-------|
| code-review | 1.0.0 | 1.1.0 |
```

**If no updates available:**
```
All 3 packages are up to date.
```
(No further panels.)

---

#### My Packages → Remove a Package

**Step 4b — Panel: Select packages to remove**

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

**Step 5b — Behind the scenes:**
For each selected package:
1. Delete the .md file: `Bash: rm "{path}"`
2. Remove entry from the appropriate installed.json (local or global)
3. Write updated installed.json

**Step 6b — Chat output: Removal confirmation**

```
## Removed 1 package

| Package     | Was At                            |
|-------------|-----------------------------------|
| code-review | .claude/commands/code-review.md   |

installed.json updated.
```

---

### Option 4: Manage Vaults (full flow)

**Step 1 — Behind the scenes:**
- Read `~/.plugvault/config.json`
- If file doesn't exist, seed with default config (official vault only)

**Step 2 — Chat output: Current vaults table**

```
## Registered Vaults

| Name     | Owner        | Repo       | Branch | Private | Default |
|----------|-------------|------------|--------|---------|---------|
| official | dsiddharth2 | plugvault  | main   | No      | Yes     |
| mycorp   | mycorp-org  | tools-vault| main   | Yes     | No      |

2 vaults registered. Resolve order: official → mycorp
```

**Step 3 — Panel: Vault action**

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

---

#### Manage Vaults → Add a Vault

**Step 4a — Panel: Vault visibility**

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

**Step 5a — Chat output: Prompt for details**

Claude asks in chat (not a panel — these need free-text input):

```
Please provide the vault details:

1. **Name** — a short alias (e.g., "mycorp", "team-tools")
2. **GitHub URL** — full repo URL (e.g., https://github.com/mycorp-org/tools-vault)
3. **Branch** — (default: main)
```

> User types something like: `mycorp https://github.com/mycorp-org/tools-vault`

**Step 6a — Behind the scenes:**
1. Parse the user's input: extract name, owner, repo, branch
2. Test connectivity: `curl -sf https://raw.githubusercontent.com/{owner}/{repo}/{branch}/registry.json`
3. If private and no token: prompt user for token (see Set Token flow below)
4. If curl succeeds: add vault to config.json, append to resolve_order
5. Write updated config.json

**Step 7a — Chat output: Confirmation**

```
## Vault added

| Field   | Value                                        |
|---------|----------------------------------------------|
| Name    | mycorp                                       |
| Repo    | mycorp-org/tools-vault                       |
| Branch  | main                                         |
| Private | Yes                                          |
| Packages| 12 packages found in registry                |

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

Panel to retry or abort:

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

---

#### Manage Vaults → Remove a Vault

**Step 4b — Panel: Select vault to remove**

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

**If user selects "official" → Safety panel:**

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

**Step 5b — Behind the scenes:**
1. Remove vault from `config.vaults`
2. Remove from `config.resolve_order`
3. If it was `default_vault`, set the next vault in resolve_order as default
4. Write updated config.json

**Step 6b — Chat output:**

```
## Vault removed

Removed "mycorp" (mycorp-org/tools-vault).
Resolve order updated: official

Note: Packages already installed from "mycorp" remain on disk.
To remove them, use My Packages → Remove.
```

---

#### Manage Vaults → Set Default

**Step 4c — Panel: Pick new default**

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

**Step 5c — Behind the scenes:**
1. Set `config.default_vault` to selected name
2. Move selected vault to front of `config.resolve_order`
3. Write updated config.json

**Step 6c — Chat output:**

```
Default vault changed to "mycorp".
Resolve order updated: mycorp → official
```

---

#### Manage Vaults → Sync All

**Step 4d — Behind the scenes (no panel):**
For each vault in resolve_order:
1. `curl -sf` registry.json
2. Count packages
3. Report status

**Step 5d — Chat output:**

```
## Vault Sync Complete

| Vault    | Status | Packages |
|----------|--------|----------|
| official | OK     | 8        |
| mycorp   | OK     | 12       |

All 2 vaults synced successfully.
```

**If a vault fails:**

```
| Vault    | Status           | Packages |
|----------|------------------|----------|
| official | OK               | 8        |
| mycorp   | Auth failed (401)| —        |

1 vault failed. Run `/plug` → Manage Vaults → set a token for "mycorp".
```

### Shortcut: `/plug <command> [args]`
If user provides arguments (e.g., `/plug install code-review`), skip the menu and go directly to that operation. The command file detects arguments and routes to the skill's procedures.

**Routing logic in command body:**
```
If $ARGUMENTS is empty → show main menu (Step 1 above)
If $ARGUMENTS starts with "install" → read references/install.md, execute
If $ARGUMENTS starts with "remove" → execute inline remove
If $ARGUMENTS starts with "search" → read references/search-and-list.md, execute search
If $ARGUMENTS starts with "list" → read references/search-and-list.md, execute list
If $ARGUMENTS starts with "update" → read references/install.md, execute update
If $ARGUMENTS starts with "vault" → read references/vault-management.md, execute
If $ARGUMENTS starts with "init" → execute inline init
```

## Phase 1: Create Core Skill File

**File:** `~/.claude/skills/plug/SKILL.md`

**Frontmatter:**
- name: `plug`
- description: triggers on "plug install", "plug remove", "plug search", "plug list", "plug update", "plug vault", "plug init", "install X from vault"
- argument-hint: `<command> [args...]`
- allowed-tools: Read, Write, Edit, Bash, Glob, Grep

**Body (~1500 words) contains:**

1. **Constants** — official vault (dsiddharth2/plugvault, branch main), GitHub raw base URL, config path (`~/.plugvault/config.json`), installed path (local: `.plugvault/installed.json`, global: `~/.plugvault/installed.json`), target directories (`.claude/skills/`, `.claude/commands/`, `.claude/agents/`)

2. **Command routing table** — maps user intent to operation + reference file:
   - `init` → inline
   - `install X` → references/install.md
   - `remove X` → inline
   - `list` / `list --remote` → references/search-and-list.md
   - `search X` → references/search-and-list.md
   - `update X` / `update --all` → references/install.md
   - `vault add/remove/list/...` → references/vault-management.md

3. **Auth resolution** (inline, needed by all fetches):
   - Check env `PLUGVAULT_TOKEN_{VAULT_UPPER}` → `PLUGVAULT_GITHUB_TOKEN` → config.json `vault.token`
   - Never echo tokens to conversation

4. **Fetch pattern** (inline, reusable):
   - Read config.json for vault details (owner, repo, branch)
   - Resolve auth token
   - `Bash: curl -sf [-H "Authorization: Bearer $TOKEN"] "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"`
   - Handle errors: non-zero exit = failed (404/401/403)

5. **Inline operations:**
   - **init**: `mkdir -p` for .claude/skills, .claude/commands, .claude/agents, .plugvault; Write empty installed.json if missing
   - **remove**: Read installed.json → find package → `rm` the file → remove entry → Write updated installed.json

6. **Scope handling**: default = local (CWD). If user says `-g`/`--global`/`globally` → use `~/` paths

## Phase 2: Create Reference Files

### references/config-schema.md
JSON schemas for all data files (needed by every other reference):
- `config.json` — vaults map, resolve_order, default_vault
- `installed.json` — installed packages map with type/vault/version/path/installedAt
- `registry.json` — vault package index with type/version/path/description/tags
- `meta.json` — per-package metadata with name/type/version/description/author/tags/entry
- Default config (official vault pre-registered)

### references/install.md
Install + update procedures:
1. Parse package name (vault/name or just name)
2. Auto-init if .claude/ dirs missing
3. Fetch registry.json from vault
4. Look up package; if multiple vaults match, ask user
5. Check installed.json for conflicts; ask user to confirm overwrite
6. Fetch meta.json + entry .md file
7. Route by type: skill→.claude/skills/, command→.claude/commands/, agent→.claude/agents/
8. Write the .md file, update installed.json
9. **Update**: read installed.json, compare versions, re-download if newer

### references/search-and-list.md
- **list local**: Read installed.json (both scopes), format as table
- **list remote**: Fetch registry.json from each vault, format as table
- **search**: Fetch registries, score by name match (40), partial name (30), description (20), tag (10), sort descending

### references/vault-management.md
- **vault list**: Read config.json, format table
- **vault add**: Parse GitHub URL → extract owner/repo → test curl connectivity → add to config
- **vault remove**: Delete from config (protect "official" unless forced)
- **vault set-default**: Reorder resolve_order
- **vault set-token**: Write token to config, test connectivity, warn about plaintext
- **vault sync**: Re-fetch all registries

## Phase 3: Add Bootstrap Script to Plug Repo

**File:** `C:\2_WorkSpace\Plug\plug-doer\plug\skill/` directory containing copies of all skill files + an `install.sh` bootstrap script that curls them into `~/.claude/skills/plug/`.

## Phase 4: Update Documentation

- Update plug README to recommend skill installation as primary method
- CLI becomes "legacy/advanced" for CI/scripting use cases
- Add skill installation one-liner to Quick Start

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fetch method | `Bash(curl)` | WebFetch can't send auth headers or return raw content |
| Caching | Dropped | CLI cached because it ran frequently; skill runs in conversations where extra fetch time is negligible |
| Config format | Unchanged | Backward compatible with existing CLI installations |
| CLI fate | Maintained in parallel | Still useful for CI/CD and non-Claude environments |
| Scope | Same local/global model | `-g` or "globally" switches to `~/` paths |

## Verification

1. Start a new Claude Code session
2. Type `/plug` — verify interactive main menu appears with 4 options (Browse, Search, My Packages, Manage Vaults)
3. Select "Browse Packages" → verify type selection appears → select "All" → verify package table
4. Select "Search" → type a keyword → verify ranked results
5. Type `/plug install code-review` — verify shortcut skips menu, installs directly
6. Type `/plug` → "My Packages" → verify installed package shown
7. Type `/plug` → "My Packages" → "Check for Updates" → verify version comparison
8. Type `/plug` → "Manage Vaults" → verify vault list and management options
9. Type "plug remove code-review" (natural language, no slash) — verify skill auto-triggers
10. Test with a private vault (if available) to verify auth flow

## Commit Strategy

1 commit per phase (5 total). Each commit tagged with relevant context.

## Architecture: Command vs Skill (Two Entry Points)

| Entry Point | Trigger | Experience |
|-------------|---------|------------|
| `/plug` command | User types `/plug` or `/plug install X` | Interactive panel with menus, guided flow |
| `plug` skill | Natural language: "install code-review from vault" | Conversational, Claude auto-detects intent |

Both share the same references/ files and config/tracking format. The command is the "GUI", the skill is the "API".
