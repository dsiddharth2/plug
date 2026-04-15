# version-from-package-json — Code Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-15 15:35:00+05:30
**Verdict:** APPROVED

---

## Functional verification

- **`npm test` passes:** PASS — 22 test files, 209 tests, all green (vitest 3.2.4).
- **`node bin/plug.js --version` prints `1.1.0`:** PASS — output is exactly `1.1.0`.
- **`grep -rn "1\.0\.0" src/` returns zero hits:** PASS — exit code 1 (no matches).
- **`src/utils/pkg-version.js` exists and exports `pkgVersion`:** PASS — uses `readFileSync` + `fileURLToPath` pattern, no `import ... with { type: 'json' }`, no `process.cwd()`.
- **`src/index.js` imports `pkgVersion` and passes it to `.version(...)`:** PASS.
- **`src/commands/install.js` no longer contains `'1.0.0'` literal:** PASS — fallback is now `pkgVersion`.

## Code quality

- **Path resolution in `pkg-version.js`:** PASS — resolves `resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json')`, correctly navigating from `src/utils/` to the repo root.
- **Sync module-load-time read:** PASS — `readFileSync` at top level, no async introduced.
- **No new literal version strings in `src/`:** PASS — confirmed via grep.
- **No unrelated changes:** PASS — commit touches exactly the three target files (`src/utils/pkg-version.js`, `src/index.js`, `src/commands/install.js`). No drive-by refactors or cosmetic churn.

## Scope / regressions

- Changes are limited to the three files specified in requirements.md deliverables. No other files modified.
- `package.json` version remains `1.1.0` (not changed by this commit).
- `engines.node` remains `>=18` (unchanged).
- No risk of regression — the `readFileSync` at module-load time is deterministic and consistent with the existing synchronous startup path.

---

## Summary

Clean, minimal fix. The hardcoded `'1.0.0'` version literals in `src/index.js` and `src/commands/install.js` are replaced by a shared `pkgVersion` constant read from `package.json` at module load time. The helper module (`src/utils/pkg-version.js`) correctly resolves the path relative to its own location using `import.meta.url`, stays synchronous, and avoids the Node 20.10+ import-attributes syntax. All 209 tests pass. No scope creep. APPROVED.
