# Skills Install Layout

## Directory structure

Each skill is installed into its own subdirectory under `.claude/skills/`:

```
.claude/
  skills/
    code-review/
      SKILL.md
    senior-engineer/
      SKILL.md
  commands/
    commit.md
    review.md
  agents/
    researcher/
      agent.md
```

Skills use a per-skill subdirectory (`<name>/SKILL.md`); commands remain flat (`<name>.md`). This matches the layout Claude Code expects for skills and prevents multiple skills from overwriting each other's single `SKILL.md` file.

## Why per-skill subdirectories

The original layout wrote every skill to the same path: `.claude/skills/SKILL.md`. Installing a second skill would overwrite the first. The current layout gives each skill its own subdirectory so installs are independent.

Commands are not affected — they were and remain flat.

## How install routes by type

`src/commands/install.js` routes the downloaded file to the correct path based on `meta.type`:

```
if type === 'skill':
  destPath = .claude/skills/<pkgName>/SKILL.md
else:
  destPath = .claude/<type>s/<entryFile>        (commands, agents)
```

`ensureDir` (wraps `fs.mkdir` with `{ recursive: true }`) creates the subdirectory if it doesn't exist.

## Legacy migration

When installing any skill, plug automatically migrates a legacy flat `SKILL.md` if one is present:

1. Attempts to read `.claude/skills/SKILL.md`.
2. If not found (`ENOENT`): no-op.
3. If found: parses the YAML frontmatter block between the first `---` fences.
4. Extracts `name:` from the frontmatter using `/^name:\s*(\S+)/m`.
5. Moves the file to `.claude/skills/<name>/SKILL.md`.
6. Updates `installed.json` to record the new path.

**Non-destructive fallback:** if the file has no frontmatter or no `name:` field, plug logs a warning and leaves the file in place. The install of the new skill continues regardless.

The migration runs on every skill install via `migrateLegacyFlatSkillFile()` in `install.js`. The function is idempotent: if no legacy file exists, the `readFile` throws `ENOENT` and the function returns immediately at negligible cost.

## Manifest tracking

After each install, `trackInstall()` records the full `destPath` in `installed.json`. The TUI Installed tab reads `pkg.path` from this manifest — it displays whatever path was recorded at install time, so it automatically reflects the per-skill subdir layout without any separate TUI-side change.

## Global vs local scope

All paths above are local-scoped (relative to the current working directory's `.claude/`). Pass `-g` / `--global` to use the global scope (`~/.claude/`). Both scopes use the same subdir layout for skills.
