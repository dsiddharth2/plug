# Architecture

## installed.json Schema (Sprint 3+)

`installed.json` tracks every installed package under the `installed` key. Each record now carries three additional fields:

```json
{
  "installed": {
    "senior-engineer": {
      "type": "skill",
      "vault": "official",
      "version": "1.0.0",
      "path": ".claude/skills/senior-engineer/",
      "installedAt": "2026-04-17T00:00:00.000Z",
      "installed_as": "explicit",
      "dependencies": [],
      "dependents": []
    },
    "subagent-driven-development": {
      "type": "skill",
      "vault": "community",
      "version": "1.0.0",
      "path": ".claude/skills/subagent-driven-development/",
      "installedAt": "2026-04-17T00:00:00.000Z",
      "installed_as": "explicit",
      "dependencies": ["using-git-worktrees", "writing-plans"],
      "dependents": []
    },
    "using-git-worktrees": {
      "type": "skill",
      "vault": "community",
      "version": "1.0.0",
      "path": ".claude/skills/using-git-worktrees/",
      "installedAt": "2026-04-17T00:00:00.000Z",
      "installed_as": "dependency",
      "dependencies": [],
      "dependents": ["subagent-driven-development"]
    }
  }
}
```

Field semantics:

| Field | Values | Default |
|-------|--------|---------|
| `installed_as` | `"explicit"` \| `"dependency"` | `"explicit"` |
| `dependencies` | Direct dep names declared at install time | `[]` |
| `dependents` | Packages that required this one | `[]` |

Older records without these fields are normalised on read: any code path touching `rec.installed_as` uses `rec.installed_as ?? 'explicit'`. No migration is needed.

## DFS Resolver (`src/utils/resolver.js`)

The resolver performs a depth-first traversal of the dependency graph to produce an ordered install plan.

**Entry point:**
```js
resolve(pkgName, vaultHint = null, options = {})
// returns Promise<{ toInstall: string[], alreadySatisfied: string[], cycles: string[] }>
```

**Algorithm:**

1. `buildPackageMap()` — fetches official registry(ies) then the community index into a single `Map<name, pkgData>`. Community entries win on name conflict. Both sources are catch-wrapped (offline-safe); a missing source is skipped.
2. `getInstalled(isGlobal)` is called **once** per `resolve()` invocation. The snapshot is passed into DFS — never called per-node.
3. DFS (`dfsResolve`):
   - Back-edge (`inStack` hit) → push to `cycles`, return.
   - Already-visited → return.
   - For each required dep (deps with `required !== false`; unknown deps silently skipped): recurse.
   - After all deps: check snapshot → push to `alreadySatisfied` or `toInstall`.
   - Mark visited.
4. Result: `toInstall` is in dependency-first order; the root package is always last.

Optional deps (`required: false`) are silently skipped. Unknown package names in dep lists are silently skipped (offline-safe).

## Install-Plan TUI Component (`src/tui/components/install-plan.jsx`)

Props: `{ queue, plan, loading, onConfirm(scope: 'project'|'global'), onCancel }`

States:
- While `loading`: spinner.
- Ready: "Will install" section (from `plan.toInstall`), "Already satisfied" section (`plan.alreadySatisfied`), scope selector (`Tab` toggles between `project` and `global`), footer `[i] Install  [Esc] Cancel`.

`onConfirm` is called with the selected scope string. `onCancel` is called on Esc.

The component is rendered by `DiscoverView` when a package has dependencies (`plan.toInstall.length > 1`). Single-package installs bypass the plan screen entirely and call `doInstall` immediately.

`ctx.set({ yes: true, json: true })` is called inside `doInstall()` only — never during the resolver async phase — to prevent context state pollution while the plan view is displayed.

## Frontmatter Parser (`src/utils/frontmatter.js`)

```js
parseFrontmatter(content)
// returns Record<string, string> — {} on no frontmatter or malformed input
```

Parses a YAML fence block at the top of a file:

```
---
key: value
hook: pre-tool-use
---
```

- Regex: `^---\r?\n([\s\S]*?)\r?\n---` — non-greedy, handles CRLF.
- Key-value split uses `indexOf(':')` so colons in values are preserved (e.g., `hook: pre-tool-use:v2`).
- Lines without a colon are skipped; empty keys are skipped.
- Any regex miss returns `{}` — no exception thrown.

Used by `install.js` after writing the SKILL.md file to disk. Only invoked for `type === 'skill'` packages.
