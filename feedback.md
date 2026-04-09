# PlugVault CLI — Phase 2 Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-09
**Phase:** 2 — Core Utilities (cumulative: Phases 1-2)
**Verdict:** APPROVED

---

## Test Infrastructure (Task 2.0) — PASS

- vitest configured in devDependencies (`^3.1.1`) ✓
- `"test": "vitest run"` script in package.json ✓
- `npm test` runs and exits 0 — **51 tests pass across 7 test files** ✓
- Smoke test present (`tests/smoke.test.js`) ✓

## Constants & Paths (Task 2.1) — PASS

- All constants centralized in `src/constants.js` — vault names, GitHub URLs, cache TTL, dir names ✓
- `CACHE_TTL_MS = 3_600_000` (1 hour) ✓
- `OFFICIAL_VAULT` object with name/owner/repo/branch/private ✓
- `src/utils/paths.js` uses `path.join()` and `os.homedir()` everywhere — no hardcoded slashes ✓
- Both local (cwd-based) and global (homedir-based) scope supported for skills, commands, and installed paths ✓
- `ensureDir()` uses `fs.mkdir({ recursive: true })` ✓
- 11 unit tests covering all path functions plus ensureDir (create + idempotent) ✓

## Config & Auth (Task 2.2) — PASS

- `getConfig()` auto-seeds official vault on first run (ENOENT → write defaults) ✓
- Corrupt config.json backed up to `.bak` and regenerated ✓
- `structuredClone(DEFAULT_CONFIG)` used to avoid mutation — good practice ✓
- `saveConfig()` calls `ensureDir()` before writing ✓
- `getVault()`, `getDefaultVault()`, `getResolveOrder()` all correctly delegate to `getConfig()` ✓
- Auth resolution chain: `PLUGVAULT_TOKEN_{NAME}` → `PLUGVAULT_GITHUB_TOKEN` → `config.vaults[name].token` ✓
- Vault name sanitized for env var lookup (uppercase, hyphens→underscores) ✓
- `getAuthHeaders()` returns `{ Authorization: 'Bearer <token>' }` or `{}` ✓
- 8 config tests + 6 auth tests — all pass ✓
- Tests mock `paths.js` to use temp dirs (no real `~/.plugvault` touched) ✓

## Registry & Fetcher (Task 2.3) — PASS

- `fetchRegistry()` uses **native `fetch`** — no `node-fetch` import ✓
- Cache implemented: `cacheRegistry()` writes to `~/.plugvault/cache/{name}.json`, `getCachedRegistry()` checks `stat.mtimeMs` against `CACHE_TTL_MS` ✓
- Stale cache (>1hr) returns null, triggering re-fetch ✓
- `findPackage()` iterates `getResolveOrder()` vaults, returns `{ pkg, vault }` or `null` ✓
- `findPackage()` silently skips unavailable vaults (catch in loop) ✓
- `downloadFile()` constructs correct GitHub raw URL: `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` ✓
- Auth headers forwarded to both registry and file fetches ✓
- Error classification: 401/403 → `AUTH_FAILED`, 404 → `NOT_FOUND`, ENOTFOUND/ECONNREFUSED → `NETWORK_ERROR` ✓
- 10 registry tests + 6 fetcher tests — all mock `global.fetch`, no real HTTP calls ✓

## Tracker (Task 2.4) — PASS

- `getInstalled()` reads `.plugvault/installed.json`, returns `{ installed: {} }` on ENOENT ✓
- Corrupt `installed.json` backed up to `.bak` and reset to empty ✓
- `trackInstall()` merges metadata with `installedAt` timestamp ✓
- `trackRemove()` deletes key from installed map, no-throw on non-existent ✓
- `isInstalled()` uses `Object.prototype.hasOwnProperty.call()` — safe against prototype pollution ✓
- Local vs global scope: separate files, tested independently ✓
- `saveInstalled()` calls `ensureDir(path.dirname(...))` before writing ✓
- 9 tests including corrupt-file recovery and scope isolation ✓

## Cross-cutting — PASS

- **ESM throughout:** All files use `import`/`export`, no `require()` found ✓
- **No hardcoded paths:** All paths constructed via `path.join()` ✓
- **Error handling:** Network errors, auth failures, 404s, corrupt JSON all handled with descriptive error codes and messages ✓
- **Loose coupling:** No circular dependencies — `paths` ← `config` ← `auth` ← `registry`/`fetcher`; `paths` ← `tracker`. Clean dependency tree ✓
- **Test isolation:** All tests mock the filesystem via `paths.js` overrides; network calls mocked via `global.fetch`. No real HTTP or home-dir mutations ✓

## Phase 1 Regression Check — PASS

- `node plug/bin/plug.js --help` still shows all 7 subcommands ✓
- `plugvault/registry.json` unchanged and valid ✓
- Package.json bin entry, ESM config, engines all intact ✓

## progress.json — PASS

- Tasks 2.0–2.4 and 2.V all marked `"completed"` with accurate notes ✓
- Phase 1 tasks remain correctly completed ✓

---

## Summary

**All checks passed — 0 issues found.** Phase 2 delivers a clean, well-tested utility layer:

- 6 utility modules with clear separation of concerns
- 51 tests with 100% mock isolation (no real I/O in tests)
- Correct Windows path handling via `path.join` throughout
- Proper error classification with structured error codes
- Cache TTL, auth resolution chain, and corrupt-file recovery all implemented per spec

Phase 2 is approved. Ready to proceed with Phase 3 (Core Commands).
