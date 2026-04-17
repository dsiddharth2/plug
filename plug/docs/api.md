# API Reference

## resolver.js

### `resolve(pkgName, vaultHint?, options?)`

```ts
resolve(pkgName: string, vaultHint?: string | null, options?: { global?: boolean })
  : Promise<{ toInstall: string[], alreadySatisfied: string[], cycles: string[] }>
```

Resolves the full dependency graph for `pkgName` and returns an install plan.

| Return field | Type | Description |
|---|---|---|
| `toInstall` | `string[]` | Packages to install, dependency-first. Root package is last. |
| `alreadySatisfied` | `string[]` | Packages already in `installed.json` for the given scope. |
| `cycles` | `string[]` | Package names where a back-edge was detected; not added to `toInstall`. |

`vaultHint` is accepted but not currently used for routing — the full registry+community package map is always built. `options.global` (default `false`) selects which `installed.json` is consulted for the snapshot.

---

## tracker.js (Sprint 3 additions)

### `addDependents(name, newDependents, global?)`

```ts
addDependents(name: string, newDependents: string[], global?: boolean): Promise<void>
```

Merges `newDependents` into `installed[name].dependents` (dedup via `Set`). No-ops if `name` is not in `installed`. Saves.

### `getInstalledRecord(name, global?)`

```ts
getInstalledRecord(name: string, global?: boolean): Promise<object | null>
```

Returns `installed[name]` or `null` if not tracked.

### `prunableOrphans(global?)`

```ts
prunableOrphans(global?: boolean): Promise<string[]>
```

Returns names where `installed_as === 'dependency'` and `dependents.length === 0`. These are candidates for automatic pruning after a remove.

### `removeDependentEdge(fromName, toName, global?)`

```ts
removeDependentEdge(fromName: string, toName: string, global?: boolean): Promise<void>
```

Removes `fromName` from `installed[toName].dependents`. No-ops if `toName` is not tracked. Saves.

---

## frontmatter.js

### `parseFrontmatter(content)`

```ts
parseFrontmatter(content: string): Record<string, string>
```

Parses a YAML fence block from the top of a string. Returns `{}` on absent or malformed frontmatter. Never throws.

Checks `fm.hook || fm.hooks` to determine whether the installed skill requires a hook in `settings.json`.

---

## trackInstall metadata (Sprint 3 additions)

`trackInstall(name, metadata, global?)` now persists three additional optional fields from `metadata`:

| Field | Default | Notes |
|---|---|---|
| `installed_as` | `'explicit'` | `'dependency'` for auto-installed deps |
| `dependencies` | `[]` | Direct dep names at install time |
| `dependents` | `[]` | Populated later via `addDependents` |
