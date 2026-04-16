# plug — Sprint 2: Community Discover

> Wire the TUI Discover tab to read `community-index.json` so all 846 community packages appear alongside official ones, with dep counts and vault badges. Three phases; three commits.

**Base branch:** `main`  
**Feature branch:** `sprint/community-discover`

---

## Tasks

### Phase 1: Community Index Util

#### Task 1.1: Add COMMUNITY_INDEX_URL constant
- **Change:** Add the following to `src/constants.js`:
  ```js
  export const COMMUNITY_INDEX_URL =
    'https://raw.githubusercontent.com/dsiddharth2/plugvault/main/community-index.json'
  ```
- **Files:** `src/constants.js`
- **Tier:** cheap
- **Done when:** constant is exported and importable.
- **Blockers:** none.

#### Task 1.2: Create `src/utils/community-index.js`
- **Change:** New file mirroring the cache pattern in `src/utils/registry.js` exactly — same `CACHE_TTL_MS`, same cache dir (`getCacheDir()`), same error handling approach. Implement:

  | Function | What it does |
  |---|---|
  | `getCachedCommunityIndex()` | Returns cached data if fresh (< `CACHE_TTL_MS`), else null |
  | `cacheCommunityIndex(data)` | Writes to `getCacheDir()/community-index.json` |
  | `getStaleCommunityIndexCache()` | Returns cached data regardless of age (offline fallback) |
  | `fetchCommunityIndex()` | Fetch → cache → return; throws on network/HTTP failure |
  | `normalizeCommunityPackage(pkg)` | Adapter: community-index shape → internal package shape |

  **`normalizeCommunityPackage` exact implementation:**
  ```js
  export function normalizeCommunityPackage(pkg) {
    return {
      name:         pkg.name,
      vault:        pkg.vault,
      vaultUrl:     pkg.vaultUrl,
      version:      pkg.version ?? '?',
      type:         pkg.type,
      description:  pkg.description ?? '',
      tags:         pkg.tags ?? [],
      path:         pkg.directory,       // maps to registry.json "path"
      entry:        pkg.entry,
      rawBaseUrl:   pkg.rawBaseUrl,      // used by install in Sprint 3
      dependencies: pkg.dependencies ?? [],
      depCount:     (pkg.dependencies ?? []).length,
      source:       'community',         // distinguishes from official vault packages
    }
  }
  ```

  `fetchCommunityIndex` does NOT use auth headers (URL is always public). No secrets needed.
- **Files:** `src/utils/community-index.js` (new)
- **Tier:** standard
- **Done when:** all 5 functions implemented; module exports cleanly; `getCachedCommunityIndex` returns null on miss, data on hit; `fetchCommunityIndex` fetches-caches-returns; `normalizeCommunityPackage` maps fields per spec above.
- **Blockers:** read `src/utils/registry.js` first to mirror its exact pattern.

#### VERIFY: Phase 1
- Run full `npm test` — zero failures (no new tests in this phase, just confirm baseline holds).
- Smoke: `node -e "import('./src/utils/community-index.js').then(m => console.log(Object.keys(m)))"` — lists expected exports.
- Commit: `feat(community-index): add fetch + cache util`. Push to `sprint/community-discover`.

---

### Phase 2: TUI Integration

#### Task 2.1: Merge community packages in `use-packages.js`
- **Change:** Inside `load()` in `src/tui/hooks/use-packages.js`, **after** the existing vault loop, add:
  ```js
  try {
    const communityIndex = await fetchCommunityIndex()
    all.push(...(communityIndex.packages ?? []).map(normalizeCommunityPackage))
  } catch {
    const stale = await getStaleCommunityIndexCache()
    if (stale) {
      all.push(...(stale.packages ?? []).map(normalizeCommunityPackage))
      staleFallbackCount++
    }
    // Do NOT increment networkFailCount — community failure is non-blocking.
  }
  ```
  Import `fetchCommunityIndex`, `getStaleCommunityIndexCache`, `normalizeCommunityPackage` from `../utils/community-index.js`.
  The existing sort at the end of `load()` handles the merged list alphabetically.
- **Files:** `src/tui/hooks/use-packages.js`
- **Tier:** standard
- **Done when:** Discover tab shows 800+ packages when online; if community fetch fails, official packages still show.
- **Blockers:** `networkFailCount` must only count official vault failures — the community catch block must NOT touch it.

#### Task 2.2: Add dep count in `package-item.jsx`
- **Change:** Add dep count to the package row. Guard with a `showDeps` prop so the Installed tab is unaffected:
  ```js
  const depStr = item.depCount > 0
    ? ` · ★ ${item.depCount} dep${item.depCount === 1 ? '' : 's'}`
    : ' · no deps'

  const nameLine = `${item.name} · ${item.vault}${versionStr}${showDeps ? depStr : ''}`
  ```
  `showDeps` defaults to `false`. Only `discover.jsx` passes `showDeps={true}`.
- **Files:** `src/tui/components/package-item.jsx`
- **Tier:** standard
- **Done when:** packages with `depCount > 0` show `★ N deps`; packages with `depCount: 0` or undefined show `· no deps` when `showDeps={true}`; Installed tab (no `showDeps`) unchanged.
- **Blockers:** `undefined > 0` is `false` — renders 'no deps'. Correct.

#### Task 2.3: Add dep list to `package-detail.jsx`
- **Change:** 
  1. Change prop from `isInstalled: boolean` → `installedNames: Set<string>`. Per-dep status: `installedNames.has(dep.name)`.
  2. Add dep list section below tags when `pkg.dependencies?.length > 0`:
  ```jsx
  {pkg.dependencies?.length > 0 && (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>Dependencies:</Text>
      {pkg.dependencies.map(dep => (
        <Box key={dep.name} paddingLeft={2}>
          <Text dimColor>{dep.required ? '•' : '○'} </Text>
          <Text>{dep.name}</Text>
          <Text dimColor> ({dep.vault})</Text>
          {installedNames.has(dep.name)
            ? <Text color="green">  ✓ installed</Text>
            : <Text dimColor>  not installed</Text>}
        </Box>
      ))}
      {pkg.dependencies.filter(d => d.required && !installedNames.has(d.name)).length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>Installing this will also install: </Text>
          <Text>
            {pkg.dependencies
              .filter(d => d.required && !installedNames.has(d.name))
              .map(d => d.name)
              .join(', ')}
          </Text>
        </Box>
      )}
    </Box>
  )}
  ```
  Required deps: `•`, optional deps: `○`. "Also install" line lists only required uninstalled deps.
- **Files:** `src/tui/components/package-detail.jsx`
- **Tier:** standard
- **Done when:** detail panel shows dep list for packages with deps; ✓/not-installed per dep; "also install" line correct; `isInstalled` prop removed.
- **Blockers:** Audit every call site of `<PackageDetail>` before changing the prop signature.

#### Task 2.4: Thread props in `discover.jsx` (and `installed.jsx` if needed)
- **Change:** Two prop-threading changes only — no new state:
  1. Replace `isInstalled={installedNames.has(selectedPkg.name)}` with `installedNames={installedNames}` on `<PackageDetail>`.
  2. Pass `showDeps={true}` down to `<PackageList>` / `<PackageItem>`.
  3. Check `installed.jsx` — if it also renders `<PackageDetail>`, pass `installedNames={installedNames}` (or `new Set()` if it doesn't need dep display).
- **Files:** `src/tui/screens/discover.jsx`, `src/tui/screens/installed.jsx` (if applicable)
- **Tier:** standard
- **Done when:** Discover shows deps; Installed screen compiles without errors.
- **Blockers:** none.

#### VERIFY: Phase 2
- Run full `npm test` — zero failures.
- Manual TUI: open Discover → 800+ packages visible.
- Manual TUI: search `"subagent"` → `subagent-driven-development` shows `★ 6 deps`.
- Manual TUI: search `"senior-engineer"` → shows `· no deps`.
- Manual TUI: open detail for a package with deps → dep list shows ✓/not-installed per dep.
- Manual TUI: "Installing this will also install" shows only uninstalled required deps.
- Commit: `feat(discover): merge community packages into Discover tab`. Push.

---

### Phase 3: Tests

#### Task 3.1: New file `tests/community-index.test.js`
- **Change:** Create comprehensive test file covering:

  ```
  getCachedCommunityIndex:
    - returns null when no cache file
    - returns null when cache is stale (mtime > CACHE_TTL_MS)
    - returns parsed data when cache is fresh

  cacheCommunityIndex + getCachedCommunityIndex:
    - round-trips data correctly

  fetchCommunityIndex:
    - returns cached data without network call (fresh cache)
    - fetches, caches, returns data on miss (mock fetch)
    - throws NETWORK_ERROR on fetch failure
    - throws on non-OK HTTP status

  getStaleCommunityIndexCache:
    - returns data regardless of mtime
    - returns null when no cache file

  normalizeCommunityPackage:
    - depCount equals dependencies.length
    - source is always 'community'
    - path set from directory field
    - version defaults to '?' when null
    - tags defaults to [] when null
    - dependencies defaults to [] when missing
    - rawBaseUrl preserved from input
  ```
- **Files:** `tests/community-index.test.js` (new)
- **Tier:** standard
- **Done when:** all listed tests pass.
- **Blockers:** mirror existing test file patterns (e.g. `tests/registry.test.js` if it exists).

#### Task 3.2: Extend `tests/tui/discover.test.jsx`
- **Change:** Add the following test cases:
  ```
  - usePackages returning community packages renders without error
  - Package with depCount: 3 shows "★ 3 deps" in output
  - Package with depCount: 0 shows "no deps"
  - Detail view: dep list renders with ✓ for installed, 'not installed' for absent
  - "Installing this will also install" shows only uninstalled required deps
  - fetchCommunityIndex throws → official packages still visible (community failure isolated)
  ```
- **Files:** `tests/tui/discover.test.jsx`
- **Tier:** standard
- **Done when:** all listed test cases pass.
- **Blockers:** none.

#### VERIFY: Phase 3
- Run full `npm test` — all existing + new tests green.
- Offline simulation: mock `fetchCommunityIndex` to throw → assert official packages still appear.
- Offline stale cache: community packages still show.
- Offline no cache: official packages show, community absent, no crash.
- Regression: all Sprint 1 fixes still work (non-TTY guard, per-skill subdirs, alt-screen, paste).
- Commit: `test: community-index cache + normaliser + discover integration`. Push.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| `networkFailCount` incremented on community failure — triggers "all vaults failed" screen | HIGH | Community fetch is in a separate `try/catch` from the vault loop. Test: mock `fetchCommunityIndex` to throw → official packages still appear. |
| `PackageDetail` prop change (`isInstalled` → `installedNames`) breaks `installed.jsx` render | HIGH | Audit every `<PackageDetail>` call site before changing the prop. Pass `new Set()` where dep display not needed. |
| 846 packages render performance degrades TUI | MED | Filter applied before render (search filter works because normalizer maps `name`, `description`, `tags`). No new rendering path needed. |
| `depCount` undefined on official packages renders incorrectly | LOW | `undefined > 0` is `false` → renders 'no deps'. Correct. Add explicit test. |
| `normalizeCommunityPackage` field mapping errors (e.g. `pkg.directory` vs `pkg.path`) | MED | Task 1.2 requires reading actual community-index.json shape before implementing; verify against plugvault repo. |

---

## Notes

- 3 commits total, one per phase. No squash — each commit is a logical unit.
- VERIFY tasks are checkpoints — doer stops, PM dispatches reviewer before next phase.
- Sprint 1 fixes (non-TTY guard, per-skill subdirs, alt-screen, paste) must not regress.
- Do NOT bump Ink, Node engines, or `package.json` version.
- Base branch: `main`. Rebase on `origin/main` before PR if main has moved.
- PR title: `feat: show community vault packages in TUI Discover`.
