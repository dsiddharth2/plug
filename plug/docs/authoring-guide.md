# Skill Authoring Guide

This guide explains how to create your own skills, commands, and agents for plugvault, and how to publish them to a vault.

---

## Skills vs. Commands vs. Agents

plugvault supports three package types:

| Type | File location | How Claude uses it |
|------|---------------|--------------------|
| **command** | `.claude/commands/` | Invoked with `/command-name` |
| **skill** | `.claude/skills/` | Loaded automatically as project context |
| **agent** | `.claude/agents/` | Delegated to via the `Agent` tool |

**Commands** are best for discrete, on-demand tasks — code reviews, formatting checks, documentation generation. The user triggers them explicitly.

**Skills** are best for always-on guidance — coding conventions, API patterns, architecture rules. Claude reads them as background context for every interaction in the project.

**Agents** are best for specialized sub-tasks that can be delegated — background research, long-running analysis, parallel workstreams. Claude spawns them via the `Agent` tool and they run with their own context.

---

## Package Structure

A package lives in a vault registry under `registry/<package-name>/` and contains exactly two files:

```
registry/
  my-package/
    meta.json          # metadata
    my-package.md      # the skill or command content
```

The `.md` file name must match the `entry` field in `meta.json`.

---

## meta.json Schema

```json
{
  "name": "my-package",
  "type": "skill",
  "version": "1.0.0",
  "description": "One-line description shown in search results",
  "author": "your-github-username",
  "tags": ["tag1", "tag2"],
  "entry": "my-package.md"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Package identifier. Must be lowercase, hyphens only, no spaces. Must match the directory name and the `entry` filename (without extension). |
| `type` | string | yes | `"skill"`, `"command"`, or `"agent"` |
| `version` | string | yes | Semantic version string: `"MAJOR.MINOR.PATCH"` |
| `description` | string | yes | Short description (shown in `plug search` and `plug list --remote`) |
| `author` | string | no | GitHub username or display name |
| `tags` | string[] | no | Keywords for search. Keep them lowercase. |
| `entry` | string | yes | Filename of the content file relative to the package directory |

### Versioning

Use [semantic versioning](https://semver.org/):

- **PATCH** (`1.0.0` → `1.0.1`): typo fixes, small clarifications
- **MINOR** (`1.0.0` → `1.1.0`): new sections, expanded guidance
- **MAJOR** (`1.0.0` → `2.0.0`): breaking changes to how the skill/command behaves

`plug update` compares the installed version against the registry version numerically. Bump the version in `meta.json` and `registry.json` whenever you want users to receive an update.

---

## Writing the Content File

### Command template

Commands are invoked by the user with `/command-name`. Write them as Claude instructions in imperative form.

```markdown
# My Command

Brief description of what this command does.

## What to analyze / do

- Step 1: ...
- Step 2: ...

## Output Format

Describe the exact format Claude should use for output.
For each item:
- **Field**: description
```

Good commands are:
- **Scoped** — they do one thing well
- **Explicit about output format** — tell Claude exactly how to structure the response
- **Self-contained** — no external references or assumptions about project structure

### Skill template

Skills are loaded as context. Write them as standing instructions or rules.

```markdown
# Skill Name

One sentence explaining what this skill enforces or provides.

## Rules / Conventions

- Rule 1: ...
- Rule 2: ...

## Examples

Show correct and incorrect usage where helpful.
```

Good skills are:
- **Specific** — concrete rules, not vague advice
- **Concise** — Claude reads these as context; shorter is faster
- **Project-agnostic** — skills are shared across projects; avoid hardcoding project-specific details

### Agent template

Agents are spawned by Claude via the `Agent` tool. Write them as a focused system prompt that defines the agent's role, capabilities, and output contract.

```markdown
# Agent Name

One sentence describing what this agent specializes in and when to use it.

## Role

Describe the agent's persona and area of expertise.

## Inputs

List what information the agent expects to receive when spawned.

## Process

1. Step 1: ...
2. Step 2: ...

## Output

Describe the exact format the agent should return to the caller.
```

Good agents are:
- **Focused** — they do one thing well; narrow scope beats broad ambition
- **Self-contained** — agents run with isolated context; never assume the caller's state
- **Clear on outputs** — the spawning Claude needs to know exactly what it will receive back

---

## Adding a Package to a Vault

### 1. Fork the vault repository

Fork the vault you want to contribute to (e.g., `https://github.com/dsiddharth2/plugvault`).

### 2. Create the package files

```bash
cd registry
mkdir my-package
```

Create `registry/my-package/meta.json`:

```json
{
  "name": "my-package",
  "type": "command",
  "version": "1.0.0",
  "description": "Does something useful for Claude projects",
  "author": "your-github-username",
  "tags": ["useful", "example"],
  "entry": "my-package.md"
}
```

Create `registry/my-package/my-package.md` with your content.

### 3. Register it in registry.json

Add an entry to `registry.json` under `packages`:

```json
{
  "name": "vault-name",
  "version": "1.0.0",
  "packages": {
    "my-package": {
      "type": "command",
      "version": "1.0.0",
      "path": "registry/my-package",
      "description": "Does something useful for Claude projects",
      "tags": ["useful", "example"]
    }
  }
}
```

The `version`, `description`, and `tags` in `registry.json` must match `meta.json`.

### 4. Test locally

```bash
# Point a local vault at your fork
plug vault add my-fork https://github.com/your-username/plugvault
plug vault sync
plug install my-fork/my-package
```

Verify the installed file appears in `.claude/commands/` (for commands), `.claude/skills/` (for skills), or `.claude/agents/` (for agents).

### 5. Open a pull request

Open a PR against the vault's `main` branch. Include:
- What the package does
- Example use case
- Any limitations or assumptions

---

## Hosting Your Own Vault

You do not need to contribute to the official vault. You can host any GitHub repository as a vault.

**Requirements:**
- The repo must have a `registry.json` at the root of the `main` branch
- The file must conform to the registry schema (see above)
- Each package must have its `meta.json` and entry `.md` file at the path specified in `registry.json`

**Register it:**

```bash
plug vault add my-vault https://github.com/myorg/my-vault
```

**Private repos** — pass a GitHub token:

```bash
plug vault add my-private-vault https://github.com/myorg/private-skills \
  --token ghp_yourtoken \
  --private
```

See the [CLI README](../README.md) for token management options.

---

## Checklist Before Publishing

- [ ] `meta.json` has all required fields
- [ ] `name` in `meta.json` matches the directory name and `entry` filename (without `.md`)
- [ ] `version` in `meta.json` matches `registry.json`
- [ ] `description` is concise and searchable
- [ ] `tags` include obvious search terms
- [ ] Content file installs and works correctly with Claude
- [ ] `plug install <name>` and `plug remove <name>` both succeed
