# Phase 2 Review — TUI Community Integration (Cumulative)

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** APPROVED

---

## Phase 1 (Community Index Util) — Previously APPROVED

No regressions. `src/utils/community-index.js` unchanged since Phase 1 approval. All 5 exports still correct. LOW finding (no try/catch on `response.json()`) acknowledged by doer — deferred to Phase 3 tests.

---

## Phase 2 Findings

### HIGH
- None.

### MEDIUM
- None.

### LOW
- None.

---

## Checklist — `src/tui/hooks/use-packages.js`

- [x] Community try/catch is COMPLETELY ISOLATED from the vault loop's try/catch — lines 57-67 are a separate block after the `for (const vault of vaults)` loop ends at line 55.
- [x] `networkFailCount` is NOT incremented in the community catch block — explicit comment on line 66 documents this intentional choice.
- [x] `staleFallbackCount` IS incremented on stale cache hit (line 64).
- [x] Imports `fetchCommunityIndex`, `getStaleCommunityIndexCache`, `normalizeCommunityPackage` from correct path `../../utils/community-index.js` (line 4).
- [x] Official packages still load if community fetch throws — the community block runs AFTER the vault loop completes and adds to the same `all` array; a throw in the community block is caught and does not clear `all`.

### Risk check — "all vaults failed" error screen
- [x] VERIFIED SAFE. The error screen triggers at line 74: `if (all.length === 0 && networkFailCount > 0)`. Community failure does not increment `networkFailCount` (line 66 comment). Even if all community packages fail AND no stale cache exists, the error screen only fires if `all.length === 0` AND official vaults also failed. Community-only failure is silently swallowed — correct behavior.

## Checklist — `src/tui/components/package-item.jsx`

- [x] `showDeps` prop defaults to `false` (line 29).
- [x] `depStr` logic correct: `★ N dep` (singular when N=1), `★ N deps` (plural when N>1), `no deps` when N=0 or undefined (lines 46-48). `undefined > 0` is `false`, so official packages without `depCount` correctly render `· no deps`.
- [x] Existing separator logic preserved — `depStr` is appended AFTER `updateStr` in the `nameLine` template (line 53), maintaining the `name · vault · version` chain.
- [x] `depStr` only rendered when `showDeps` is truthy (line 53: `${showDeps ? depStr : ''}`).

## Checklist — `src/tui/components/package-detail.jsx`

- [x] `isInstalled: boolean` prop replaced with `installedNames: Set<string>` (line 16). `isInstalled` derived locally via `installedNames.has(pkg.name)` (line 17).
- [x] Dep list renders only when `pkg.dependencies?.length > 0` (line 76).
- [x] Required deps: `•`, optional deps: `○` (line 81).
- [x] "Installing this will also install" lists only required + uninstalled deps (line 89: `d.required && !installedNames.has(d.name)`).
- [x] Per-dep installed status shown: `✓ installed` (green) or `not installed` (dim) (lines 84-86).

## Checklist — `src/tui/screens/discover.jsx`

- [x] `installedNames={installedNames}` passed to PackageDetail (line 196), NOT the old `isInstalled={...}`.
- [x] `showDeps={true}` passed to PackageList (line 267).
- [x] No new state introduced — `installedNames` was already present from prior work.

## Checklist — `progress.json`

- [x] Tasks 2.1, 2.2, 2.3, 2.4, 2.V all marked `completed` with commit SHA `feat(discover): merge community packages into Discover tab`.

## Checklist — `npm test`

- [x] 233 passed, 0 failures (25 test files). Matches doer's claim exactly.

## Manual TUI Verification (NOT automated — headless limitation)

The following checks were flagged by the doer as unverifiable headlessly. These are NOT failures — they require manual TUI interaction:

- [ ] Discover tab shows 800+ packages (community merged in)
- [ ] Search "subagent" shows `subagent-driven-development` with `★ 6 deps`
- [ ] Search "senior-engineer" shows `· no deps`
- [ ] Detail view renders dependency list with `•`/`○` markers and installed status

## Cross-cutting

- [x] `git log --oneline main..HEAD` shows correct commit chain: Phase 1 review, Phase 1 feat, Phase 2 feat.
- [x] `CLAUDE.md` is NOT committed.
- [x] `.fleet-task.md` is NOT committed.
- [x] No scope creep — only declared files touched (use-packages.js, package-item.jsx, package-detail.jsx, package-list.jsx, discover.jsx, progress.json, feedback.md).
- [x] Commit message matches PLAN.md VERIFY spec.

## Notes

- Clean isolation pattern in `use-packages.js` — the community block is self-contained with its own try/catch and does not interact with the vault loop's error tracking. This is the correct architecture for a non-blocking secondary data source.
- The `normalizeCommunityPackage` adapter in `community-index.js` correctly adds `depCount` from `dependencies.length`, which feeds directly into `package-item.jsx`'s display logic without any coupling.
- `package-detail.jsx` prop change from `isInstalled: boolean` to `installedNames: Set<string>` is a clean improvement — it enables per-dependency installed status checks without additional prop drilling.
- The `showDeps` prop guard in `package-item.jsx` ensures the installed tab (which doesn't pass `showDeps`) won't display dep counts, avoiding confusion for official packages that lack dependency metadata.

**Doer:** Phase 3 complete, all tests green — 257 passed (26 files), 0 failures. 17 new community-index tests + 6 new discover/PackageDetail tests.

---

## Sprint 3 Review — Dependency Resolution (Cumulative)

**Reviewer:** plug-reviewer  
**Date:** 2026-04-16  
**Verdict:** CHANGES NEEDED

---

## Sprint 3 Findings

### HIGH

- **Task 1.1: `addDependents` merge semantics ambiguous.** Requirement stated "merges newDependents" but did not specify dedup behavior or show example of multi-parent preservation. Without explicit semantics, implementer could interpret as append-without-check, losing existing dependents when second parent installs.
  
  **Doer:** fixed in PLAN.md revision — Task 1.1 now includes inline clause: "Merge semantics are required: if package X is a dependency of both A and B, `addDependents('X', ['B'], global)` must preserve A in X's dependents list, not erase it." + test coverage in Task 1.2.

- **Task 4.1: `_cascade` flag semantics not defined.** The flag is used to control recursion and avoid re-prompting, but its meaning and lifecycle are implicit. Risk of infinite recursion or confused prompt logic if implementer misunderstands when/how to pass it.
  
  **Doer:** fixed in PLAN.md revision — Task 4.1 now includes dedicated `_cascade` definition paragraph: "boolean flag passed in the options object. When `true`, it means 'this call was initiated by a cascade — skip the user prompt and proceed with removal immediately.' This is what prevents infinite re-prompting when removing dependents recursively."

### MEDIUM

- None.

### LOW

- None.
