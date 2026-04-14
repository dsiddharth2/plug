# PlugVault Skill Redesign — Implementation Plan

> Redesign plug from an npm CLI package to a Claude Code skill + interactive `/plug` command. All skill files live in `plug/skill/` in the repo for version control and distribution. A bootstrap script installs them to `~/.claude/`.

---

## Tasks

### Phase 1: Core Skill + Command

#### Task 1.1: Create SKILL.md (core skill file)
- **Change:** Create `plug/skill/SKILL.md` with YAML frontmatter and body containing: constants (official vault dsiddharth2/plugvault branch main, GitHub raw base URL, config paths, target directories), command routing table mapping user intent to operations + reference files, auth resolution (env vars → config.json token, never echo tokens), fetch pattern using `curl -sf`, inline operations (init creates dirs + empty installed.json; remove reads installed.json → deletes file → updates tracking), and scope handling (local default, global with -g flag)
- **Files:** `plug/skill/SKILL.md`
- **Tier:** standard
- **Done when:** SKILL.md has valid YAML frontmatter (name: plug, description with trigger phrases, argument-hint, allowed-tools: Read/Write/Edit/Bash/Glob/Grep), body is ~1500 words with all 6 sections, references point to `references/` subdirectory
- **Blockers:** None

#### Task 1.2: Create config-schema.md (JSON schemas)
- **Change:** Create `plug/skill/references/config-schema.md` documenting JSON schemas for all data files:
  - `config.json` (`~/.plugvault/config.json`): `{ vaults: { [name]: { name, owner, repo, branch, private, token? } }, resolve_order: string[], default_vault: string }`
  - `installed.json` (`.plugvault/installed.json` or `~/.plugvault/installed.json`): `{ installed: { [name]: { type, vault, version, path, installedAt } } }`
  - `registry.json` (vault repo root): `{ name, version, packages: { [name]: { type, version, path, description, tags? } } }`
  - `meta.json` (per-package in vault): `{ name, type, version, description, author?, tags?, entry }`
  - Default config seed: official vault pre-registered, resolve_order ["official"], default_vault "official"
- **Files:** `plug/skill/references/config-schema.md`
- **Tier:** standard
- **Done when:** All 4 schemas documented with field types and complete example JSON blocks, default config included
- **Blockers:** None

#### Task 1.3: Create plug-command.md (interactive /plug command)
- **Change:** Create `plug/skill/plug-command.md` — the `/plug` slash command entry point with full interactive flow using AskUserQuestion. Must include:
  - **Main Menu:** AskUserQuestion with 4 options (Browse Packages, Search, My Packages, Manage Vaults)
  - **Browse Packages flow:** fetch registries → type filter panel (All/Skills/Commands/Agents) → display package table → install panel (multiSelect: true, top 4 packages) → install + confirmation → conflict handling panel
  - **Search flow:** category panel (API & HTTP, Testing, Code Quality, DevOps) + "Other" for free text → fetch + score (name exact 40, partial 30, description 20, tag 10) → ranked results table → install panel
  - **My Packages flow:** read installed.json both scopes → display table with scope labels → action panel (Check for Updates, Remove, Done) → Updates: version comparison table + update selection panel (multiSelect) → Remove: package selection panel (multiSelect) + confirmation
  - **Manage Vaults flow:** read config → vault table → action panel (Add/Remove/Set Default/Sync) → Add: visibility panel + free-text details + test connectivity + confirmation → Remove: vault selection + safety check for official → Set Default: vault selection → Sync: fetch all + report
  - **Shortcut routing:** `/plug install X` skips menu, routes directly
  - Include exact AskUserQuestion JSON for every panel
  - Include example chat output markdown tables for every data display
  - Reference `~/.claude/skills/plug/references/` files for detailed procedures
- **Files:** `plug/skill/plug-command.md`
- **Tier:** standard
- **Done when:** Command has valid frontmatter (name, description, argument-hint, allowed-tools including AskUserQuestion), main menu panel, all 4 branches fully implemented with every sub-panel's AskUserQuestion JSON, all chat output table formats, shortcut routing logic, edge cases (no results, no packages, conflicts, auth errors)
- **Blockers:** None

#### VERIFY: Phase 1 — Core Skill + Command
- All 3 files created in `plug/skill/` with correct structure
- SKILL.md frontmatter is valid YAML
- plug-command.md includes all AskUserQuestion panels from the design spec at `roadmap/skill-redesign-plan.md`
- References between files use correct relative paths
- Report: file sizes, structure review, any gaps vs plan

---

### Phase 2: Reference Files

#### Task 2.1: Create install.md (install + update procedures)
- **Change:** Create `plug/skill/references/install.md` with complete step-by-step procedures for:
  - **Install:** 1) Parse package name (vault/name or just name), 2) Auto-init if .claude/ dirs missing, 3) Fetch registry.json using the fetch pattern from SKILL.md, 4) Look up package in registry.packages, 5) If not found and no vault prefix try each vault in resolve_order, 6) If found in multiple vaults use AskUserQuestion to ask user, 7) Check installed.json for existing entry — if present use AskUserQuestion to confirm overwrite, 8) Fetch {pkg.path}/meta.json, 9) Fetch {pkg.path}/{entry} (.md file), 10) Route by type: skill→.claude/skills/, command→.claude/commands/, agent→.claude/agents/, 11) Write file using Write tool, 12) Update installed.json with {type, vault, version, path, installedAt}, 13) Report success with path and usage hint
  - **Update:** 1) Read installed.json, 2) Fetch registry for recorded vault, 3) Compare versions, 4) If newer: re-download (steps 8-12 from install), 5) For --all: iterate all entries
  - Error handling for: 404 (package not found), 401/403 (auth failed), corrupt JSON, network failure
  - Scope support: local (CWD) vs global (~/)
- **Files:** `plug/skill/references/install.md`
- **Tier:** standard
- **Done when:** Both install and update procedures complete with numbered steps, all error cases handled, scope support documented
- **Blockers:** None

#### Task 2.2: Create search-and-list.md
- **Change:** Create `plug/skill/references/search-and-list.md` covering:
  - **List local:** Read .plugvault/installed.json (local) + ~/.plugvault/installed.json (global), merge with scope labels, apply --type and --vault filters if specified, format as markdown table (Package, Type, Version, Vault, Scope, Path)
  - **List remote:** For each vault in resolve_order fetch registry.json, collect all packages, apply filters, format as table (Name, Type, Vault, Version, Description)
  - **Search:** For each vault fetch registry, score each package: exact name match (40), partial name (30), description contains keyword (20), tag match (10), sort descending, present as table (Name, Type, Score, Vault, Description)
  - Include example markdown table output for each operation
- **Files:** `plug/skill/references/search-and-list.md`
- **Tier:** standard
- **Done when:** All 3 operations documented with step-by-step procedures, scoring algorithm specified, example table outputs included, multi-vault support, filter support
- **Blockers:** None

#### Task 2.3: Create vault-management.md
- **Change:** Create `plug/skill/references/vault-management.md` covering all 6 vault subcommands:
  - **vault list:** Read config.json, format as table (Name, Owner, Repo, Branch, Private, Default)
  - **vault add:** Parse GitHub URL to extract owner/repo, validate URL format, test connectivity with curl, add to config.vaults and config.resolve_order, write updated config. If private and user selected "Private" in visibility panel, prompt for token
  - **vault remove:** Refuse to remove "official" unless user confirms via safety AskUserQuestion panel. Delete from config.vaults and resolve_order. If was default_vault set next in order. Write config
  - **vault set-default:** Move vault to front of resolve_order, set default_vault, write config
  - **vault set-token:** Write token to config.vaults[name].token, test connectivity, warn about plaintext storage, recommend env vars
  - **vault sync:** For each vault in resolve_order, re-fetch registry.json, report per-vault status table (Vault, Status, Packages)
  - Error handling: connectivity failures with retry/add-anyway/cancel panel, auth failures
- **Files:** `plug/skill/references/vault-management.md`
- **Tier:** standard
- **Done when:** All 6 subcommands documented, AskUserQuestion panels for interactive flows match design spec, error handling panels included
- **Blockers:** None

#### VERIFY: Phase 2 — Reference Files
- All 3 reference files created in `plug/skill/references/`
- Cross-references between SKILL.md, plug-command.md, and reference files are consistent
- All operations from the CLI (init, install, remove, list, search, update, vault) are covered
- No gaps in the interactive flows
- Report: completeness check, cross-reference audit

---

### Phase 3: Bootstrap + Distribution

#### Task 3.1: Create install.sh bootstrap script
- **Change:** Create `plug/skill/install.sh` — a shell script that:
  1. Creates directories: `~/.claude/skills/plug/references/`, `~/.claude/commands/`
  2. Copies: SKILL.md → `~/.claude/skills/plug/SKILL.md`, references/*.md → `~/.claude/skills/plug/references/`, plug-command.md → `~/.claude/commands/plug.md`
  3. Handles existing files: warns if overwriting
  4. Reports what was installed
  Also create `plug/skill/uninstall.sh` that removes installed files and empty directories.
  Both scripts must work on macOS, Linux, and Windows (Git Bash).
- **Files:** `plug/skill/install.sh`, `plug/skill/uninstall.sh`
- **Tier:** cheap
- **Done when:** install.sh creates all dirs, copies all files, reports success. uninstall.sh removes files. Both are `chmod +x`.
- **Blockers:** None

#### Task 3.2: Install locally and verify
- **Change:** Run `bash plug/skill/install.sh` to install skill files to `~/.claude/`. Verify all files are in correct locations with `ls -la`.
- **Files:** No new files — verification only
- **Tier:** cheap
- **Done when:** All files installed to correct paths, structure verified
- **Blockers:** 3.1

#### VERIFY: Phase 3 — Bootstrap + Distribution
- install.sh and uninstall.sh both work
- Files installed to correct `~/.claude/` locations
- Report: installed file list with paths

---

### Phase 4: Documentation

#### Task 4.1: Update plug README
- **Change:** Update `plug/README.md`:
  - Add "Skill Installation (Recommended)" section before existing install section
  - Include the one-liner: `bash <(curl -sf https://raw.githubusercontent.com/dsiddharth2/plug/main/plug/skill/install.sh)`
  - Rename npm section to "CLI Installation (Legacy/CI)"
  - Add section explaining two entry points: `/plug` interactive command vs natural language skill
  - Add "How It Works" section for the skill (progressive disclosure, reference files)
- **Files:** `plug/README.md`
- **Tier:** cheap
- **Done when:** README has skill installation as primary method, CLI as secondary, both entry points explained, bootstrap one-liner present
- **Blockers:** None

#### Task 4.2: Update root README
- **Change:** Update root `README.md`:
  - Update Quick Start to show skill installation first
  - Mention the `/plug` interactive command
  - Keep CLI as alternative
- **Files:** `README.md`
- **Tier:** cheap
- **Done when:** Root README reflects skill-first approach
- **Blockers:** None

#### VERIFY: Phase 4 — Documentation
- Both READMEs updated with skill-first messaging
- No broken links
- Bootstrap one-liner URL is correct
- Report: documentation completeness

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| SKILL.md body exceeds ~2000 words, hurting progressive disclosure | Medium | Keep inline ops minimal, push detail to references |
| AskUserQuestion panel behavior differs from design | Low | Test in live Claude Code session after install |
| curl not available on some Windows setups | Low | Windows 10+ ships curl; document fallback |
| Existing CLI installed.json format mismatch | Low | Skill uses identical JSON schema — backward compatible |

## Notes
- Base branch: main
- Feature branch: feat/skill-redesign
- Each phase gets 1 commit
- Commit messages: Phase 1 = `feat: add core skill file, config schemas, and interactive /plug command`, Phase 2 = `feat: add install, search-list, and vault-management reference files`, Phase 3 = `feat: add bootstrap install/uninstall scripts`, Phase 4 = `docs: update READMEs for skill-first approach`
- All deliverables go in `plug/skill/` directory within the repo
- The roadmap design spec is at `roadmap/skill-redesign-plan.md` — doer should reference it for detailed interaction flows
