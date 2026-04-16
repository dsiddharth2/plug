# plug — Sprint 3: Dependency Resolution

> Teach the install/remove lifecycle about dependencies: extend tracker.js schema, add DFS resolver, wire resolver into install + TUI plan screen, add dependent check on remove, and add post-install hook notice.

**Base branch:** `main`
**Feature branch:** `sprint/dep-resolution`

---

## Tasks

### Phase 1: Extend Tracker (A1)

#### Task 1.1: Add schema fields + new helpers to tracker.js
- **Change:** In `src/utils/tracker.js`:
  - Persist three new fields in `trackInstall`: `installed_as: metadata.installed_as ?? 'explicit'`, `dependencies: metadata.dependencies ?? []`, `dependents: metadata.dependents ?? []`
  - Normalise on any read path touching `rec.installed_as`: `rec.installed_as ?? 'explicit'`
  - Add four new exported functions:
    - `addDependents(name, newDependents, global)` — **merges** (not overwrites) `newDependents` into `data.installed[name].dependents` (deduplicate); saves. Merge semantics are required: if package X is a dependency of both A and B, `addDependents('X', ['B'], global)` must preserve A in X's dependents list, not erase it.
    - `getInstalledRecord(name, global)` — returns `data.installed[name] ?? null`
    - `prunableOrphans(global)` — returns names where `installed_as === 'dependency' && dependents.length === 0`
    - `removeDependentEdge(fromName, toName, global)` — removes `fromName` from `data.installed[toName].dependents`; saves
- **Files:** `src/utils/tracker.js`
- **Tier:** standard
- **Done when:** `trackInstall` persists new fields; all four helpers exported and functional; `addDependents` uses merge/dedup semantics; backward-compat normalisation in place
- **Blockers:** Read current `src/utils/tracker.js` and `src/utils/tracker.test.js` before modifying — match file-write patterns exactly

#### Task 1.2: Extend tests/tracker.test.js
- **Change:** Add test cases (do NOT create a new file):
  - `trackInstall` with `installed_as: 'dependency'` persists correctly
  - `trackInstall` without `installed_as` defaults to `'explicit'`
  - `addDependents` appends to existing dependents (multi-parent case: install A then install B both depending on X → X.dependents = ['A', 'B'], not just ['B'])
  - `addDependents` deduplicates (calling twice with same name produces no duplicate)
  - `addDependents` mutates only the targeted record (other records unaffected)
  - `prunableOrphans` returns correct subset
  - `removeDependentEdge` removes back-reference correctly
- **Files:** `tests/tracker.test.js`
- **Tier:** standard
- **Done when:** all seven new test cases pass; existing tests unaffected
- **Blockers:** none

#### VERIFY: Phase 1
- Run full `npm test` — zero failures
- Confirm `trackInstall` stores new fields; `prunableOrphans` returns correct results
- Commit: `feat(tracker): extend installed.json with installed_as/dependencies/dependents` — one commit, includes tracker.js + tracker.test.js changes
- Push to `sprint/dep-resolution`

---

### Phase 2: Resolver (A2)

#### Task 2.1: Create src/utils/community-index.js (minimal fetch+cache wrapper)
- **Change:** Create a minimal `src/utils/community-index.js` if it does not already exist from Sprint 2. This is a thin wrapper needed by the resolver. Export:
  - `COMMUNITY_INDEX_URL = 'https://raw.githubusercontent.com/dsiddharth2/plugvault/main/community-index.json'`
  - `fetchCommunityIndex()` — fetch + 1hr cache, mirrors `fetchRegistry` pattern using `getCacheDir()`
  - `getStaleCommunityIndexCache()` — offline fallback
  - Cache key: `community-index.json` in same `getCacheDir()` as vault caches
  - **IMPORTANT:** If Sprint 2 already landed `src/utils/community-index.js`, read it first and only add/adjust what is missing. Do not overwrite Sprint 2 work.
- **Files:** `src/utils/community-index.js`
- **Tier:** standard
- **Done when:** `fetchCommunityIndex` and `getStaleCommunityIndexCache` exported and functional; module imports cleanly
- **Blockers:** Check if file exists from Sprint 2 first (`git show origin/main:src/utils/community-index.js`)

#### Task 2.2: Create src/utils/resolver.js
- **Change:** New file implementing DFS dependency resolver. Public API:
  ```js
  export async function resolve(pkgName, vaultHint = null, options = {})
  // returns Promise<{ toInstall, alreadySatisfied, cycles }>
  ```
  Private helpers:
  - `buildPackageMap()` — fetch official registry.json → Map; fetch community-index.json → add/override; community wins on name conflict; both catch-wrapped (offline-safe)
  - `dfsResolve(name, packageMap, installedSnapshot, toInstall, alreadySatisfied, cycles, visited, inStack)`
  
  Algorithm:
  1. `packageMap = await buildPackageMap()`
  2. `installedSnapshot = await getInstalled(isGlobal)` — load ONCE; pass into DFS — never call per-node
  3. DFS: `inStack` hit → `cycles.push(name)`, return; `visited` hit → return; for each dep where `required !== false`: DFS(dep.name); after deps: check snapshot → alreadySatisfied or toInstall; mark visited
  4. Result is dep-first topological order; last element is always `pkgName`
- **Files:** `src/utils/resolver.js` (new)
- **Tier:** premium
- **Done when:** `resolve` exported; DFS correctly handles direct deps, transitive deps, cycles, optional deps, already-installed; `getInstalled` called once per resolve
- **Blockers:** Read `src/utils/registry.js` and `src/utils/tracker.js` for import patterns before writing

#### Task 2.3: Create tests/resolver.test.js
- **Change:** New test file. Mock: `vi.mock('../src/utils/registry.js')`, `vi.mock('../src/utils/community-index.js')`, `vi.mock('../src/utils/tracker.js')`. Cover:
  - No deps → `toInstall: [pkg]`, `alreadySatisfied: []`, `cycles: []`
  - Single required dep → `toInstall: [dep, pkg]` (dep first)
  - Dep already installed → `alreadySatisfied: [dep]`, `toInstall: [pkg]`
  - Transitive A→B→C → `toInstall: [C, B, A]`
  - Cycle A→B→A → `cycles: ['A']`, `toInstall: [B, A]`
  - Optional dep (`required: false`) NOT added to `toInstall`
  - Unknown package in deps → silently skipped, no crash
  - All deps already installed → `toInstall: [pkg]`, `alreadySatisfied: [all deps]`
  - `getInstalled` called exactly once per `resolve()` invocation (spy on `getInstalled`, assert call count = 1 even for multi-dep graphs)
- **Files:** `tests/resolver.test.js` (new)
- **Tier:** standard
- **Done when:** all 9 test cases pass
- **Blockers:** none

#### VERIFY: Phase 2
- Run full `npm test` — zero failures
- Confirm resolver handles transitive + cycle cases correctly
- Commit: `feat(resolver): add DFS dependency resolver` — includes resolver.js + community-index.js (if new/changed) + resolver.test.js
- Push to `sprint/dep-resolution`

---

### Phase 3: Wire Install + TUI Plan Screen (A3 + A6)

#### Task 3.1: Refactor install.js — extract helper + wire resolver
- **Change:** In `src/commands/install.js`:
  1. Extract `installSinglePackage(pkgSpec, isGlobal)` private helper:
     - If `pkgSpec.rawBaseUrl`: `fetch(rawBaseUrl + entry)` directly
     - Else: use existing `downloadFile(vault, ...)` path
  2. After finding the root package, before downloading:
     - `const plan = await resolve(pkgName, vault.name, { global: isGlobal })`
     - If CLI path and `plan.toInstall.length > 1`: print plan summary; if `!ctx.yes`, prompt "Proceed? (Y/n)"
  3. Loop `plan.toInstall` in order, calling `installSinglePackage(entry, isGlobal)` for each
  4. Track each dep with `installed_as: 'dependency'`; root with `installed_as: 'explicit'`; both include `dependencies: [direct dep names]`
  5. After all installs: call `addDependents(dep.name, [pkgName], isGlobal)` for each dep
  6. Add `vi.mock('../src/utils/resolver.js', () => ({ resolve: vi.fn().mockResolvedValue({ toInstall: [], alreadySatisfied: [], cycles: [] }) }))` at top of `tests/install.test.js`
- **Files:** `src/commands/install.js`, `tests/install.test.js`
- **Tier:** premium
- **Done when:** resolver called on install; deps tracked as `installed_as: 'dependency'`; root as `'explicit'`; `addDependents` called; already-satisfied deps skipped; `installSinglePackage` branches on `rawBaseUrl`
- **Blockers:** Read current install.js fully before modifying — identify where to inject resolver call and where `trackInstall` is called

#### Task 3.2: New TUI component src/tui/components/install-plan.jsx
- **Change:** New Ink component. Props: `{ queue, plan, loading, onConfirm(scope: 'project'|'global'), onCancel }`. Renders:
  - Spinner while `loading`
  - "Will install" section listing `plan.toInstall` with vault + type
  - "Already satisfied" section listing `plan.alreadySatisfied`
  - Scope selector: `◉ Project (.claude/)  ○ Global (~/.claude/)` — Tab toggles
  - Footer: `[i] Install   [Esc] Cancel`
- **Files:** `src/tui/components/install-plan.jsx` (new)
- **Tier:** standard
- **Done when:** component renders correctly in test; Tab toggles scope; `onConfirm` called with correct scope; `onCancel` called on Esc
- **Blockers:** Read existing TUI components for Ink/React patterns before writing

#### Task 3.3: Wire plan view in discover.jsx + tests
- **Change:**
  1. Add `'plan'` state to `DiscoverView` union in `src/tui/screens/discover.jsx`
  2. When `startInstall(queue)` called: run `resolve()` in `useEffect`/`useState`; if `plan.toInstall.length > 1` → set view `'plan'`, render `<InstallPlan>`; on `onConfirm(scope)` → `doInstall(queue, { global: scope === 'global' })`; if single package → `doInstall(queue)` immediately (current behavior preserved)
  3. `ctx.set({ yes: true, json: true })` must only be called inside `doInstall()` after user confirms — NOT during resolver async phase
  4. Extend `tests/tui/discover.test.jsx`: plan view shown after pressing `i` on package with deps; skipped for no-dep package; Tab toggles scope; Esc returns to list
- **Files:** `src/tui/screens/discover.jsx`, `tests/tui/discover.test.jsx`
- **Tier:** standard
- **Done when:** plan view appears for deps, skipped for single package; scope toggle works; Esc cancels; tests pass
- **Blockers:** Read current discover.jsx fully to understand view state machine before adding `'plan'` state

#### VERIFY: Phase 3
- Run full `npm test` — zero failures (includes install + discover test extensions)
- Manual CLI: `plug install subagent-driven-development` → resolver prints plan, deps installed first
- Manual CLI: `plug install senior-engineer` (no deps) → installs immediately, no plan screen
- Manual TUI: package with deps → plan screen + scope toggle; no-dep package → installs immediately
- Commit: `feat(install): wire resolver + TUI scope toggle on dep installs only` — includes install.js + install-plan.jsx + discover.jsx + test updates
- Push to `sprint/dep-resolution`

---

### Phase 4: Wire Remove (A4)

#### Task 4.1: Add dependent check + cascade/force/prune to remove.js
- **Change:** In `src/commands/remove.js` after loading `pkg`:
  1. `const dependents = pkg.dependents ?? []`
  2. If `dependents.length > 0` **and** `!options._cascade`: `select` prompt (Cancel / Remove all cascade / Force remove)
     - `_cascade` definition: boolean flag passed in the options object. When `true`, it means "this call was initiated by a cascade — skip the user prompt and proceed with removal immediately." This is what prevents infinite re-prompting when removing dependents recursively.
     - **Cancel:** return early.
     - **Cascade (shallow):** For each name in `dependents`, call `runRemove(dep, { global, _cascade: true })`. Then remove the original target. Depth: one level only — when `_cascade: true`, the called `runRemove` will skip the prompt for that dependent's own dependents (they are not removed). This is intentional shallow cascade. If deep transitive removal is needed, that is a future enhancement.
     - **Force:** delete target file + `trackRemove(name)` + `removeDependentEdge(name, dep, global)` for each dependent. Does NOT remove the dependent packages — just severs the edge and removes the target.
  3. After any successful remove: call `prunableOrphans(isGlobal)`; if orphans exist and `!ctx.yes`: prompt to prune; if yes: `runRemove` each orphan (without `_cascade`)
- **Files:** `src/commands/remove.js`
- **Tier:** standard
- **Done when:** dependents check fires; `_cascade` flag skips re-prompt correctly; Cancel/Cascade/Force all work per definitions above; orphan prune prompt fires; `--yes` auto-prunes
- **Blockers:** Read current remove.js fully before modifying

#### Task 4.2: Extend tests/remove.test.js
- **Change:** Add test cases:
  - Package with dependents triggers `select` prompt
  - Cancel leaves both packages in place
  - Cascade removes target and all dependents
  - Force removes only target, updates dependent records
  - After remove, orphan prompt fires if orphans exist
  - `--yes` flag auto-prunes orphans without prompting
- **Files:** `tests/remove.test.js`
- **Tier:** standard
- **Done when:** all 6 test cases pass; existing tests unaffected
- **Blockers:** none

#### VERIFY: Phase 4
- Run full `npm test` — zero failures
- Manual CLI: `plug remove` on package with dependents → warning fires; orphan prune prompt shown after
- Commit: `feat(remove): dependent check, cascade/force, orphan pruning`
- Push to `sprint/dep-resolution`

---

### Phase 5: Post-Install Hook Notice (A5)

#### Task 5.1: Create src/utils/frontmatter.js + wire into install.js
- **Change:**
  1. New file `src/utils/frontmatter.js`:
     ```js
     export function parseFrontmatter(content)
     // Regex: match ---\n...\n--- block, split on newlines, parse key: value pairs, handle CRLF
     // Returns Record<string,string> or {} if none/malformed
     ```
  2. In `src/commands/install.js` after writing SKILL.md: call `parseFrontmatter(content)`; if `fm.hook || fm.hooks`:
     - CLI: print `⚠ Hook required: '${name}' expects a hook in settings.json`
     - JSON mode (`ctx.json`): include `hookRequired: true` in output object
- **Files:** `src/utils/frontmatter.js` (new), `src/commands/install.js`
- **Tier:** standard
- **Done when:** `parseFrontmatter` exports correctly; hook notice fires on install for skill with `hook:` frontmatter; no notice for skills without it
- **Blockers:** none

#### Task 5.2: Create tests/frontmatter.test.js
- **Change:** New test file covering:
  - Standard `---\nkey: value\n---` → correct object
  - No frontmatter → `{}`
  - Malformed (no closing `---`) → `{}`
  - CRLF line endings handled
  - `hook:` field parsed correctly
- **Files:** `tests/frontmatter.test.js` (new)
- **Tier:** standard
- **Done when:** all 5 test cases pass
- **Blockers:** none

#### VERIFY: Phase 5
- Run full `npm test` — all existing + new tests green (257+ tests from Sprint 2 + new additions)
- Manual: Install a skill with `hook:` frontmatter → warning printed
- Manual: Install a skill without hook frontmatter → no warning
- Regression: Sprint 1 + Sprint 2 fixes still work; inspect installed.json after multi-dep install — all fields correct
- Commit: `feat(install): post-install hook notice`
- Push to `sprint/dep-resolution`

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| resolver.js calls `isInstalled()` per-node — file read on every dep | HIGH | Load `getInstalled()` once per `resolve()` call, pass snapshot into DFS. Covered by test (Task 2.3): verify exactly 1 `getInstalled` call per resolve invocation |
| `addDependents`/`addDependents` overwrite semantics — multi-parent packages lose dependents | HIGH | Use merge/append semantics in `addDependents` (dedup). Multi-parent test in Task 1.2 covers this. |
| Community package install path: `rawBaseUrl` + `entry` instead of vault owner/repo | HIGH | `installSinglePackage` branches on `pkgSpec.rawBaseUrl` presence. Intentional vault-abstraction bypass for Sprint 3; B3 adapter tightens in future sprint |
| `ctx.set({ yes, json })` called during resolver async phase (plan view) — state pollution | MED | `ctx.set` must only be inside `doInstall()`, called after user confirms. Test: mock resolver to be slow; assert ctx not mutated until confirm |
| install.test.js mock layering — existing mocks + new resolver mock clash | MED | Add `vi.mock('../src/utils/resolver.js', ...)` at top of install.test.js. Per-test override via `resolve.mockResolvedValueOnce(...)` |
| Sprint 2's `community-index.js` shape differs from what resolver expects | MED | Task 2.1 explicitly checks existing file before writing. Read `src/utils/community-index.js` on main before modifying |

---

## Notes

- 5 commits total — one per phase. See requirements.md commit strategy.
- VERIFY tasks are checkpoints — doer stops, PM dispatches reviewer before next phase.
- Base branch: `main`. Create `sprint/dep-resolution` from `origin/main`.
- Sprint 2's `community-index.js` already exists — Task 2.1 must NOT overwrite it.
- Do NOT bump Ink, Node engines, or `package.json` version.
- Regression: Sprint 1 + Sprint 2 fixes (non-TTY guard, per-skill subdirs, alt-screen, paste, community discover) must not regress.
