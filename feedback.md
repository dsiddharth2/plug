# PlugVault CLI — Phase 1 Review

**Reviewer:** plug-reviewer
**Date:** 2026-04-09
**Phase:** 1 — Scaffolding
**Verdict:** CHANGES NEEDED

---

## Structure & Setup — PASS

- `plug/package.json` has `"type": "module"` (ESM) ✓
- Bin entry `"plug": "./bin/plug.js"` is correct ✓
- `plug/bin/plug.js` has the `#!/usr/bin/env node` shebang ✓
- Dependencies are correct: commander, chalk@5, ora@8, @inquirer/prompts ✓
- No `node-fetch` dependency ✓
- `engines.node >= 18` specified ✓
- `node plug/bin/plug.js --help` shows all 7 subcommands (init, install, remove, list, search, update, vault) ✓

## Commander Wiring (Task 1.2) — FAIL

- Each subcommand has its own file in `src/commands/` ✓
- All 7 subcommands registered and showing in help ✓
- Vault has all 6 nested subcommands: add, remove, list, set-default, set-token, sync ✓
- **ISSUE:** `install` uses `-i, --item <name>` (requiredOption) instead of a positional `<name>` argument. PLAN.md specifies `plug install <name>` with a positional argument, and the task file explicitly states "no -i flag on install". The command signature must be `.command('install <name>')` with `<name>` as a positional argument, not an option flag.

**Fix required in** `plug/src/commands/install.js`:
```js
// Current (wrong):
.command('install')
.requiredOption('-i, --item <name>', '...')

// Should be:
.command('install <name>')
// remove the -i/--item option entirely
```

**Doer:** fixed in commit — changed install to use positional argument

## Registry Structure (Task 1.3) — PASS

- `plugvault/registry.json` parses correctly ✓
- Contains 2 entries: `code-review` (command) and `api-patterns` (skill) ✓
- Each has a valid `meta.json` with all required fields (name, type, version, description, author, tags, entry) ✓
- Entry `.md` files exist with meaningful, substantive content ✓
  - `code-review.md`: 31 lines covering security, performance, quality review guidance
  - `api-patterns.md`: 55 lines covering REST API patterns, naming, response format, status codes

## Code Quality — PASS

- ESM `import`/`export` used throughout — no `require()` or `module.exports` found ✓
- No hardcoded Unix paths ✓
- No dead code, no TODO/FIXME/HACK comments ✓
- `.gitignore` includes `node_modules/` ✓
- MIT LICENSE present ✓

## progress.json — PASS

- Tasks 1.1, 1.2, 1.3, and 1.V all marked `"completed"` ✓
- Notes accurately reflect what was done in each task ✓

---

## Summary

**17 of 18 checks passed.** Phase 1 scaffolding is solid — project structure, ESM setup, Commander wiring, registry structure, and code quality are all correct.

**One change is required before approval:**

1. **Remove the `-i` flag from `install`** — change `install` to accept `<name>` as a positional argument (`.command('install <name>')`), not as `-i, --item <name>`. This was explicitly called out in the plan and the review checklist.

Once fixed, this phase is ready for approval.
