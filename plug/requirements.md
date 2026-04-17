# Sprint 3 — Dependency Resolution Requirements

## Overview

The plug CLI currently installs packages one at a time with no dependency awareness. Running `plug install subagent-driven-development` installs only that package, leaving `using-git-worktrees` and `writing-plans` silently missing. Sprint 3 teaches the install/remove lifecycle about dependencies.

**Depends on:** Sprint 2 (community-discover) — `community-index.js` must be in place. Sprint 2 PR #17 is open and CI green; this sprint branches from `main` after merge.

---

## Problem Statement

1. **No dep resolution on install** — packages with dependencies listed in community-index.json are installed in isolation; dependents silently missing.
2. **No dep tracking in installed.json** — `installed.json` has no `installed_as`, `dependencies`, or `dependents` fields; no way to distinguish explicit vs transitive installs.
3. **No dep check on remove** — removing a package that other packages depend on gives no warning; orphaned deps are left behind.
4. **No post-install hook notice** — skill frontmatter may declare required hooks but install never surfaces this to the user.

---

## Scope

### A1 — Extend tracker.js
Add `installed_as`, `dependencies`, `dependents` fields to `installed.json` schema. Existing records normalised on read (no migration). Add four new functions: `updateDependents`, `getInstalledRecord`, `prunableOrphans`, `removeDependentEdge`.

Schema addition per record:
```json
{
  "api-patterns": {
    "type": "skill",
    "vault": "official",
    "version": "1.0.0",
    "path": "...",
    "installedAt": "...",
    "installed_as": "explicit",
    "dependencies": ["senior-engineer"],
    "dependents": []
  }
}
```

`trackInstall` gains three optional fields in `metadata`:
```js
installed_as: metadata.installed_as ?? 'explicit',
dependencies: metadata.dependencies ?? [],
dependents:   metadata.dependents   ?? [],
```

New functions:
- `updateDependents(name, dependents, global)` — sets `data.installed[name].dependents = dependents`; saves
- `getInstalledRecord(name, global)` — returns `data.installed[name] ?? null`
- `prunableOrphans(global)` — names where `installed_as === 'dependency' && dependents.length === 0`
- `removeDependentEdge(fromName, toName, global)` — removes `fromName` from `data.installed[toName].dependents`; saves

**Backward-compat:** any read path touching `rec.installed_as` must normalise: `rec.installed_as ?? 'explicit'`.

### A2 — resolver.js (new file)
DFS dependency resolver at `src/utils/resolver.js`.

Public API:
```js
export async function resolve(pkgName, vaultHint = null, options = {})
// returns { toInstall, alreadySatisfied, cycles }
```

Algorithm:
1. `buildPackageMap()` — fetch official registry.json then community-index.json; community wins on name conflict; both catch-wrapped (offline-safe)
2. Load `getInstalled()` once, pass snapshot into DFS — never call per-node
3. DFS: back-edge → cycle; already-visited → skip; after deps: check snapshot → alreadySatisfied or toInstall; mark visited
4. Result is naturally dep-first (topological), last element is pkgName

`community-index.js` minimal version (fetch + 1hr cache) is needed even though full B3 normaliser adapter lands in a later sprint. Import `fetchCommunityIndex` from `src/utils/community-index.js` — this already exists from Sprint 2.

### A3 — Wire install.js + A6 TUI scope toggle
Extract `installSinglePackage(pkgSpec, isGlobal)` private helper from `src/commands/install.js`.

Wiring in install:
1. Call `resolve(pkgName, vault.name, { global: isGlobal })`
2. If `plan.toInstall.length > 1`: print plan summary; if `!ctx.yes`, prompt "Proceed? (Y/n)"
3. Loop `plan.toInstall` calling `installSinglePackage`
4. Track each dep with `installed_as: 'dependency'`; root with `installed_as: 'explicit'`; both include `dependencies: [direct dep names]`
5. After all installs: call `updateDependents(dep.name, [pkgName], isGlobal)` for each dep

New TUI component `src/tui/components/install-plan.jsx`:
- Props: `{ queue, plan, loading, onConfirm(scope), onCancel }`
- Renders: spinner while loading; "Will install" list; "Already satisfied" list; scope selector (Tab toggles); footer `[i] Install [Esc] Cancel`

discover.jsx `'plan'` state: if `plan.toInstall.length > 1` → plan screen; if single package → install immediately (current behavior).

**Scope toggle UX decision:** plan screen only appears when resolver finds additional packages. Single packages with no deps install immediately — current behavior preserved.

### A4 — Wire remove.js
After loading pkg from `src/commands/remove.js`:
1. Check `pkg.dependents ?? []`
2. If non-empty: `select` prompt (Cancel / Remove all cascade / Force remove)
3. After any remove: `prunableOrphans()` + prune prompt; `--yes` auto-prunes

### A5 — Post-install hook notice
New `src/utils/frontmatter.js`:
```js
export function parseFrontmatter(content)
// returns Record<string,string> or {} if none/malformed
```
Regex: `---\n...\n---` block, parse `key: value` pairs, handle CRLF.

In `install.js` after writing SKILL.md: if `fm.hook || fm.hooks` → warn CLI or set `hookRequired: true` in JSON mode.

---

## Out of Scope

- TUI Discover tab reading community-index.json (Phase B3 — already done in Sprint 2)
- `normalizeCommunityPackage` full adapter
- Community vault badges and dep count display beyond what Sprint 2 delivered
- Package detail dep list with ✓/✗ installed status (Sprint 2 delivered this; Sprint 3 does not change it)

---

## Acceptance Criteria

1. `npm test` — all existing tests pass + all new tests green
2. `plug install subagent-driven-development` — resolver prints plan, deps installed first, all tracked in installed.json with correct `installed_as` / `dependents`
3. `plug install senior-engineer` (no deps) — installs immediately, no plan screen
4. `plug remove subagent-driven-development` — dependent warning fires if applicable, orphan prune prompt shown after
5. Manual TUI: package with deps → plan screen + scope toggle; no-dep package → installs immediately
6. Inspect installed.json after multi-dep install — `installed_as`, `dependencies`, `dependents` correct on every record
7. Regression: all Sprint 1 + Sprint 2 fixes still work

---

## Key Risks

1. **resolver.js N-reads** — must call `getInstalled()` once per `resolve()`, pass snapshot into DFS. Per-node `isInstalled()` calls re-read the file each time.
2. **Community package install path** — community packages have `rawBaseUrl + entry`; `installSinglePackage` must branch on presence of `rawBaseUrl`.
3. **ctx mutation timing in discover.jsx** — `ctx.set({ yes: true, json: true })` inside `doInstall()` must NOT fire during resolver async phase (plan view), only after user confirms.
4. **install.test.js mock layering** — existing mocks cover registry, fetcher, tracker. A3 adds resolver import; add `vi.mock('../src/utils/resolver.js', ...)` at the top.

---

## Branch

- **Branch:** `sprint/dep-resolution`
- **Base:** `main`
