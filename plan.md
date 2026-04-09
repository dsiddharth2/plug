# PlugVault — Project Plan

## Overview

PlugVault is an open-source CLI tool that lets developers install reusable Claude skills and commands into any project from hosted registries (vaults).

| Item | Name |
|---|---|
| npm package | `plugvault` |
| CLI command | `plug` |
| Main repo (CLI source) | `plug` |
| Skills registry repo | `plugvault` |
| License | MIT |
| Language | Node.js |

```bash
npm install -g plugvault
plug install -i code-review
```

---

## Architecture

```
                         ┌─────────────────────────────┐
                         │  Vaults (GitHub Repos)       │
                         │                              │
                         │  plugvault (official)        │
                         │  myorg/company-vault         │
                         │  me/personal-vault           │
                         └──────────┬──────────────────┘
                                    │
                              fetch & download
                                    │
                                    ▼
                         ┌─────────────────────────────┐
                         │  plug CLI                    │
                         │                              │
                         │  plug install -i <name>      │
                         │  plug vault add <name> <url> │
                         │  plug list / search / remove │
                         └──────────┬──────────────────┘
                                    │
                           routes by type
                                    │
                     ┌──────────────┼──────────────┐
                     ▼                             ▼
              .claude/skills/               .claude/commands/
              (always active)               (invoked with /)
```

---

## Repositories

### Repo 1: `plug` (the CLI tool)

```
plug/
├── package.json
├── bin/
│   └── plug.js
├── src/
│   ├── index.js
│   ├── commands/
│   │   ├── init.js
│   │   ├── install.js
│   │   ├── remove.js
│   │   ├── list.js
│   │   ├── search.js
│   │   ├── update.js
│   │   └── vault.js
│   ├── utils/
│   │   ├── config.js
│   │   ├── registry.js
│   │   ├── fetcher.js
│   │   ├── tracker.js
│   │   ├── auth.js
│   │   └── paths.js
│   └── constants.js
├── tests/
├── .gitignore
├── LICENSE
└── README.md
```

**package.json**

```json
{
  "name": "plugvault",
  "version": "1.0.0",
  "description": "Install Claude skills and commands from vaults",
  "bin": {
    "plug": "./bin/plug.js"
  },
  "dependencies": {
    "commander": "^12.x",
    "chalk": "^5.x",
    "ora": "^7.x",
    "node-fetch": "^3.x"
  }
}
```

### Repo 2: `plugvault` (official skills registry)

```
plugvault/
├── registry.json
└── registry/
    ├── code-review/
    │   ├── meta.json
    │   └── code-review.md
    ├── api-patterns/
    │   ├── meta.json
    │   └── api-patterns.md
    ├── testing-standards/
    │   ├── meta.json
    │   └── testing-standards.md
    ├── git-conventions/
    │   ├── meta.json
    │   └── git-conventions.md
    └── react-patterns/
        ├── meta.json
        └── react-patterns.md
```

---

## File Formats

### registry.json

```json
{
  "name": "plugvault-official",
  "version": "1.0.0",
  "packages": {
    "code-review": {
      "type": "command",
      "version": "1.0.0",
      "path": "registry/code-review",
      "description": "Deep code review with security & performance analysis"
    },
    "api-patterns": {
      "type": "skill",
      "version": "1.0.0",
      "path": "registry/api-patterns",
      "description": "Enforces consistent API design patterns"
    }
  }
}
```

### meta.json (per skill/command)

```json
{
  "name": "code-review",
  "type": "command",
  "version": "1.0.0",
  "description": "Deep code review with security & performance analysis",
  "author": "yourname",
  "tags": ["review", "quality", "security"],
  "entry": "code-review.md"
}
```

### Global config (~/.plugvault/config.json)

```json
{
  "vaults": {
    "official": {
      "url": "https://github.com/plugvault/plugvault",
      "default": true,
      "private": false
    },
    "company": {
      "url": "https://github.com/myorg/company-vault",
      "private": true,
      "auth": {
        "type": "token",
        "token": "ghp_xxxxxxxxxxxx"
      }
    }
  },
  "resolve_order": ["official", "company"]
}
```

### Local tracking (.plugvault/installed.json)

```json
{
  "installed": {
    "code-review": {
      "vault": "official",
      "version": "1.0.0",
      "type": "command",
      "installed_at": "2026-04-07T10:30:00Z",
      "path": ".claude/commands/code-review.md"
    },
    "api-patterns": {
      "vault": "official",
      "version": "1.0.0",
      "type": "skill",
      "installed_at": "2026-04-07T10:31:00Z",
      "path": ".claude/skills/api-patterns.md"
    }
  }
}
```

---

## All CLI Commands

### Skills & Commands

| Command | Description |
|---|---|
| `plug init` | Creates `.claude/skills/`, `.claude/commands/`, `.plugvault/` in current project |
| `plug install -i <name>` | Install skill/command from default vault (resolve order) |
| `plug install -i <vault>/<name>` | Install from specific vault |
| `plug install -i <name> -g` | Install globally to `~/.claude/` |
| `plug remove <name>` | Remove installed skill/command |
| `plug remove <name> -g` | Remove globally installed skill/command |
| `plug list` | List installed skills & commands (local + global) |
| `plug list --remote` | List all available across all vaults |
| `plug list --vault <name>` | List available in specific vault |
| `plug list --type skill` | Filter by type (skill or command) |
| `plug search <keyword>` | Search across all vaults by name/description/tags |
| `plug search <keyword> --vault <name>` | Search in specific vault |
| `plug update <name>` | Update single skill/command to latest |
| `plug update --all` | Update all installed |

### Vault Management

| Command | Description |
|---|---|
| `plug vault add <name> <url>` | Register a public vault |
| `plug vault add <name> <url> --token <t>` | Register a private vault with token |
| `plug vault add <name> <url> --private` | Register a private vault (uses system git) |
| `plug vault remove <name>` | Unregister a vault |
| `plug vault list` | List all registered vaults |
| `plug vault set-default <name>` | Set default vault |
| `plug vault set-token <name> <token>` | Set/update auth token for a vault |
| `plug vault sync` | Refresh registries from all vaults |

---

## Core Flows

### Install Flow

```
plug install -i code-review

  1. Read ~/.plugvault/config.json → get vaults & resolve_order
  2. No vault prefix → search through resolve_order
  3. Fetch registry.json from vault (cache if possible)
  4. Find "code-review" in registry
     → not found in any vault? ❌ error & exit
  5. Read type from registry entry
  6. Download .md file via GitHub raw URL
     URL: https://raw.githubusercontent.com/{owner}/{repo}/main/{path}/{entry}
  7. Route by type:
     type === "skill"    → copy to .claude/skills/code-review.md
     type === "command"  → copy to .claude/commands/code-review.md
  8. If -g flag:
     → use ~/.claude/skills/ or ~/.claude/commands/ instead
  9. Track in .plugvault/installed.json
  10. Print:
      ✅ Command 'code-review' installed → .claude/commands/code-review.md
      Use it: /code-review
```

### Install from Specific Vault

```
plug install -i company/deploy-checklist

  1. Parse "company/deploy-checklist"
  2. Look up "company" vault in config
  3. Fetch registry.json from company vault only
  4. Find "deploy-checklist" → download & install
```

### Vault Resolution (no vault specified)

```
plug install -i api-patterns

  resolve_order: ["official", "company", "personal"]

  Search "official" → not found
  Search "company"  → found! → install from company vault
```

### Conflict Handling

```
plug install -i api-patterns

  Found in multiple vaults:
  ⚠️  'api-patterns' found in multiple vaults:
    1. official/api-patterns  (v1.2.0) — "REST API design patterns"
    2. company/api-patterns   (v2.0.0) — "Internal API standards"
  ? Which one? (use --vault to skip this)
  › 1. official
    2. company
```

### Private Vault Auth Resolution

```
Accessing private vault "company":

  1. Check env: PLUGVAULT_TOKEN_COMPANY → use if set
  2. Check env: PLUGVAULT_GITHUB_TOKEN → use if set
  3. Check config: vault.auth.token → use if set
  4. Fallback: git clone --depth 1 (uses system git credentials)
  5. None work → ❌ error with instructions
```

---

## Implementation Phases

### Phase 1 — Scaffolding (Day 1-2)

**CLI Repo:**
- [ ] Init npm project with package.json
- [ ] Set up `bin/plug.js` with `#!/usr/bin/env node`
- [ ] Install dependencies: commander, chalk, ora, node-fetch
- [ ] Set up Commander with `plug --version` and `plug --help`
- [ ] Create folder structure: src/commands/, src/utils/
- [ ] Test with `npm link` — `plug --help` works

**Registry Repo:**
- [ ] Create `plugvault` repo
- [ ] Add 1 sample skill: `api-patterns`
- [ ] Add 1 sample command: `code-review`
- [ ] Write `registry.json` with both entries
- [ ] Push to GitHub
- [ ] Verify raw URL access works

**Done when:** `plug --help` shows output AND registry.json is fetchable from GitHub.

---

### Phase 2 — Core Utilities (Day 3-5)

- [ ] `src/constants.js` — all paths and defaults
- [ ] `src/utils/paths.js`
  - [ ] `getGlobalDir()` → ~/.plugvault/
  - [ ] `getClaudeSkillsDir(global?)` → .claude/skills/ or ~/.claude/skills/
  - [ ] `getClaudeCommandsDir(global?)` → .claude/commands/ or ~/.claude/commands/
  - [ ] `getInstalledFilePath(global?)` → .plugvault/installed.json
  - [ ] `ensureDir(path)` — create dir if not exists
- [ ] `src/utils/config.js`
  - [ ] `getConfig()` — read config, return defaults if missing
  - [ ] `saveConfig(config)` — write config
  - [ ] `getVault(name)` — get single vault
  - [ ] `getDefaultVault()` — get default vault
  - [ ] `getResolveOrder()` — get resolution order
  - [ ] Auto-seed official vault on first run
- [ ] `src/utils/auth.js`
  - [ ] `getAuthForVault(vaultName)` — resolve token from env/config
  - [ ] `getAuthHeaders(vaultName)` — return headers object
- [ ] `src/utils/registry.js`
  - [ ] `fetchRegistry(vault)` — fetch registry.json from GitHub
  - [ ] `getCachedRegistry(vaultName)` — read from cache
  - [ ] `cacheRegistry(vaultName, data)` — save to cache
  - [ ] `findPackage(name, vaultName?)` — search across vaults
- [ ] `src/utils/fetcher.js`
  - [ ] `downloadFile(vault, filePath)` — fetch file via raw GitHub URL
  - [ ] Add auth header support for private repos
  - [ ] Git clone fallback for private repos without token
- [ ] `src/utils/tracker.js`
  - [ ] `getInstalled(global?)` — read installed.json
  - [ ] `trackInstall(name, metadata)` — add entry
  - [ ] `trackRemove(name)` — remove entry
  - [ ] `isInstalled(name)` — check exists

**Done when:** Can programmatically fetch registry.json, find a package, and download its .md file.

---

### Phase 3 — Core Commands (Day 6-9)

- [ ] `plug init`
  - [ ] Create .claude/skills/
  - [ ] Create .claude/commands/
  - [ ] Create .plugvault/installed.json
  - [ ] Skip if already exists
  - [ ] Print confirmation
- [ ] `plug install -i <name>`
  - [ ] Parse name (check for vault/ prefix)
  - [ ] If vault specified → search that vault only
  - [ ] If no vault → search through resolve_order
  - [ ] Handle conflict (same name in multiple vaults) → prompt user
  - [ ] Fetch meta.json → read type
  - [ ] Download .md file
  - [ ] Route: skill → .claude/skills/, command → .claude/commands/
  - [ ] Support -g flag for global install
  - [ ] Check if already installed → prompt overwrite
  - [ ] Auto-run init if .claude/ doesn't exist
  - [ ] Track in installed.json
  - [ ] Print result with path and usage hint
- [ ] `plug remove <name>`
  - [ ] Check installed.json
  - [ ] Delete file from .claude/skills/ or .claude/commands/
  - [ ] Remove from installed.json
  - [ ] Support -g flag
  - [ ] Print confirmation
- [ ] `plug list`
  - [ ] Read local + global installed.json
  - [ ] Format as table: name, type, vault, version, path
  - [ ] Support --remote flag (fetch all registries)
  - [ ] Support --vault filter
  - [ ] Support --type filter

**Done when:** Full cycle works: init → install → list → remove.

---

### Phase 4 — Vault Management (Day 10-12)

- [ ] `plug vault add <name> <url>`
  - [ ] Validate URL format
  - [ ] Support --token flag for private repos
  - [ ] Support --private flag (system git fallback)
  - [ ] Test connectivity (try fetching registry.json)
  - [ ] Save to config
  - [ ] Add to resolve_order
  - [ ] Print confirmation
- [ ] `plug vault remove <name>`
  - [ ] Remove from config
  - [ ] Remove from resolve_order
  - [ ] Clear cached registry
  - [ ] Prevent removing "official" unless forced
  - [ ] Print confirmation
- [ ] `plug vault list`
  - [ ] Print table: name, URL, public/private, default, skill count
- [ ] `plug vault set-default <name>`
  - [ ] Update default flag
  - [ ] Move to top of resolve_order
- [ ] `plug vault set-token <name> <token>`
  - [ ] Update token in config
  - [ ] Test connectivity with new token
  - [ ] Print confirmation
- [ ] `plug vault sync`
  - [ ] Re-fetch registry.json from all vaults
  - [ ] Update cache
  - [ ] Print summary: "Synced X vaults, Y packages available"

**Done when:** Can add a private vault, authenticate, and install from it.

---

### Phase 5 — Search & Update (Day 13-14)

- [ ] `plug search <keyword>`
  - [ ] Fetch registries from all vaults (use cache)
  - [ ] Match against: name, description, tags
  - [ ] Support --vault filter
  - [ ] Support --type filter
  - [ ] Print results with vault source
- [ ] `plug update <name>`
  - [ ] Read installed version from installed.json
  - [ ] Fetch latest version from registry
  - [ ] Compare versions
  - [ ] If newer → re-download and overwrite
  - [ ] Update installed.json
  - [ ] Print: "Updated code-review: v1.0.0 → v1.2.0"
- [ ] `plug update --all`
  - [ ] Loop through all installed
  - [ ] Check each for updates
  - [ ] Print summary

**Done when:** Can search across vaults and update outdated skills.

---

### Phase 6 — Polish & Error Handling (Day 15-16)

- [ ] Add ora spinners for all network operations
- [ ] Add chalk colors: green success, red errors, yellow warnings
- [ ] Error handling:
  - [ ] No internet connection
  - [ ] Repo not found / 404
  - [ ] Skill not found in registry
  - [ ] Auth failed for private vault
  - [ ] File permission issues
  - [ ] Corrupt config.json (auto-repair)
  - [ ] Corrupt installed.json (auto-repair)
- [ ] Edge cases:
  - [ ] Install when .claude/ doesn't exist (auto-init)
  - [ ] Install same skill twice (prompt overwrite)
  - [ ] Remove skill that doesn't exist
  - [ ] Vault add with duplicate name
- [ ] Add --verbose flag for debug output
- [ ] Add --json flag for script-friendly output
- [ ] Add --yes flag to skip prompts

**Done when:** CLI handles all error cases gracefully.

---

### Phase 7 — Documentation (Day 17-18)

- [ ] README.md
  - [ ] Project description and badges
  - [ ] Quick start (install + first skill)
  - [ ] All commands with examples
  - [ ] Vault management guide
  - [ ] Private repos setup
  - [ ] GIF/video demo
- [ ] CONTRIBUTING.md
  - [ ] How to contribute to the CLI
  - [ ] How to create and submit skills/commands
  - [ ] meta.json format reference
  - [ ] Skill writing best practices
- [ ] Skill authoring guide
  - [ ] What makes a good skill vs command
  - [ ] meta.json schema
  - [ ] Template for skills
  - [ ] Template for commands
- [ ] Add to plugvault registry repo:
  - [ ] README with list of all available skills/commands
  - [ ] Contributing guide for adding new skills
  - [ ] Skill/command templates

**Done when:** A new user can read the README and get started in 2 minutes.

---

### Phase 8 — Publish (Day 19)

- [ ] Verify `plugvault` is available on npm
- [ ] Set up npm account / org if needed
- [ ] `npm publish`
- [ ] Test clean install: `npm install -g plugvault`
- [ ] Test full flow: install → list → remove → vault add
- [ ] Create GitHub release with changelog
- [ ] Add GitHub topics/description to both repos
- [ ] Announce

**Done when:** Anyone can `npm install -g plugvault` and start using it.

---

## Sample Skills & Commands for Launch

### Skills (always active in .claude/skills/)

| Name | Description |
|---|---|
| `api-patterns` | Enforces REST API design patterns (controller→service→repo, consistent responses) |
| `security-rules` | Security guardrails (no secrets in code, input validation, auth checks) |
| `testing-standards` | Testing conventions (naming, coverage, mocking strategy) |
| `git-conventions` | Git commit format, branch naming, PR description standards |
| `react-patterns` | React best practices (component structure, hooks, state management) |
| `error-handling` | Consistent error handling patterns across the project |
| `code-style` | Code style preferences (naming, file structure, imports) |

### Commands (invoked with /command-name)

| Name | Description |
|---|---|
| `code-review` | Deep code review with security, performance, and quality analysis |
| `gen-tests` | Generate tests for a file or function |
| `refactor` | Analyze and refactor selected code |
| `explain-codebase` | Walk through and explain the project structure |
| `gen-docs` | Generate documentation for code |
| `pr-description` | Generate PR description from staged changes |
| `debug-help` | Analyze an error and suggest fixes |

---

## Future Ideas (Post-Launch)

- Skill versioning with semver
- `plug create <name>` — scaffold a new skill/command locally
- `plug publish` — publish a local skill to a vault
- Skill dependencies (skill A requires skill B)
- Skill templates with variables (`$PROJECT_NAME`, `$LANGUAGE`)
- Community ratings/downloads on skills
- Web UI for browsing plugvault registry
- Auto-update notification when outdated skills detected
