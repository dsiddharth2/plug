# Sprint 2 — Community Discover Requirements

## Background

Sprint 1 (merged, PR #12) landed `community-index.json` in the plugvault repo — 846 packages across 3 vaults:
- `superpowers`: 18 packages
- `everything-claude-code`: 561 packages
- `claude-skills`: 267 packages
- 56 packages have curated `dependencies[]` data

The plug TUI Discover tab currently only shows ~14 official vault packages via `registry.json`. Community packages are completely invisible.

## Problem

Users cannot discover or browse the 846 community vault packages from the TUI. The community-index.json exists in plugvault but is not wired to the TUI.

## Goal

Wire the TUI Discover tab to read `community-index.json` so all 846 packages appear alongside official ones, with dep counts and vault badges. Community fetch failures must be non-blocking — official packages still show if community-index fetch fails.

## Why Now (B3 before Phase A)

The dependency resolver (Phase A) is most valuable for community packages — they're the ones with `dependencies[]`. Without Discover showing community packages, users can't see or install them. Discovery (B3) must come first.

## Success Criteria

1. Discover tab shows 800+ packages (currently ~14)
2. Each package shows dep count (`★ N deps` or `no deps`)
3. Package detail shows full dep list with installed/not-installed status per dep
4. Community fetch failure: official packages still show, no crash
5. Offline + stale cache: community packages show (stale fallback)
6. Offline + no cache: official packages show, community absent, no crash
7. All existing tests pass + new tests green (`npm test`)

## Scope

### In Scope
- `src/utils/community-index.js` — new fetch/cache util mirroring `registry.js` pattern
- `src/constants.js` — add `COMMUNITY_INDEX_URL`
- `src/tui/hooks/use-packages.js` — merge community packages after vault loop
- `src/tui/components/package-item.jsx` — add dep count line (`showDeps` prop)
- `src/tui/components/package-detail.jsx` — dep list, change `isInstalled: boolean` → `installedNames: Set<string>`
- `src/tui/screens/discover.jsx` — prop threading only
- `tests/community-index.test.js` — new test file
- `tests/tui/discover.test.jsx` — add community + dep display cases

### Out of Scope (Sprint 3)
- Resolver DFS walk (`src/utils/resolver.js`)
- `tracker.js` schema extension (`installed_as`, `dependents`)
- TUI install plan screen with scope toggle
- `remove.js` dependent check + orphan pruning
- Post-install hook notice (`src/utils/frontmatter.js`)

## Branch & Issue

- **Branch:** `sprint/community-discover`
- **Base:** `main` (currently `ea89a51`)
- **GitHub Issue to create:** `feat: show community vault packages in TUI Discover`

## Dependencies

- Sprint 1 (community-index.json in plugvault) ✅ merged
- `src/utils/registry.js` — the exact pattern to mirror for community-index.js

## Cross-Cutting Constraints

- `npm test` must be green at every VERIFY checkpoint
- Existing sprint sprint fixes (non-TTY guard, per-skill subdirs, alt-screen, paste) must not regress
- Do NOT bump Ink, Node engines, or `package.json` version
