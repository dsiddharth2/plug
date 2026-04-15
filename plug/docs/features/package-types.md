# Package Types

plug manages three types of Claude Code extension packages. They differ in what they are, where they install, and how Claude Code uses them.

## Type taxonomy

### skill

A skill is a context document that Claude Code loads automatically into its system context when the skill's trigger conditions are met. Skills describe capabilities, workflows, or domain knowledge — they guide Claude's behaviour without requiring an explicit user invocation.

**Install destination:** `.claude/skills/{name}/` (local) or `~/.claude/skills/{name}/` (global)

**Invocation:** Automatic — Claude Code picks up skills from the skills directory on startup. The skill's YAML frontmatter describes when it should activate.

**Example use case:** A "senior Python engineer" skill that sets coding style, testing conventions, and preferred libraries for a Python project.

### command

A command is a slash command — a markdown file that defines an interactive `/command-name` flow. Commands are invoked explicitly by the user in the Claude Code interface.

**Install destination:** `.claude/commands/{name}.md` (local) or `~/.claude/commands/{name}.md` (global)

**Invocation:** Explicit — user types `/command-name` in the Claude Code chat input.

**Example use case:** A `/code-review` command that runs a structured review checklist on the current diff.

### agent

An agent is a sub-agent definition — a markdown file that describes a specialised agent with its own set of instructions and tools. Agents are typically invoked by other agents or by Claude Code features that delegate to them.

**Install destination:** `.claude/agents/{name}/` (local) or `~/.claude/agents/{name}/` (global)

**Invocation:** Depends on the agent's design — typically called via the Agent tool or referenced from a skill.

**Example use case:** A "database migration agent" that handles schema change planning and execution.

---

## The shared install pipeline

All three types flow through the same install pipeline (`src/commands/install.js`):

1. Parse the package reference — `[vault/]name`. If no vault prefix, walk `resolve_order` to find which vault contains the package.
2. If multiple vaults contain the same name, prompt to resolve the conflict (`--yes` auto-picks first).
3. Fetch `registry.json` for the resolved vault, look up the package entry.
4. Fetch `{pkg.path}/meta.json` for full metadata (name, type, version, description, entry).
5. Fetch `{pkg.path}/{entry}` — the actual package file.
6. Route by type to the correct `.claude/` subdirectory (via `src/utils/paths.js` → `getClaudeDirForType`).
7. Write the file.
8. Update `installed.json` with the tracking record: `{ type, vault, version, path, installedAt }`.
9. Report the installed path and usage hint.

The TUI calls `runInstall` (the same function used by the CLI) via the stdout capture wrapper (`src/tui/utils/capture-stdout.js`) and reads the JSON result to display the path in the install-complete summary.

---

## Scope: local vs global

Both skills and commands support a local scope (relative to the current working directory) and a global scope (under `~/.claude/`). The install command defaults to local scope; pass `-g` / `--global` to install globally.

`installed.json` is scope-split: `.plugvault/installed.json` (local) and `~/.plugvault/installed.json` (global). The Installed TUI screen merges both with scope labels.

---

## Type badges in the TUI

The Discover and Installed screens display a `[agent]` badge for agent packages. Skill and command packages are unlabelled (they are the common case). Scope labels `[local]` / `[global]` appear in the Installed screen.
