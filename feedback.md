# PlugVault CLI — Phase 3 Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-09
**Phase:** 3 — Core Commands (cumulative: Phases 1-3)
**Verdict:** APPROVED

---

## Test Results

- **81 tests pass across 11 test files** — up from 51 in Phase 2 ✓
- All Phase 2 tests still pass (no regressions) ✓
- Phase 3 adds 30 new tests: init (3), install (11), remove (5), list (7), registry (4 new)

## `plug init` (Task 3.1) — PASS

- Creates `.claude/skills/`, `.claude/commands/`, `.plugvault/installed.json` ✓
- Skips gracefully if directories already exist (no overwrite of existing `installed.json`) ✓
- Handles partial existence (e.g., skills exists but commands doesn't) ✓
- Prints green confirmation for created, yellow for skipped — clean UX ✓
- Error handler wraps action with `process.exit(1)` ✓

## `plug install` — Basic (Task 3.2a) — PASS

- Parses package name correctly ✓
- Uses `findAllPackages()` to search across resolve_order ✓
- Fetches `meta.json` for type/entry/version, falls back to registry data on failure ✓
- Routes correctly: `skill` → `.claude/skills/`, `command` → `.claude/commands/` ✓
- Tracks install in `installed.json` via `trackInstall()` with type, vault, version, path ✓
- Prints result with path and usage hint (`/name` for commands, description for skills) ✓
- Error: "Package 'X' not found in any vault." when not found ✓

## `plug install` — Advanced (Task 3.2b) — PASS

- Vault prefix parsing (`vault/name`) via `indexOf('/')` — calls `findPackage(name, vault)` directly ✓
- Conflict handling: `findAllPackages()` returns multiple → `@inquirer/prompts select()` ✓
- `-g` global flag: routes to global paths, passes `isGlobal=true` to tracker ✓
- Overwrite prompt: checks `isInstalled()` → `confirm()` prompt, aborts on decline ✓
- Auto-init: checks `skillsDir` existence, creates both dirs if missing ✓
- EACCES/EPERM handling in action wrapper ✓

## `plug remove` (Task 3.3) — PASS

- Reads `installed.json`, finds package by name ✓
- Deletes `.md` file via `fs.unlink()` ✓
- Updates tracker via `trackRemove()` ✓
- "Not installed" → prints yellow warning, returns (no error, exit 0) ✓
- ENOENT on file delete → still removes from tracker (file already gone) ✓
- EACCES/EPERM → rethrows with descriptive message ✓
- `-g` flag supported ✓
- Scope isolation: local remove doesn't touch global `installed.json` (tested) ✓

## `plug list` (Task 3.4) — PASS

- Shows both local + global installed packages with scope column ✓
- `--remote` flag: fetches all registries via `fetchRegistry()`, lists all packages ✓
- `--vault` filter: narrows by vault name ✓
- `--type` filter: narrows by skill/command ✓
- Table formatting: dynamic column widths, header + separator + rows, cyan header ✓
- Graceful warning when no vaults configured or no packages available ✓
- Remote errors per-vault: warns and continues (doesn't abort on one failed vault) ✓

## Registry Fix — PASS

- `findPackage()` uses `packages[name]` object lookup (not array `.find()`) ✓
- `findAllPackages()` added for multi-vault conflict detection ✓
- Both functions iterate `getResolveOrder()`, skip unavailable vaults ✓
- 4 new registry tests: `findAllPackages` returns all matching vaults, returns empty for not-found ✓
- `findPackage` tests: specific vault filtering, non-existent vault returns null ✓

## Cross-cutting — PASS

- **ESM throughout:** All new files use `import`/`export` ✓
- **No circular dependencies:** Commands import from utils only; no command-to-command imports ✓
- **Test isolation:** All tests mock `paths.js`, `registry.js`, `fetcher.js`, `tracker.js`, and `@inquirer/prompts` — no real I/O ✓
- **Error messages:** User-friendly, no stack traces exposed ✓
- **Full cycle:** init → install → list → remove all wired and tested ✓

## Phase 1-2 Regression Check — PASS

- `smoke.test.js`, `paths.test.js`, `auth.test.js`, `config.test.js`, `fetcher.test.js`, `tracker.test.js` all still pass ✓
- Package.json, bin entry, ESM config unchanged ✓
- Registry structure intact ✓

## progress.json — PASS

- Tasks 3.1, 3.2a, 3.2b, 3.3, 3.4, 3.V all marked `"completed"` with accurate notes ✓
- Phase 1-2 tasks remain correctly completed ✓
- Phase 4+ tasks remain `"pending"` ✓

---

## Summary

**All checks passed — 0 issues found.** Phase 3 delivers four fully functional commands:

- **init**: Creates project scaffolding with idempotent skip behavior
- **install**: Full resolve chain with vault prefix, conflict prompting, global flag, overwrite prompt, auto-init, and meta.json fallback
- **remove**: Clean deletion with tracker update, ENOENT tolerance, and scope isolation
- **list**: Local + global display with remote registry browsing and vault/type filters

Test coverage is thorough: 30 new tests covering happy paths, error cases, edge cases (ENOENT, conflicts, declined overwrites), and scope isolation. The object-based registry schema is correctly used throughout.

Phase 3 is approved. Ready to proceed with Phase 4 (Vault Management).
