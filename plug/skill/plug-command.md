---
name: plug
description: "Package manager for Claude Code extensions. Browse, install, search, and manage skills/commands/agents from vaults."
argument-hint: "[command] [args...]"
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "AskUserQuestion"]
---

# /plug — Interactive Package Manager

When the user types `/plug` or `/plug <command> [args...]`, follow the routing logic below.

---

## Shortcut Routing (when $ARGUMENTS is not empty)

Check `$ARGUMENTS` and route directly — skip the main menu:

| $ARGUMENTS starts with | Action                                                    |
|------------------------|-----------------------------------------------------------|
| `install`              | Read `~/.claude/skills/plug/references/install.md`, execute install procedure |
| `remove` / `uninstall` | Execute inline remove (see SKILL.md Section 5b)           |
| `search`               | Read `~/.claude/skills/plug/references/search-and-list.md`, execute search |
| `list`                 | Read `~/.claude/skills/plug/references/search-and-list.md`, execute list  |
| `update`               | Read `~/.claude/skills/plug/references/install.md`, execute update procedure |
| `vault`                | Read `~/.claude/skills/plug/references/vault-management.md`, execute vault subcommand |
| `init`                 | Execute inline init (see SKILL.md Section 5a)             |

If `$ARGUMENTS` is empty, show the **Main Menu** below.

---

## Main Menu

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

Route to the matching branch below based on selection.

---

## Branch 1: Browse Packages

### Step 1 — Fetch all packages (no panel)

1. Read `~/.plugvault/config.json` — get registered vaults and resolve_order
2. For each vault in resolve_order:
   - Resolve auth token (see SKILL.md Section 3)
   - `curl -sf [-H "Authorization: Bearer $TOKEN"] "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/registry.json"`
   - Parse packages into combined list, tagging each with vault name
3. Deduplicate: if same package name exists in multiple vaults, keep the one from the highest-priority vault

### Step 2 — Filter by type panel

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

### Step 3 — Display package table (chat output)

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

### Step 4 — Install prompt panel

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

### Step 5 — Install selected packages (no panel)

For each selected package, follow the full install procedure from `~/.claude/skills/plug/references/install.md`.

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

### Step 6 — Installation confirmation (chat output)

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

## Branch 2: Search

### Step 1 — Category panel

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

### Step 2 — Fetch and score (no panel)

1. Fetch registry.json from all vaults (same as Browse Step 1)
2. For each package, compute relevance score against keyword(s):
   - Exact name match: **40 points**
   - Partial name match (keyword is substring of name): **30 points**
   - Description contains keyword: **20 points**
   - Tag match: **10 points**
3. Sum scores, filter to score > 0, sort descending

### Step 3 — Ranked results table (chat output)

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

### Step 4 — Install from results panel

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

### Steps 5–6

Follow Browse Packages Steps 5–6 (install + confirmation).

---

## Branch 3: My Packages

### Step 1 — Fetch installed packages (no panel)

1. Read `.plugvault/installed.json` (local scope) — if missing, treat as `{ "installed": {} }`
2. Read `~/.plugvault/installed.json` (global scope) — if missing, treat as `{ "installed": {} }`
3. Merge both into a single list, adding `scope: "local"` or `scope: "global"` to each entry

### Step 2 — Display installed packages (chat output)

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

### Step 3 — Action panel

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

---

### My Packages → Check for Updates

### Step 4a — Fetch latest versions (no panel)

For each installed package:
1. Fetch registry.json from the recorded `vault`
2. Compare `installed[pkg].version` vs `registry.packages[pkg].version` using the semver comparison helper in SKILL.md Section 7 (not plain string comparison — `"1.9.0"` < `"1.10.0"`)
3. Flag as "Update available" only when the registry version is `"newer"`

### Step 5a — Update report (chat output)

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

### Step 6a — Update selection panel (only if updates exist)

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

### Step 7a — Re-download selected packages (no panel)

For each selected package (or all if "Update All" selected), follow the install procedure from `~/.claude/skills/plug/references/install.md` with overwrite=true.

### Step 8a — Update confirmation (chat output)

```
## Updated 1 package

| Package     | From  | To    |
|-------------|-------|-------|
| code-review | 1.0.0 | 1.1.0 |
```

---

### My Packages → Remove a Package

### Step 4b — Package selection panel

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

### Step 5b — Remove selected packages (no panel)

For each selected package:
1. Delete the .md file: `Bash: rm "{path}"`
2. Remove entry from the appropriate `installed.json` (local if scope=local, global if scope=global)
3. Write updated `installed.json`

### Step 6b — Removal confirmation (chat output)

```
## Removed 1 package

| Package     | Was At                           |
|-------------|----------------------------------|
| code-review | .claude/commands/code-review.md  |

installed.json updated.
```

---

## Branch 4: Manage Vaults

### Step 1 — Read config (no panel)

1. Read `~/.plugvault/config.json`
2. If file doesn't exist, seed with default config (official vault only — see SKILL.md Section 5a)

### Step 2 — Display vaults table (chat output)

```
## Registered Vaults

| Name     | Owner        | Repo        | Branch | Private | Default |
|----------|--------------|-------------|--------|---------|---------|
| official | dsiddharth2  | plugvault   | main   | No      | Yes     |
| mycorp   | mycorp-org   | tools-vault | main   | Yes     | No      |

2 vaults registered. Resolve order: official → mycorp
```

### Step 3 — Vault action panel

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

### Manage Vaults → Add a Vault

### Step 4a — Visibility panel

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

### Step 5a — Ask for details (chat — free-text input needed)

Output in chat:
```
Please provide the vault details:

1. **Name** — a short alias (e.g., "mycorp", "team-tools")
2. **GitHub URL** — full repo URL (e.g., https://github.com/mycorp-org/tools-vault)
3. **Branch** — (default: main)
```

Parse the user's response: extract name, GitHub URL (split to owner/repo), and branch (default "main").

If vault was "Private", also ask in chat: "Please provide your GitHub personal access token (PAT):"

### Step 6a — Test connectivity and save (no panel)

1. Build raw URL: `https://raw.githubusercontent.com/{owner}/{repo}/{branch}/registry.json`
2. Test: `curl -sf [-H "Authorization: Bearer $TOKEN"] "{url}"`
3. If success:
   - Parse registry to count packages
   - Add vault to `config.vaults`, append to `config.resolve_order`
   - Write updated `config.json`
4. If failure → show error + error panel (see below)

### Step 7a — Confirmation (chat output)

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

---

### Manage Vaults → Remove a Vault

### Step 4b — Select vault to remove

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

### Step 5b — Remove vault (no panel)

1. Delete `config.vaults[vaultName]`
2. Remove from `config.resolve_order`
3. If it was `config.default_vault`, set `default_vault` to the next vault in resolve_order (or empty string if none remain)
4. Write updated `config.json`

### Step 6b — Confirmation (chat output)

```
## Vault removed

Removed "mycorp" (mycorp-org/tools-vault).
Resolve order updated: official

Note: Packages already installed from "mycorp" remain on disk.
To remove them, use My Packages → Remove.
```

---

### Manage Vaults → Set Default

### Step 4c — Pick new default

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

### Step 5c — Update config (no panel)

1. Set `config.default_vault` to selected vault name
2. Move selected vault to front of `config.resolve_order`
3. Write updated `config.json`

### Step 6c — Confirmation (chat output)

```
Default vault changed to "mycorp".
Resolve order updated: mycorp → official
```

---

### Manage Vaults → Sync All

### Step 4d — Fetch all registries (no panel)

For each vault in `config.resolve_order`:
1. `curl -sf [-H "Authorization: Bearer $TOKEN"] "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/registry.json"`
2. Record: success (count packages) or failure (record HTTP status)

### Step 5d — Sync report (chat output)

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
