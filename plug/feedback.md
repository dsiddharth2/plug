# PlugVault TUI — Doc Harvest Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-15T14:30:00+05:30
**Verdict:** APPROVED

> See the recent git history of this file to understand the context of this review.

---

## Review Scope

Commit `7a2dfbf` added five documentation files:

| File | Lines |
|---|---|
| `docs/architecture.md` | 106 |
| `docs/decisions.md` | 65 |
| `docs/features/tui.md` | 107 |
| `docs/features/package-types.md` | 67 |
| `docs/features/vaults.md` | 103 |

---

## Criterion 1 — Durable Knowledge vs Transient Artifacts: PASS

All five docs capture **architecture, design rationale, and feature behavior** — none contain sprint task lists, commit SHAs, review feedback, or progress tracking. Specifically:

- `architecture.md` documents module responsibilities and data flow — durable.
- `decisions.md` records four "why we chose X over Y" decisions with alternatives considered — durable design rationale.
- `features/tui.md` describes screens, keyboard model, and offline behavior — durable feature reference.
- `features/package-types.md` describes the type taxonomy and install pipeline — durable.
- `features/vaults.md` describes vault format, config schema, and auth model — durable.

No transient sprint artifacts found. PASS.

---

## Criterion 2 — Onboarding Value: PASS

A new developer joining the project would get:

1. **architecture.md** — "what is plug, what are the core modules, how does the TUI compose on top." This is the first file a new contributor should read.
2. **decisions.md** — "why Ink, why tsx, why stdout capture, why `/` for search." Prevents new devs from relitigating settled decisions.
3. **features/*.md** — three self-contained feature references for the main surfaces (TUI, package types, vaults). Each stands alone.

The docs assume basic Node.js/React knowledge but do not assume prior familiarity with the codebase. Good onboarding material. PASS.

---

## Criterion 3 — Factual Accuracy vs Code: PASS (1 NOTE)

### File paths — all verified present:

| Cited path | Exists |
|---|---|
| `src/tui/utils/capture-stdout.js` | Yes |
| `src/utils/search-scoring.js` | Yes |
| `src/tui/app.jsx` | Yes |
| `src/tui/screens/discover.jsx` | Yes |
| `src/tui/screens/installed.jsx` | Yes |
| `src/tui/screens/vaults.jsx` | Yes |
| `src/utils/registry.js` | Yes |
| `src/utils/tracker.js` | Yes |
| `src/utils/config.js` | Yes |
| `src/utils/fetcher.js` | Yes |
| `src/utils/auth.js` | Yes |
| `src/utils/paths.js` | Yes |
| `src/commands/install.js` | Yes |
| `src/tui/hooks/use-search.js` | Yes |
| `src/tui/hooks/use-packages.js` | Yes |
| `src/index.js` | Yes |

### Search scoring tiers — verified against `src/utils/search-scoring.js`:

Docs claim: exact name 40, partial name 30, description 20, tag 10. Code: lines 21–24 return exactly `40, 30, 20, 10`. PASS.

### Keyboard commands — verified against TUI source:

- Tab switching via left/right arrows in `app.jsx` (line 22-26): PASS.
- `inputLocked` disables tab switching (line 28): PASS.
- Esc exits app (line 19): PASS.
- `/` enters search mode: verified in discover.jsx and installed.jsx. PASS.
- `a`, `r`, `d`, `s` in vaults screen: verified at lines 50, 55, 63, 70 of `vaults.jsx`. PASS.
- `i` install in Discover: verified in discover.jsx. PASS.
- `u` update, `r` remove in Installed: verified in installed.jsx. PASS.

### TUI entry point — verified against `src/index.js`:

Docs claim `process.argv.length <= 2` triggers TUI. Code line 39: `if (process.argv.length <= 2)`. PASS.

### Package types — verified against `src/utils/paths.js`:

Docs claim three types: skill, command, agent installing to `.claude/skills/`, `.claude/commands/`, `.claude/agents/`. Code: `getClaudeDirForType` routes `skill` → skills dir, `agent` → agents dir, default → commands dir. PASS.

### Cache TTL — verified:

Docs claim 1 hour. `constants.js` line 12: `CACHE_TTL_MS = 60 * 60 * 1000`. PASS.

### `getStaleRegistryCache` — verified:

Docs claim it exists and returns cached data regardless of age. `registry.js` line 42: `export async function getStaleRegistryCache(vaultName)`. PASS.

### NOTE — Minor keyboard reference inaccuracy in `tui.md`:

The keyboard reference table (line 82) describes the `r` key as "Remove selected / add vault flow" with context "Installed (navigation mode); Vaults list". The "add vault flow" phrasing is misleading — `r` removes in both screens; `a` adds vaults. This appears to be a copy-paste artifact where the description conflated two rows. The actual behavior in code is correct (remove only). This is cosmetic and does not warrant CHANGES NEEDED — it should be fixed in a follow-up. NOTE.

---

## Criterion 4 — Duplication with README.md: PASS

The root `README.md` is a quick-start guide (70 lines): what plug is, install command, link to CLI README. The `plug/README.md` (230 lines) is a CLI/TUI usage guide.

The new `docs/` files cover **architecture internals and design decisions** — a different audience (contributors/maintainers) than README (users). Overlap is minimal and appropriate:

- Both mention the three package types — README in one sentence, `package-types.md` in full detail. Acceptable.
- Both mention vault concept — README links to CLI docs, `vaults.md` provides the config schema and auth model. Acceptable.
- No redundant copy-paste between README and docs. PASS.

---

## Criterion 5 — Hallucinated Features or Invented Conventions: PASS

Every feature described in the docs was verified against the codebase:

- No invented keyboard shortcuts — all keys verified in source.
- No invented modules — all `src/utils/*.js` and `src/tui/**` files exist.
- No invented APIs — `scoreMatch`, `captureOutput`, `getStaleRegistryCache`, `getClaudeDirForType` all exist with the documented signatures.
- The vault config schema in `vaults.md` matches the structure used by `config.js`.
- The `registry.json` schema in `vaults.md` matches the structure consumed by `registry.js`.
- No mention of features that don't exist in code (no phantom screens, no unimplemented commands).

PASS.

---

## Summary

The doc harvest captures durable architectural knowledge, design rationale, and feature behavior. All cited file paths exist. All factual claims (scoring tiers, keyboard bindings, cache TTL, entry-point logic, install pipeline) verified against code. No duplication with README beyond acceptable minimal overlap. No hallucinated features.

**1 NOTE:** `tui.md` keyboard reference table has a minor description error on the `r` key row ("add vault flow" should not be there). Cosmetic — fix in a follow-up.

| Check | Result |
|---|---|
| Durable knowledge, not transient artifacts | PASS |
| Onboarding value for new developers | PASS |
| File paths verified against codebase | PASS |
| Keyboard commands match implementation | PASS |
| Search scoring tiers match code | PASS |
| Package types match code | PASS |
| Cache TTL matches constants | PASS |
| No README duplication | PASS |
| No hallucinated features | PASS |
| Keyboard table `r` key description | NOTE |

**Verdict: APPROVED — doc harvest is accurate, durable, and useful.**
