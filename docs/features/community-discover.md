# Community Discover

## Overview

The Discover tab surfaces packages from two sources: official vault packages (fetched per-vault via `registry.json`) and community vault packages (fetched once via `community-index.json`). Both are merged into a single sorted list before display.

## community-index.json

`community-index.json` is maintained in the [plugvault](https://github.com/dsiddharth2/plugvault) repository. It is a flat index of all community-contributed packages across all vaults, published at a stable public URL:

```
https://raw.githubusercontent.com/dsiddharth2/plugvault/main/community-index.json
```

No authentication is required — the URL is always public.

The index covers 846 packages across three vaults:
- `superpowers`: 18 packages
- `everything-claude-code`: 561 packages
- `claude-skills`: 267 packages

56 packages carry curated `dependencies[]` arrays.

## Merge Into Discover Tab

Community packages are merged in `src/tui/hooks/use-packages.js` inside `load()`, **after** the existing per-vault loop completes:

1. Attempt `fetchCommunityIndex()` — fetch from URL, cache locally, return parsed data.
2. Map each entry through `normalizeCommunityPackage()` to produce the internal package shape.
3. Push normalized packages into the `all` array.
4. The existing alphabetical sort at the end of `load()` handles the merged list.

If the community fetch fails, the `catch` block attempts `getStaleCommunityIndexCache()`. If a stale cache exists, those packages are included (counted in `staleFallbackCount`). If there is no cache, the community packages are silently absent.

## normalizeCommunityPackage Contract

`normalizeCommunityPackage(pkg)` maps the community-index shape to the internal package shape:

| Output field   | Source field          | Notes                                      |
|----------------|-----------------------|--------------------------------------------|
| `name`         | `pkg.name`            |                                            |
| `vault`        | `pkg.vault`           |                                            |
| `vaultUrl`     | `pkg.vaultUrl`        |                                            |
| `version`      | `pkg.version`         | Defaults to `'?'` when null/undefined      |
| `type`         | `pkg.type`            |                                            |
| `description`  | `pkg.description`     | Defaults to `''` when null/undefined       |
| `tags`         | `pkg.tags`            | Defaults to `[]` when null/undefined       |
| `path`         | `pkg.directory`       | Maps to the `path` field used by registry  |
| `entry`        | `pkg.entry`           |                                            |
| `rawBaseUrl`   | `pkg.rawBaseUrl`      | Used by the installer (Sprint 3)           |
| `dependencies` | `pkg.dependencies`    | Defaults to `[]` when absent               |
| `depCount`     | `pkg.dependencies.length` | Derived; 0 when no dependencies        |
| `source`       | `'community'`         | Hard-coded; distinguishes from official    |

The `source: 'community'` marker is the canonical way to tell community packages apart from official vault packages at runtime.

## Failure Behavior

Community fetch failure is **non-blocking**. The community fetch has its own `try/catch` block, separate from the vault loop. This means:

- Community failure does **not** increment `networkFailCount` — the "all vaults failed" error screen is never triggered by community issues.
- Official packages always show regardless of community fetch outcome.
- On network failure: if a stale cache exists, community packages show from cache. If no cache exists, community packages are absent but the TUI continues normally.

## Dep Count Display (`showDeps` prop)

`PackageItem` accepts a `showDeps` boolean prop (default: `false`). When `true`, a dep count string is appended to the package row:

- `depCount > 0` → `· ★ N dep` / `· ★ N deps`
- `depCount === 0` or undefined → `· no deps`

Only the Discover screen passes `showDeps={true}`. The Installed tab does not, keeping those rows unchanged.

## Dep List in Package Detail (`installedNames` Set)

`PackageDetail` receives an `installedNames: Set<string>` prop — the set of currently installed package names. Per-dep installed status is checked via `installedNames.has(dep.name)`.

When a package has `dependencies.length > 0`, the detail panel renders a **Dependencies** section:
- Required dep (`dep.required === true`): bullet `•`
- Optional dep (`dep.required === false`): circle `○`
- Installed: green `✓ installed`
- Not installed: dimmed `not installed`

## "Installing This Will Also Install" Behavior

Below the dep list, if any required deps are uninstalled, a summary line appears:

> Installing this will also install: `dep-a`, `dep-b`

This line lists only deps where `dep.required === true && !installedNames.has(dep.name)`. Optional uninstalled deps are shown in the dep list but do not appear in this summary.
