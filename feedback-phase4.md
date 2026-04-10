# Phase 4 Review — Documentation (Cumulative Phases 1-4)

**Reviewer:** plug-reviewer
**Date:** 2026-04-11
**Branch:** feat/agents-support
**Commit:** f64c572

---

## Test Results

- **186/186 tests passing** (17 test files)
- Zero regressions on existing 174 tests
- 12 new agent tests (5 paths + 7 command) all green

---

## Documentation Review

### 1. Agent type consistency across docs — PASS

All three documentation files describe the agent type consistently:

| Doc | Location | Description | Directory |
|-----|----------|-------------|-----------|
| authoring-guide.md | Type table (line 15) | "Delegated to via the `Agent` tool" | `.claude/agents/` |
| plug/README.md | "What is this?" (line 17) | "specialized sub-agents that Claude can delegate tasks to via the `Agent` tool" | `.claude/agents/*.md` |
| root README.md | "What is this?" (line 17) | identical to plug/README.md | `.claude/agents/*.md` |

The agent template section in authoring-guide.md (lines 132-161) is well-structured with Role/Inputs/Process/Output sections and good guidance ("Focused", "Self-contained", "Clear on outputs").

### 2. Broken links — ISSUE FOUND

**Root README.md is a byte-for-byte duplicate of plug/README.md.** This causes relative links to break when navigated from the repo root on GitHub:

| Link (line) | Works from `plug/` | Works from root |
|---|---|---|
| `docs/authoring-guide.md` (L173) | Yes (`plug/docs/authoring-guide.md`) | **NO** — no `docs/` at repo root |
| `CONTRIBUTING.md` (L196) | Yes (`plug/CONTRIBUTING.md`) | **NO** — no `CONTRIBUTING.md` at root |
| `../plugvault/CONTRIBUTING.md` (L197) | Sibling repo ref | Sibling repo ref |

**Recommendation:** The root README should either (a) adjust these relative paths to `plug/docs/authoring-guide.md` and `plug/CONTRIBUTING.md`, or (b) be a distinct file tailored to the repo root context. As-is, two links are broken when viewed from the repo root on GitHub.

### 3. meta.json schema docs include agent type — PASS

- authoring-guide.md type field table (line 59): `"skill"`, `"command"`, or `"agent"` — correct
- JSON example in authoring-guide.md is a command example which is fine — the type table covers all three
- The "Test locally" section (line 224) correctly mentions `.claude/agents/` as the verify location for agents

### 4. README examples accuracy — PASS

| Example | Verified |
|---------|----------|
| `plug list --remote --type agent` | Matches list.js `--type` option which accepts agent |
| `plug search assistant --type agent` | Matches search.js `--type` option which accepts agent |
| `plug init` creates `.claude/agents/` | Matches init.js directory creation loop |
| Directory tree shows `agents/` under `.claude/` | Matches paths.js `getClaudeAgentsDir()` |

CLI syntax in all examples is correct and matches the implementation.

### 5. Factual references — PASS

| Reference | Verified against |
|-----------|-----------------|
| `npm install -g plugvault` | package.json `"name": "plugvault"` |
| `dsiddharth2/plugvault` | constants.js `OFFICIAL_VAULT_OWNER` / `OFFICIAL_VAULT_REPO` |
| Node.js 18+ | package.json `"engines": { "node": ">=18" }` |
| `.claude/agents/` path | paths.js `getClaudeAgentsDir()` returns `CLAUDE_DIR/AGENTS_DIR` = `.claude/agents` |

### 6. Minor nit (non-blocking)

The one-line tagline at the top of both READMEs says "Install reusable skills and commands" without mentioning agents. The "What is this?" section immediately below does cover all three types, so this is cosmetic, not a correctness issue.

---

## Verdict: CHANGES NEEDED

### Blocking

1. **Root README.md broken links** — Two relative links (`docs/authoring-guide.md`, `CONTRIBUTING.md`) are broken when viewed from the repo root. Fix the paths in the root copy or make it a distinct file.

### Non-blocking (suggestions)

2. Update the one-line tagline to mention agents: "Install reusable skills, commands, and agents..."

---

## FIX APPLIED (2026-04-11)

**Issue:** Root README.md was a byte-for-byte duplicate of plug/README.md, with relative links broken at the repo root level.

**Solution:** Redesigned root README.md as a distinct high-level overview file:
- Changed tagline to include agents: "Install reusable skills, commands, and agents..."
- Removed duplicate detailed content (CLI commands, flags, vaults, auth)
- Added "Quick Start" that directs to plug/README.md for full CLI docs
- Restructured into 4 focused sections: What, Quick Start, Creating Packages, Contributing
- Fixed broken links:
  - `docs/authoring-guide.md` → `plug/docs/authoring-guide.md` (lines 38)
  - `CONTRIBUTING.md` → `plug/CONTRIBUTING.md` (line 42)
  - Vault CONTRIBUTING link → absolute GitHub URL (line 44)
- Root README now serves as an entry point; CLI docs live in plug/README.md

**Result:** No broken links from repo root. Root README is now a distinct, focused overview rather than a duplicate.

---

## Phase 1-4 Cumulative Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Core Infrastructure | APPROVED | Constants, paths, init, install all correct |
| Phase 2: Remaining Commands | APPROVED | update, remove, list, search all correct |
| Phase 3: Tests | APPROVED | 186/186 passing, zero regressions |
| Phase 4: Documentation | **CHANGES NEEDED** | Broken links in root README |
