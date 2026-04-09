# PlugVault CLI — Implementation Plan

> Build a Node.js CLI tool (plug) and GitHub registry (plugvault) for installing reusable Claude skills and commands.

**Base branch:** main
**Feature branch:** feat/plugvault-cli
**ESM-only** (`"type": "module"`) — Node 18+ (native fetch, NO node-fetch)
**Dependencies:** commander, chalk, ora, @inquirer/prompts

---

## Tasks

### Phase 1: Scaffolding

#### Task 1.1: Initialize CLI project
- **Change:** Create plug/ directory with package.json (ESM, bin entry, name "plugvault"), bin/plug.js with shebang, src/ folder structure, .gitignore, LICENSE (MIT)
- **Files:** plug/package.json, plug/bin/plug.js, plug/src/index.js, plug/.gitignore, plug/LICENSE
- **Tier:** standard
- **Done when:** `node plug/bin/plug.js --help` shows commander help output
- **Blockers:** none

#### Task 1.2: Set up Commander framework
- **Change:** Wire up Commander in src/index.js with version, description, and stub subcommands (init, install, remove, list, search, update, vault). Create empty command files in src/commands/ that each export a function registering the subcommand
- **Files:** plug/src/index.js, plug/src/commands/init.js, plug/src/commands/install.js, plug/src/commands/remove.js, plug/src/commands/list.js, plug/src/commands/search.js, plug/src/commands/update.js, plug/src/commands/vault.js
- **Tier:** cheap
- **Done when:** `node plug/bin/plug.js --help` lists all subcommands, each subcommand shows its own --help
- **Blockers:** Task 1.1

#### Task 1.3: Create registry repo structure
- **Change:** Create plugvault/ directory with registry.json, 2 sample packages (code-review command, api-patterns skill) with meta.json and .md entry files each
- **Files:** plugvault/registry.json, plugvault/registry/code-review/meta.json, plugvault/registry/code-review/code-review.md, plugvault/registry/api-patterns/meta.json, plugvault/registry/api-patterns/api-patterns.md
- **Tier:** cheap
- **Done when:** registry.json parses correctly and references valid paths to existing files
- **Blockers:** none

#### VERIFY: Scaffolding
- `node plug/bin/plug.js --help` shows all commands
- plugvault/registry.json is valid JSON with 2 entries
- All referenced .md files exist in registry/

---

### Phase 2: Core Utilities

#### Task 2.1: Constants and path utilities
- **Change:** Create src/constants.js with all default paths, config file names, cache TTL (1 hour), GitHub raw URL templates. Create src/utils/paths.js with functions: getGlobalDir(), getClaudeSkillsDir(global?), getClaudeCommandsDir(global?), getInstalledFilePath(global?), ensureDir(path). All paths must use path.join and os.homedir() for Windows compatibility
- **Files:** plug/src/constants.js, plug/src/utils/paths.js
- **Tier:** standard
- **Done when:** Unit tests confirm correct paths on the current OS, ensureDir creates nested directories
- **Blockers:** Task 1.1

#### Task 2.2: Config and auth utilities
- **Change:** Create src/utils/config.js with getConfig(), saveConfig(), getVault(), getDefaultVault(), getResolveOrder(). Auto-seeds official vault on first run. Create src/utils/auth.js with getAuthForVault() (checks env vars PLUGVAULT_TOKEN_{NAME}, PLUGVAULT_GITHUB_TOKEN, then config token) and getAuthHeaders()
- **Files:** plug/src/utils/config.js, plug/src/utils/auth.js
- **Tier:** standard
- **Done when:** getConfig() returns defaults when no config exists, getAuthForVault() resolves token from env -> config fallback chain
- **Blockers:** Task 2.1

#### Task 2.3: Registry and fetcher utilities
- **Change:** Create src/utils/registry.js with fetchRegistry(vault), getCachedRegistry(vaultName), cacheRegistry(vaultName, data), findPackage(name, vaultName?). Create src/utils/fetcher.js with downloadFile(vault, filePath) using native fetch with auth header support. Cache stored at ~/.plugvault/cache/ with 1-hour TTL
- **Files:** plug/src/utils/registry.js, plug/src/utils/fetcher.js
- **Tier:** standard
- **Done when:** Can programmatically fetch a registry.json from a GitHub repo and download a .md file by path
- **Blockers:** Task 2.2

#### Task 2.4: Tracker utility
- **Change:** Create src/utils/tracker.js with getInstalled(global?), trackInstall(name, metadata), trackRemove(name), isInstalled(name). Reads/writes .plugvault/installed.json
- **Files:** plug/src/utils/tracker.js
- **Tier:** cheap
- **Done when:** Can track install/remove operations and persist to installed.json
- **Blockers:** Task 2.1

#### VERIFY: Core Utilities
- All utility modules import cleanly (no circular deps)
- Unit tests pass for paths, config, auth, registry, fetcher, tracker
- `node -e "import('./plug/src/utils/paths.js')"` resolves without error

---

### Phase 3: Core Commands

#### Task 3.1: Implement `plug init`
- **Change:** Wire up init command to create .claude/skills/, .claude/commands/, and .plugvault/installed.json in the current project directory. Skip existing dirs, print confirmation with chalk
- **Files:** plug/src/commands/init.js
- **Tier:** cheap
- **Done when:** Running `plug init` in a temp dir creates all three paths, running again skips gracefully
- **Blockers:** Task 2.1

#### Task 3.2: Implement `plug install -i <name>`
- **Change:** Full install flow: parse name for vault/ prefix, resolve vault via resolve_order, fetch registry, find package, download .md file, route by type (skill -> .claude/skills/, command -> .claude/commands/), support -g flag for global, handle conflicts with @inquirer/prompts, auto-init if .claude/ missing, check if already installed (prompt overwrite), track in installed.json, print result with path and usage hint
- **Files:** plug/src/commands/install.js
- **Tier:** premium
- **Done when:** `plug install -i code-review` fetches from registry and places code-review.md in .claude/commands/, tracked in installed.json
- **Blockers:** Tasks 2.2, 2.3, 2.4, 3.1

#### Task 3.3: Implement `plug remove <name>`
- **Change:** Check installed.json, delete the .md file from .claude/skills/ or .claude/commands/, remove from installed.json, support -g flag, print confirmation
- **Files:** plug/src/commands/remove.js
- **Tier:** cheap
- **Done when:** `plug remove code-review` deletes the file and updates installed.json
- **Blockers:** Task 2.4

#### Task 3.4: Implement `plug list`
- **Change:** Read local + global installed.json, format as table (name, type, vault, version, path). Support --remote flag (fetch all registries and list available), --vault filter, --type filter
- **Files:** plug/src/commands/list.js
- **Tier:** standard
- **Done when:** `plug list` shows installed packages, `plug list --remote` shows all available from registries
- **Blockers:** Tasks 2.3, 2.4

#### VERIFY: Core Commands
- Full cycle works: `plug init` -> `plug install -i code-review` -> `plug list` -> `plug remove code-review`
- Files placed in correct directories based on type
- installed.json correctly tracks all operations
- Global flag (-g) installs to ~/.claude/ paths

---

### Phase 4: Vault Management

#### Task 4.1: Implement `plug vault add` and `plug vault remove`
- **Change:** vault add: validate URL, support --token and --private flags, test connectivity by fetching registry.json, save to config, add to resolve_order. vault remove: remove from config and resolve_order, clear cached registry, prevent removing "official" unless --force
- **Files:** plug/src/commands/vault.js
- **Tier:** standard
- **Done when:** Can add a vault, verify it works, and remove it. Config.json updated correctly
- **Blockers:** Task 2.2

#### Task 4.2: Implement `plug vault list`, `set-default`, `set-token`
- **Change:** vault list: print table (name, URL, public/private, default, package count). vault set-default: update default flag and move to top of resolve_order. vault set-token: update token in config and test connectivity
- **Files:** plug/src/commands/vault.js
- **Tier:** cheap
- **Done when:** `plug vault list` shows registered vaults, set-default changes resolve order, set-token updates auth
- **Blockers:** Task 4.1

#### Task 4.3: Implement `plug vault sync`
- **Change:** Re-fetch registry.json from all configured vaults, update cache, print summary with vault count and total package count
- **Files:** plug/src/commands/vault.js
- **Tier:** cheap
- **Done when:** `plug vault sync` refreshes all caches and prints summary
- **Blockers:** Tasks 2.3, 4.1

#### VERIFY: Vault Management
- Can add a public vault, list it, sync its registry, install from it
- Can set a new default vault and verify resolve order changes
- Removing a vault clears its cache
- Private vault with token auth connects successfully

---

### Phase 5: Search & Update

#### Task 5.1: Implement `plug search <keyword>`
- **Change:** Fetch registries from all vaults (use cache), match keyword against name, description, and tags with relevance scoring, support --vault and --type filters, print results with vault source and match highlights
- **Files:** plug/src/commands/search.js
- **Tier:** standard
- **Done when:** `plug search review` finds code-review across vaults, filters work correctly
- **Blockers:** Task 2.3

#### Task 5.2: Implement `plug update <name>` and `plug update --all`
- **Change:** Read installed version from installed.json, fetch latest from registry, compare semver, if newer re-download and overwrite .md file, update installed.json. --all flag loops through all installed packages. Print update summary with version changes
- **Files:** plug/src/commands/update.js
- **Tier:** standard
- **Done when:** `plug update code-review` detects and applies version change, `plug update --all` checks all installed packages
- **Blockers:** Tasks 2.3, 2.4

#### VERIFY: Search & Update
- `plug search <keyword>` returns relevant results across vaults
- `plug update <name>` correctly detects newer version and re-downloads
- `plug update --all` processes all installed packages
- Filters (--vault, --type) narrow results correctly

---

### Phase 6: Polish & Error Handling

#### Task 6.1: Add spinners and color output
- **Change:** Add ora spinners to all network operations (fetch registry, download file, sync vaults). Add chalk colors: green for success, red for errors, yellow for warnings, cyan for info. Ensure all commands have consistent visual feedback
- **Files:** plug/src/commands/*.js, plug/src/utils/fetcher.js, plug/src/utils/registry.js
- **Tier:** standard
- **Done when:** All network operations show spinners, all output is appropriately colored
- **Blockers:** Tasks 3.2, 4.3, 5.2

#### Task 6.2: Error handling and edge cases
- **Change:** Handle: no internet, 404 repo, package not found, auth failure, file permission errors, corrupt config.json (auto-repair with defaults), corrupt installed.json (auto-repair with empty). Edge cases: install when .claude/ missing (auto-init), duplicate install (prompt overwrite), remove non-existent package, vault add with duplicate name
- **Files:** plug/src/utils/config.js, plug/src/utils/tracker.js, plug/src/utils/fetcher.js, plug/src/utils/registry.js, plug/src/commands/*.js
- **Tier:** premium
- **Done when:** CLI handles all error cases gracefully with helpful messages, never crashes with unhandled exceptions
- **Blockers:** Task 6.1

#### Task 6.3: Add global flags (--verbose, --json, --yes)
- **Change:** Add --verbose flag for debug output (log fetch URLs, auth method, cache hits). Add --json flag for script-friendly JSON output on all commands. Add --yes flag to skip interactive prompts (auto-confirm overwrites, auto-pick first vault on conflict)
- **Files:** plug/src/index.js, plug/src/commands/*.js
- **Tier:** standard
- **Done when:** --verbose shows detailed logs, --json outputs parseable JSON, --yes skips all prompts
- **Blockers:** Task 6.2

#### VERIFY: Polish & Error Handling
- All commands show spinners during network ops
- `plug install -i nonexistent` shows helpful error, not a stack trace
- `plug --json list` outputs valid JSON
- `plug --verbose install -i code-review` shows debug info
- Corrupt config.json is auto-repaired on next run

---

### Phase 7: Documentation

#### Task 7.1: CLI README and contributing guide
- **Change:** Write plug/README.md with project description, quick start, all commands with examples, vault management guide, private repos setup. Write plug/CONTRIBUTING.md with how to contribute to the CLI and how to create/submit skills
- **Files:** plug/README.md, plug/CONTRIBUTING.md
- **Tier:** standard
- **Done when:** A new user can read the README and get started in 2 minutes
- **Blockers:** Task 6.3

#### Task 7.2: Skill authoring guide and registry README
- **Change:** Write skill authoring guide covering: skill vs command differences, meta.json schema, templates for both types. Write plugvault/README.md with list of available skills/commands and contributing guide for adding new ones
- **Files:** plug/docs/authoring-guide.md, plugvault/README.md, plugvault/CONTRIBUTING.md
- **Tier:** cheap
- **Done when:** A developer can follow the guide to create and submit a new skill to the registry
- **Blockers:** Task 7.1

#### VERIFY: Documentation
- README has quick start that works end-to-end
- All commands documented with examples
- Skill authoring guide includes complete meta.json schema
- Registry README lists all available packages

---

### Phase 8: Publish

#### Task 8.1: Pre-publish checks
- **Change:** Verify package.json is correct (name "plugvault", bin entry, version, description, keywords, repository, license). Add .npmignore or files field to exclude tests/docs from npm package. Run `npm pack --dry-run` to verify package contents
- **Files:** plug/package.json, plug/.npmignore
- **Tier:** cheap
- **Done when:** `npm pack --dry-run` shows correct files, no test/doc bloat
- **Blockers:** Task 7.1

#### Task 8.2: Publish to npm and create GitHub release
- **Change:** Run `npm publish` to publish plugvault to npm. Test clean install with `npm install -g plugvault`. Run full flow: init -> install -> list -> search -> remove -> vault add. Create GitHub release with changelog
- **Files:** none (operational)
- **Tier:** premium
- **Done when:** `npm install -g plugvault && plug --help` works for anyone
- **Blockers:** Task 8.1

#### VERIFY: Publish
- `npm install -g plugvault` installs cleanly
- `plug --help` works after global install
- Full flow: init -> install -> list -> remove works
- GitHub release exists with changelog

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub raw URL rate limiting | Install failures for popular packages | Cache registry.json locally with 1-hour TTL, batch downloads |
| Private repo auth complexity | Users can't access company vaults | Env var -> config -> git credential fallback chain, clear error messages |
| ESM-only breaks on older Node | CLI won't start | Enforce `engines.node >= 18` in package.json, check at startup |
| chalk/ora ESM imports fail | No colored output | Pin to chalk 5.x and ora 7.x, test import chain |
| Windows path issues | Files written to wrong location | Use path.join everywhere, never hardcode `/`, test on Windows |
| npm name "plugvault" taken | Can't publish | Check availability early (Phase 1), have backup name |
| Registry.json conflicts on concurrent vault reads | Race conditions | Sequential vault resolution, lock file for writes |
| Large .md files slow to download | Poor UX on slow connections | Ora spinners, size limit warning in meta.json |
