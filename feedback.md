# Sprint 2: Community Discover — Phase 3 Review (Cumulative)

**Reviewer:** plug-reviewer
**Date:** 2026-04-16
**Verdict:** APPROVED

---

## Phase 3: Tests (c2f22d9)

### tests/community-index.test.js — 18 tests

**PASS.** Comprehensive coverage of all 5 exported functions.

- `getCachedCommunityIndex`: null on missing, null on stale (mtime > CACHE_TTL_MS + 60s), parsed data on fresh cache. All 3 assertions correct.
- `cacheCommunityIndex` round-trip: write then read back. Correct.
- `fetchCommunityIndex`: cache hit without network call (elegant — unmocked `global.fetch` would throw if called), cache miss with mock fetch + verify subsequent call uses cache, ENOTFOUND maps to `NETWORK_ERROR` code, non-OK HTTP throws `HTTP 500`. All 4 cases solid.
- `getStaleCommunityIndexCache`: returns data regardless of mtime, null on missing. Both correct — validates that stale cache ignores TTL.
- `normalizeCommunityPackage`: 8 tests covering depCount=dependencies.length, source='community', path from directory (not pkg.path), version defaults to '?' for both null and undefined, tags defaults to [], dependencies defaults to [] with depCount=0, rawBaseUrl preserved. All field-mapping rules from the plan verified.

**Test isolation:** Each test uses a unique `tmpDir` (Date.now() suffix), `beforeEach` creates the cache dir, `afterEach` removes the entire tmpDir and restores mocks. No shared state leaks. `global.fetch` is only set in tests that need it and restored via `vi.restoreAllMocks()`.

**Mock pattern:** `vi.mock('../src/utils/paths.js')` redirects `getCacheDir()` to tmpDir — consistent with the codebase pattern of mocking infrastructure paths rather than business logic. Clean.

### tests/tui/discover.test.jsx — 6 new tests (8 total)

**PASS.** All 6 new cases target the community integration surface.

1. **Community packages render without error** — mocks `usePackages` with `MOCK_COMMUNITY_PACKAGES`, asserts both `agent-fleet` and `simple-tool` visible in frame. Correct.
2. **depCount: 3 shows "★ 3 deps"** — single community package with depCount 3, asserts exact string `★ 3 deps`. Correct.
3. **depCount: 0 shows "no deps"** — single community package with depCount 0, asserts `no deps`. Correct.
4. **Community failure isolation** — `usePackages` returns only `MOCK_PACKAGES` (official), simulating the state after community catch block swallows the error. Asserts `code-review` and `test-gen` still visible. This is a UI-layer test that validates rendering given the post-failure state; the actual catch-block logic is validated in `community-index.test.js` and confirmed by reading `use-packages.js:57-67`. Acceptable approach.
5. **Detail view dep list** — `PackageDetail` rendered with `installedNames = new Set(['dep-one'])`. Asserts `dep-one` + `✓ installed` visible, `dep-two` + `not installed` visible. Correct.
6. **"Installing this will also install"** — Asserts the notice line contains `dep-two` (required, not installed), excludes `dep-one` (required but already installed), and excludes `dep-three` (optional). This is the most precise test in the suite — it finds the specific line and asserts inclusion AND exclusion. Correct.

### Key risk: community failure isolation

**CONFIRMED SAFE.** The test at line 155-168 validates that when `usePackages` returns only official packages (the state after community failure), the UI renders them correctly. The catch block in `use-packages.js:60-67` is the mechanism that produces this state — it swallows the error, falls back to stale cache if available, and critically does NOT increment `networkFailCount`. The combination of:
- Unit test: `fetchCommunityIndex` throws NETWORK_ERROR (community-index.test.js:118-123)
- Integration: `use-packages.js:60-67` catch block is non-blocking
- UI test: official packages render when only official packages are in state

...provides end-to-end confidence in the failure isolation path.

### npm test

**257 passed, 0 failures.** 26 test files. Matches expected count (233 original + 18 community-index + 6 new discover = 257).

### Regression check

**PASS.** All Phase 1 + Phase 2 symbols confirmed wired in source:
- `normalizeCommunityPackage`: exported from `community-index.js:86`, imported in `use-packages.js:4`, called at lines 59 and 63
- `fetchCommunityIndex`: exported from `community-index.js:56`, imported in `use-packages.js:4`, called at line 58
- `showDeps`: prop in `package-item.jsx:29`, threaded via `package-list.jsx:32,113`, enabled in `discover.jsx:267`
- `installedNames`: state in `discover.jsx:36`, passed to `PackageDetail` at line 196 and `PackageList` at line 266; received in `package-detail.jsx:16`, used at lines 17, 84, 89, 94

No accidental reverts detected. All integration points intact.

### Sprint completion readiness

**PASS.** All 11 tasks in `progress.json` show `status: "completed"`:
- Phase 1: 1.1, 1.2, 1.V (community-index util)
- Phase 2: 2.1, 2.2, 2.3, 2.4, 2.V (TUI community integration)
- Phase 3: 3.1, 3.2, 3.V (tests)

Branch is clean — only untracked files (`PLAN.md`, `progress.json`, `requirements.md`, `roadmap/`) which are sprint harness artifacts, not source changes.

---

## HIGH

None.

## MEDIUM

None.

## LOW

1. **Test count discrepancy in task notes** — `progress.json` task 3.1 says "17 tests" but `community-index.test.js` contains 18 tests (the `normalizeCommunityPackage` suite has 8 tests, not 7 — `version defaults to "?" when null` and `version defaults to "?" when undefined` are counted separately). This is a cosmetic issue in tracking only; all tests pass. No action needed.

2. **Community isolation test is indirect** — The discover.test.jsx failure isolation test (line 155) mocks `usePackages` directly rather than testing the actual throw-and-catch path end-to-end. This is a defensible design choice (UI tests mock the data layer, unit tests verify the data layer), but a single integration test that triggers `fetchCommunityIndex` to throw and verifies the full hook-to-render path would strengthen confidence further. Non-blocking — the current layered approach provides adequate coverage.

## Notes

- Clean test isolation throughout — tmpDir per run, mock cleanup in afterEach, no cross-test contamination.
- The `global.fetch` cache-hit test (line 93-98) is elegant: it relies on the fact that `global.fetch` is NOT mocked, so if the code tried to fetch it would throw. The test passing proves the cache was served.
- The "also install" test (line 192-215) is the most thorough assertion in the suite — it validates both inclusion and exclusion semantics on the exact line, covering required/optional and installed/not-installed dimensions.
- Sprint is complete: 3 phases, 5 commits (3 feature + 2 prior reviews), 257 tests passing, all 11 tasks done.
