# Dependency Resolution

Sprint 3 taught the install/remove lifecycle about dependencies. Packages can declare dependencies; `plug` resolves and installs them automatically.

## Install

When you run `plug install <package>`, the resolver checks whether the target package has dependencies:

- **No dependencies** — installs immediately, same behaviour as before Sprint 3.
- **Has dependencies** — builds an install plan and presents it before proceeding:
  - CLI: prints a summary of packages to install and packages already satisfied; prompts "Proceed? (Y/n)" unless `--yes` is set.
  - TUI: shows the **Install Plan** screen listing "Will install" and "Already satisfied" sections. Tab toggles between project scope (`.claude/`) and global scope (`~/.claude/`). Press `i` to confirm or Esc to cancel.

Dependencies are installed **before** the root package (depth-first order). Each dependency is tracked as `installed_as: "dependency"`; the root package is tracked as `installed_as: "explicit"`.

After all installs, each dependency's `dependents` list is updated to include the root package name.

### Scope toggle (TUI only)

The plan screen exposes a scope selector that controls whether the entire install (root + deps) lands in the project scope or globally. The selector only appears when the resolver finds additional packages to install.

### JSON mode

```
plug install <package> --json
```

The JSON output includes `hookRequired: true` when the installed skill declares a `hook:` or `hooks:` field in its frontmatter.

## Remove

```
plug remove <package>
plug remove <package> --cascade
plug remove <package> --force
plug remove <package> --yes
```

When removing a package that other packages depend on, `plug` prompts with three choices:

| Choice | Behaviour |
|--------|-----------|
| Cancel | Aborts; nothing is changed. |
| Remove all (cascade) | Removes each dependent package first (one level deep), then removes the target. |
| Force remove | Removes only the target; severs dependent edges without removing dependent packages. |

**Orphan pruning:** after any successful remove, `plug` checks for installed-as-dependency packages whose `dependents` list is now empty. If any exist, it prompts to prune them. `--yes` auto-prunes without prompting.

## Post-install hook notice

If an installed skill's frontmatter declares `hook:` or `hooks:`, `plug` prints:

```
⚠ Hook required: '<name>' expects a hook in settings.json
```

This is a notice only — `plug` does not modify `settings.json`. The user must wire the hook manually.
