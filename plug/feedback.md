# PlugVault TUI — Phase 3 Code Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-15T12:35:00+05:30
**Verdict:** APPROVED

> See the recent git history of this file to understand the context of this review.

---

## Review Context

This review covers Phase 3 (Installed & Vaults Screens) of the TUI sprint. The work is in commit `31689e6` on `feat/tui`. Phases 0, 1, and 2 were previously APPROVED — this is a cumulative review covering Phases 0–3, focused on Phase 3 changes (8 files changed, 1171 insertions, 40 deletions).

**Prior review finding addressed:** Phase 2 review (commit `455590c`) had 1 FAIL: progress.json tasks not marked completed. Phase 3 commit fixes this — all tasks 0.1 through 3.2 are now correctly marked `"completed"` with commit SHA notes. PASS.

---

## Phase 0 + Phase 1 + Phase 2 Regression Check: PASS

Phase 0 cleanup intact. Phase 1 TUI foundation intact. Phase 2 Discover screen intact — `app.jsx` was updated as expected to wire InstalledScreen and VaultsScreen (tabs 1 and 2 no longer show "coming soon"). `package-item.jsx` and `package-list.jsx` updated with new props (`mode`, `emptyMessage`) that are backwards-compatible — Discover still works with default values (`mode='discover'`, `emptyMessage='No packages found.'`). All 186 tests pass. CLI `--help` shows all commands correctly.

---

## Task 3.1 — Installed Screen with Update/Remove: PASS

### use-installed.js: PASS

**File:** `src/tui/hooks/use-installed.js` (117 lines)

React hook that loads installed packages from both local and global scopes. Key behaviors verified:

- **Dual scope loading:** `Promise.all([getInstalled(false), getInstalled(true)])` — correctly reads both local (`false`) and global (`true`) installed.json. PASS.
- **Scope label injection:** Each package gets `scope: 'local'` or `scope: 'global'`. Duplicates across scopes are preserved (same name can appear twice with different scope labels). This is correct — a user can have a local and global copy of the same package.
- **Sorting:** Alphabetical by name, then by scope. Consistent ordering.
- **Cancellation guard:** `cancelled` flag prevents state updates after unmount. Properly set in the effect cleanup return. PASS.
- **Background update check:** After initial load, `checkUpdates()` runs asynchronously — iterates packages, calls `findPackage(name, vault)` for each, uses `compareSemver(latestVersion, currentVersion) > 0` to detect updates. Updates state with enriched `hasUpdate` and `latestVersion` fields. Respects the `cancelled` flag. PASS.
- **Reload mechanism:** `tick` state incremented by `reload()` callback, triggers useEffect re-run. Standard pattern. PASS.

**NOTE:** `checkUpdates` performs sequential network requests (one per installed package). For users with many installed packages, this could be slow. Not a blocker — the initial render is immediate, update indicators appear progressively. Acceptable for Phase 3 scope.

### installed.jsx: PASS

**File:** `src/tui/screens/installed.jsx` (362 lines)

State machine with 5 views: `list`, `detail`, `confirm-remove`, `operating`, `result`. Key behaviors verified:

**List view:**
- Renders `PackageList` with `mode="installed"` — line 2 shows file paths, not descriptions. PASS per PLAN.md done criteria.
- `emptyMessage` set to `"No packages installed. Use Discover to find and install packages."` — graceful empty state. PASS.
- Status line shows `{cursor+1}/{total}` and update count when available. PASS.
- Toggle (Space) and cursor (up/down) delegated to PackageList. PASS.

**Update action (`u`):**
- `selectedInList()` helper returns toggled packages (if any toggled) or cursor item. PASS.
- `doUpdate()` sets `ctx.set({ yes: true, json: true })` for structured output, uses `captureOutput` wrapper to prevent Ink corruption, calls `runUpdate(pkg.name, { global: pkg.scope === 'global' })`. Correctly passes scope. PASS.
- JSON parsing of captured output extracts `status`, `from`, `to` for the result display. PASS.
- Context restored to `{ yes: false, json: false }` after completion. PASS.
- `reload()` called after update to refresh the list. Toggled set cleared. PASS.

**Remove action (`r`):**
- Pressing `r` opens `confirm-remove` view with y/n confirmation dialog. PASS — matches PLAN.md "Remove shows confirmation dialog."
- `ConfirmRemove` component lists target packages with scope labels. PASS.
- `doRemove()` uses `captureOutput` + `runRemove(pkg.name, { global: pkg.scope === 'global' })`. PASS.

**Detail view (Enter):**
- Shows full package metadata: name, type badge, scope badge, version, vault, installed date, path. PASS.
- Update indicator shows `v{current} → v{latest}` when available. PASS.
- `[u]` update and `[r]` remove actions from detail view. PASS.
- Esc returns to list. PASS.

**Result view:**
- Displays per-package results: `✓ updated from→to`, `✗ error message`, `- already up to date`. PASS.
- "Any key to continue" returns to list. PASS.

### package-item.jsx Update: PASS

**File:** `src/tui/components/package-item.jsx` (88 lines)

Updated with `mode` prop (`'discover'` default, `'installed'`):

- **Line 2 switching:** `mode === 'installed'` shows `item.path`, `mode === 'discover'` shows `item.description`. PASS — matches PLAN.md "file paths on line 2 (not description)."
- **Scope badge:** Only shown when `mode === 'installed'`: `[local]` or `[global]` in yellow. PASS.
- **Type badge:** `[skill]`, `[command]`, `[agent]` in magenta. Present in both modes. PASS.
- **Update indicator:** When `mode === 'installed'` and `hasUpdate`: `v{current} → v{latest} ⬆` in cyan text. PASS.
- **Path truncation:** Installed mode uses left-truncation with `…` prefix for long paths — correct UX for paths (keep the filename visible). PASS.

### package-list.jsx Update: PASS

**File:** `src/tui/components/package-list.jsx` (188 lines)

Updated with `mode` and `emptyMessage` props:

- `mode` prop passed through to `PackageItem`. Default `'discover'`. PASS.
- `emptyMessage` prop used in the empty state render. Default `'No packages found.'`. PASS.
- Key prop for items updated to include `item.scope` for uniqueness when same package appears in both scopes. PASS.

---

## Task 3.2 — Vaults Screen with Sync and Add Form: PASS

### use-vaults.js: PASS

**File:** `src/tui/hooks/use-vaults.js` (88 lines)

React hook that reads vault configuration and enriches with metadata:

- **Config reading:** Uses `getConfig()` to get vault config, iterates `resolve_order` for ordering. PASS.
- **Package count:** Reads from `getCachedRegistry(name)` — counts `Object.keys(cached.packages || {}).length`. Falls back to `null` when cache unavailable. PASS.
- **GitHub URL construction:** `https://github.com/${v.owner}/${v.repo}`. PASS.
- **Default detection:** `name === defaultVault` where `defaultVault = config.default_vault || 'official'`. PASS.
- **Enriched fields:** name, owner, repo, branch, private, isDefault, githubUrl, packageCount. PASS.
- **Cancellation guard:** Standard pattern. PASS.

**NOTE:** The tui-plan.md wireframe shows "last synced 2 min ago" per vault. The implementation does not include this because the underlying system does not track sync timestamps — there is no `lastSynced` field in the config or cache. This is a wireframe aspiration, not a data model gap. Acceptable omission. NOTE, not FAIL.

### vaults.jsx: PASS

**File:** `src/tui/screens/vaults.jsx` (524 lines)

State machine with 5 views: `list`, `confirm-remove`, `adding`, `syncing`, `result`. Comprehensive vault management screen.

**List view:**
- `VaultList` renders each vault as a 2-line row: line 1 = name, owner/repo, branch, public/private badge, package count; line 2 = GitHub URL. PASS.
- `VaultItem` shows `★` star for default vault, `>` cursor for selected. PASS.
- Empty state: "No vaults configured. Press [a] to add a vault." PASS.
- Status line shows `Vaults {n}/{total}  [a] Add  [r] Remove  [d] Set Default  [s] Sync`. PASS.

**Add vault (a):**
- `AddVaultForm` implements sequential inline prompts: name → url → branch → private. PASS — matches PLAN.md "prompts sequentially."
- Raw key input (no TextInput dependency): printable chars append, backspace deletes, Enter submits step, Esc cancels. PASS.
- Branch defaults to `main` (pre-filled in input buffer). PASS.
- Private prompt `[y/N]` — only `y` sets private. PASS.
- Completed steps shown above current prompt for context. PASS.
- `doAdd()` calls `runVaultAdd(name, url, { private: isPrivate })` via captureOutput. PASS.
- **Security — input validation:** The URL is validated by `runVaultAdd` which calls `new URL(url)` — rejects malformed URLs. Vault name is a plain string passed to config.json (no shell execution). No command injection vector. PASS.

**Remove vault (r):**
- `ConfirmRemoveVault` component checks `vault.name === 'official'`. PASS.
- **Official vault guard (SAFETY REQUIREMENT):** When `isOfficial` is true, the `y` key handler is gated: `if (!isOfficial && (input === 'y' || input === 'Y')) onConfirm()`. The UI shows "Cannot remove the official vault — it is required for plug to function." with only Esc/n available. PASS. Additionally, `runVaultRemove` in vault.js has its own server-side guard: `if (name === 'official' && !options.force) throw new Error(...)`. Defense in depth — both UI and backend block removal. PASS.
- Non-official vaults show standard y/n confirmation. PASS.

**Set default (d):**
- `doSetDefault()` calls `runVaultSetDefault(name)` via captureOutput. Only fires when vault is not already default (`!vault.isDefault`). PASS.
- Result screen shows success or error. Vault list reloads. PASS.

**Sync (s):**
- `doSync()` iterates all vaults in resolve_order, calls `fetchRegistry(v)` for each, shows per-vault progress with live-updating `syncResults` state. PASS — matches PLAN.md "Sync refreshes all vaults with progress."
- Each result shows `✓ name: N packages` or `✗ name: error`. PASS.
- After sync, vault list reloads (to pick up new package counts). PASS.

**Result view:**
- Handles 4 operation types: sync, set-default, remove, add. Each with appropriate success/error display. PASS.
- "Any key to continue" returns to list. PASS.

---

## app.jsx Update: PASS

**File:** `src/tui/app.jsx` (57 lines)

Updated to wire all 3 screens:
- Tab 0: `DiscoverScreen` (Phase 2)
- Tab 1: `InstalledScreen` (Phase 3, new)
- Tab 2: `VaultsScreen` (Phase 3, new)
- All screens receive `onInputCapture` callback for input locking. PASS.
- No more "coming soon" placeholders — all tabs are functional. PASS.

---

## Security Review: PASS

- **No command injection in vault add form:** User-typed vault name and URL are passed to `runVaultAdd` which validates URL with `new URL()` constructor. Name is written to config.json as a plain key — no shell interpolation. PASS.
- **No path traversal in remove action:** `runRemove` uses the package name to look up the installed.json entry and uses the stored path for deletion. The TUI does not construct paths from user input. PASS.
- **Context mutation safety:** `ctx.set({ yes: true, json: true })` is set before operations and restored to `{ yes: false, json: false }` after. In `doUpdate` and `doRemove` (installed.jsx), the per-package try/catch handles individual failures while the ctx reset happens after the loop. In vault.jsx, each operation has its own try/catch with ctx restoration in both paths. PASS.
- **No eval/exec:** No `child_process`, `eval`, `Function()`, or dynamic code execution in any new TUI file. PASS.
- **No secrets exposed:** No tokens or credentials accessed in TUI code. The vault add form does not include a token field — token management is handled separately via CLI `vault set-token`. PASS.

---

## Test Suite: PASS

All 186 tests pass (17 test files, ~1.2s). No regressions from Phase 3 changes. Phase 2's search scoring extraction, install flow, and discover screen all remain functional. TUI-specific tests are scheduled for Phase 4, Task 4.2 — their absence here is expected and correct.

---

## CLI Regression Check: PASS

`node bin/plug.js --help` shows all commands correctly: init, install, remove, list, search, update, vault, tui. No regressions.

---

## progress.json: PASS

**File:** `progress.json`

All tasks from Phase 0 through Phase 3 are marked `"completed"` with descriptive notes and commit SHA references:
- Tasks 0.1, 0.2, 0.V — completed (ad2463c)
- Tasks 1.1, 1.2, 1.3, 1.V — completed (3ffe0e2, 7ce898b)
- Tasks 2.1, 2.2, 2.3, 2.V — completed (912d201, 455590c)
- Tasks 3.1, 3.2 — completed (Phase 3 commit)
- Task 3.V — pending (this review)

**Phase 2 FAIL finding is resolved.** PASS.

---

## CLAUDE.md / .fleet-task.md: PASS

Neither `CLAUDE.md` nor `.fleet-task.md` appears in commit `31689e6` (verified via `git show --stat` and `git show --name-only`). PASS.

---

## Wireframe Fidelity Check

Comparing implementation against tui-plan.md wireframes:

| Wireframe Element | Implementation | Status |
|---|---|---|
| Installed: file path on line 2 (not description) | package-item.jsx `mode='installed'` renders `item.path` | PASS |
| Installed: `[local]`/`[global]` scope badges | package-item.jsx shows `[{scope}]` in yellow | PASS |
| Installed: `[skill]`/`[command]`/`[agent]` type badges | package-item.jsx shows `[{type}]` in magenta | PASS |
| Installed: update-available indicator | `v{current} → v{latest} ⬆` in cyan | PASS |
| Installed: remove confirmation dialog | ConfirmRemove y/n prompt | PASS |
| Installed: uses captureOutput wrapper | doUpdate and doRemove both use captureOutput | PASS |
| Vaults: name/owner/repo/branch on line 1 | VaultItem line 1 shows all fields | PASS |
| Vaults: public/private badge | `[public]`/`[private]` on line 1 | PASS |
| Vaults: ★ default indicator | VaultItem shows `★` for default vault | PASS |
| Vaults: GitHub URL on line 2 | VaultItem line 2 renders githubUrl | PASS |
| Vaults: package count | `{N} pkgs` or `? pkgs` on line 1 | PASS |
| Vaults: "last synced X ago" | NOT IMPLEMENTED | NOTE — data model does not track sync timestamps |
| Vaults: sequential add prompts | AddVaultForm: name → url → branch → private | PASS |
| Vaults: official vault removal blocked | ConfirmRemoveVault + backend guard | PASS |
| Vaults: set default | `d` key calls runVaultSetDefault | PASS |
| Vaults: sync with per-vault progress | doSync iterates vaults, live-updates syncResults | PASS |
| Vaults: empty state | "No vaults configured. Press [a] to add a vault." | PASS |
| Installed: search/filter | NOT IMPLEMENTED | NOTE — see below |

**NOTE on Installed search:** The tui-plan.md wireframe shows a `Search...` box on the Installed tab, and the keyboard controls table lists "Type any char: Live filter search" for both Discover and Installed. However, the PLAN.md Task 3.1 done criteria does not mention search on Installed, and the Installed screen does not include search/filter functionality. This is a gap between the wireframe and the task spec — the task spec takes precedence for this phase. Search on Installed could be added in Phase 4 polish. NOTE, not FAIL.

---

## Summary

**Phase 3 delivers the complete Installed and Vaults screens: dual-scope package listing with update/remove, full vault management with add/remove/sync/set-default, and proper safety guards.**

| Check | Result |
|---|---|
| use-installed.js dual scope loading | PASS |
| use-installed.js background update check | PASS |
| installed.jsx 5-view state machine | PASS |
| installed.jsx update via captureOutput | PASS |
| installed.jsx remove with confirmation | PASS |
| installed.jsx detail view with metadata | PASS |
| package-item.jsx mode prop (path vs description) | PASS |
| package-item.jsx scope + type badges | PASS |
| package-item.jsx update indicator | PASS |
| package-list.jsx mode + emptyMessage props | PASS |
| use-vaults.js config + cache enrichment | PASS |
| vaults.jsx 5-view state machine | PASS |
| vaults.jsx add vault sequential prompts | PASS |
| vaults.jsx official vault removal blocked | PASS |
| vaults.jsx set default | PASS |
| vaults.jsx sync with per-vault progress | PASS |
| vaults.jsx empty state | PASS |
| app.jsx all 3 tabs wired | PASS |
| No command injection in vault add | PASS |
| No path traversal in remove | PASS |
| Context mutation safety | PASS |
| All 186 tests pass | PASS |
| CLI regression check | PASS |
| progress.json tracking (Phase 2 FAIL resolved) | PASS |
| CLAUDE.md / .fleet-task.md not committed | PASS |
| Wireframe: "last synced" | NOTE — no data model support |
| Wireframe: Installed search | NOTE — not in task spec |

**0 FAIL, 0 code failures, 2 NOTEs (non-blocking wireframe gaps — both are data model or scope limitations, not defects).**
