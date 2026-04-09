# Requirements — PlugVault CLI

## Base Branch
`main` — branch to fork from and merge back to

## Goal
Build a CLI tool (`plug`) and GitHub registry (`plug-valut`) that lets developers install reusable Claude skills and commands into any project. Think npm but for Claude .md files.

## Scope
- CLI (`plugvault` on npm) with commands: init, install, remove, list, search, update, vault
- GitHub-hosted registry repo (`plug-valut`) with registry.json index and package folders
- Support for public and private vaults via GitHub raw URLs and API
- File-based caching at `~/.plugvault/cache/` with 1-hour TTL
- Local and global install scopes (project `.claude/` vs user `~/.claude/`)
- Installed package tracking via `.plugvault/installed.json`

## Out of Scope
- Multi-file packages — v1 is single .md file per package only
- Package publishing CLI — authors push to registry repos manually
- Web UI or dashboard
- Versioning beyond simple semver compare

## Constraints
- ESM-only (`"type": "module"`) — chalk 5.x and ora 8.x require it
- Node 18+ (native fetch, no node-fetch)
- Dependencies: commander, chalk, ora, @inquirer/prompts
- Windows-compatible paths (use path.join, os.homedir)

## Acceptance Criteria
- [ ] `plug --help` shows all commands
- [ ] `plug init` creates .claude/skills/, .claude/commands/, .plugvault/installed.json
- [ ] `plug install <name>` fetches from registry and places .md in correct dir
- [ ] `plug remove <name>` deletes file and updates tracker
- [ ] `plug list` shows installed packages; `plug list --remote` shows registry
- [ ] `plug search <keyword>` finds packages across vaults with scoring
- [ ] `plug update` checks and updates outdated packages
- [ ] `plug vault add/remove/list/set-default/set-token/sync` manages multiple vaults
- [ ] Private vault access works with GitHub token auth
- [ ] Published to npm as `plugvault`, installable globally
