# plug — Claude Code Native Integration Vision
**Status:** planning (2026-04-16)

---

## What we're building

A single file: `~/.claude/commands/plug.md`

When a user types `/plug`, Claude reads this file and immediately fires `AskUserQuestion` — no reasoning, no output, no delay. The file is pure instruction: hardcoded option lists, hardcoded dispatch table, hardcoded file paths. Claude has nothing to figure out.

**Install trigger:** `plug install plug --global` writes the command file automatically.

> **Scope:** `/plug` in Claude Code is a smart installer — not a TUI replacement.
> Browse/discover stays in the TUI (`plug` in a terminal). `/plug` handles
> install-by-description, list, remove, and vault add from within a conversation.

---

## Zero-latency rule

The command file opens with:

```
Do not think. Do not output any text. Your first action is always an immediate
AskUserQuestion call. The exact JSON for every panel is defined below.
```

Every branch resolves to a tool call. No branch resolves to text output first.

---

## Full UX — screen by screen

### Screen 1 — Main menu (fires on `/plug` with no arguments)

```
┌─ /plug ──────────────────────────────────────────────────────┐
│                                                               │
│  What would you like to do?                                   │
│                                                               │
│  ▶ Install a package                                          │
│    Describe what you need — Claude finds and installs it      │
│                                                               │
│    My packages                                                │
│    View installed, check for updates, remove                  │
│                                                               │
│    Manage vaults                                              │
│    Add, remove, or sync package sources                       │
│                                                               │
│    Open TUI                                                   │
│    Browse everything in the terminal                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

### Flow A — Install a package (natural language search)

#### Screen A1 — Describe what you need

```
┌─ Install ─────────────────────────────────────────────────────┐
│                                                               │
│  What do you need?                                            │
│                                                               │
│  ▶ Something that does code reviews                           │
│    Something that handles deployments                         │
│    Something for Python development                           │
│    [Other — describe what you need, or type a package name]   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

User picks "Other" and types freely — e.g. "security audit of my code" or just "security-review".

#### How the search works

Claude fetches `community-index.json` (~100–200 KB, fits in context), then scans every package's `name` + `description` + `tags` against the user's query.

```
community-index.json entry:
{
  "name": "security-review",
  "description": "Security audit of pending branch changes — OWASP top 10, injection, XSS",
  "tags": ["security", "audit", "owasp", "review"],
  "type": "skill",
  "vault": "official"
}

User query: "security audit of my code"
Match score: name partial ✓ · description strong ✓ · tags: security ✓ audit ✓
→ top result
```

#### Screen A2a — Single match (straight to confirm)

```
┌─ Found ───────────────────────────────────────────────────────┐
│                                                               │
│  Install security-review?                                     │
│                                                               │
│  ▶ Install to project  (.claude/)                             │
│    security-review v1.0.0 · official · 1 dep                 │
│                                                               │
│    Install globally  (~/.claude/)                             │
│    Available in all projects                                  │
│                                                               │
│    Not what I meant — search again                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

#### Screen A2b — Multiple matches (pick one)

```
┌─ Found 3 matches ─────────────────────────────────────────────┐
│                                                               │
│  Which one?                                                   │
│                                                               │
│  ▶ security-review  v1.0.0  official                          │
│    Security audit of pending branch changes — OWASP top 10   │
│                                                               │
│    sec-hardening  v1.1.0  community                           │
│    Hardens code against OWASP vulnerabilities                 │
│                                                               │
│    security-scanner  v0.9.0  langchain                        │
│    Static analysis + dependency vulnerability scan            │
│                                                               │
│    None of these — search again                               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Then → Screen A3 (install plan).

#### Screen A2c — No match

```
Nothing found for "quantum entanglement debugger".

Try the TUI to browse everything:  plug  (in your terminal)
Or search the community index at:  github.com/dsiddharth2/plugvault
```

No question. Plain text output. Done.

#### Screen A3 — Install plan with scope toggle (preview panel)

```
┌─ Install plan ────────────────────────┬───────────────────────────────────────┐
│                                       │  Install scope: Project (.claude/)    │
│  Install security-review +            │                                       │
│  its dependencies?                    │  Required — always installed:         │
│                                       │    [+] security-review  skill  v1.0.0 │
│  ▶ Install to project  (.claude/)     │    [+] senior-engineer  agent  v1.0.3 │
│    2 packages · project scope         │                                       │
│                                       │  2 to install · 0 already satisfied  │
│    Install globally  (~/.claude/)     │                                       │
│    2 packages · global scope          │                                       │
│                                       │                                       │
│    Cancel                             │                                       │
│    Go back, nothing written           │                                       │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

#### Screen A4 — Post-install (text output, no question)

```
✓ Installed 2 packages to .claude/

  security-review  → .claude/skills/security-review/SKILL.md
  senior-engineer  → .claude/agents/senior-engineer.md

Type /security-review to use it now.
```

---

### Flow B — My packages

#### Screen B1 — Installed list

The command file instructs Claude to read `installed.json` first, then render this screen with real data.

```
┌─ My packages ─────────────────────────────────────────────────┐
│                                                               │
│  What would you like to do?                                   │
│                                                               │
│  ▶ senior-engineer  v1.0.3  [global]  ↑ v1.1.0 available    │
│    Update or remove                                           │
│                                                               │
│    code-review  v1.1.0  [global]  up to date                 │
│    Update or remove                                           │
│                                                               │
│    pm  v1.2.0  [project]  up to date                         │
│    Update or remove                                           │
│                                                               │
│    ← Back                                                     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

> If more than 3 packages are installed, the 4th option becomes "More packages →"
> and Claude paginates through `installed.json` using an offset counter.

#### Screen B2 — Package action

```
┌─ senior-engineer ─────────────────────────────────────────────┐
│                                                               │
│  v1.0.3 → v1.1.0 available. What would you like to do?       │
│                                                               │
│  ▶ Update to v1.1.0                                           │
│    Overwrite .claude/agents/senior-engineer.md                │
│                                                               │
│    Remove                                                     │
│    ⚠ pm depends on this — removal will also remove pm        │
│                                                               │
│    Cancel                                                     │
│    Go back                                                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

### Flow C — Manage vaults

#### Screen C1 — Vault actions

```
┌─ Vaults ──────────────────────────────────────────────────────┐
│                                                               │
│  What would you like to do?                                   │
│                                                               │
│  ▶ Add a vault                                                │
│    Register a GitHub repo as a package source                 │
│                                                               │
│    Browse community vaults                                    │
│    Discover and add public vault repos                        │
│                                                               │
│    Remove a vault                                             │
│    Unregister: official, langchain, company 🔒               │
│                                                               │
│    ← Back                                                     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

### Shortcut flows (no menu)

| Invocation | Behavior |
|---|---|
| `/plug install pm` | Exact name match → straight to Screen A3 |
| `/plug install security audit` | Natural language → search → A2a/b/c |
| `/plug list` | Text table of installed packages, no question |
| `/plug remove pm` | Screen B2 for `pm` |
| `/plug update` | Screen B1 filtered to packages with updates only |

Argument dispatch is a simple prefix match in the command file — no reasoning needed.

---

## How search works — mechanics

```
Step 1  Claude executes:
        curl -s https://raw.githubusercontent.com/dsiddharth2/plugvault/main/community-index.json

Step 2  Claude reads the JSON (~100–200 KB).
        For each package: score against query using name + description + tags.

Step 3  Results:
        1 match  → Screen A2a (straight to confirm)
        2–3      → Screen A2b (pick one)
        0        → Screen A2c (not found message)

Step 4  User picks scope → Claude writes files directly using Read/Write/Bash.
        No Node.js. No plug CLI invoked.
```

**Why this scales to 1000+ packages:** Claude reads the full index once per install. The JSON is compact (one object per package, ~200 bytes each → 200 KB for 1000 packages). Semantic matching happens in Claude's context — no search infrastructure needed.

---

## Search quality gate (next vision)

Natural language search only works if package metadata is good.
The community-index.json build pipeline needs a **quality gate** before a package is indexed:

| Field | Requirement |
|---|---|
| `name` | kebab-case, unique, descriptive |
| `description` | 1–2 sentences, includes what it does + key use cases |
| `tags` | 3–8 tags, lowercase, covering domain + action + technology |
| `type` | must be `skill`, `agent`, or `command` |

Packages missing required fields are excluded from `community-index.json` entirely.
This is a plugvault-side enforcement problem — tracked as a separate vision item.

---

## What already auto-integrates (today, without this work)

When `plug install senior-engineer` runs via the TUI, it writes:
```
.claude/skills/senior-engineer/SKILL.md
```
Claude Code picks this up automatically → `/senior-engineer` becomes a usable slash command immediately. **This is the core value loop:** plug handles discovery + installation, Claude Code handles execution.

---

## What gets written to disk

**One file:** `~/.claude/commands/plug.md`

```
[zero-latency directive]

[argument dispatch table]
  if $ARGUMENTS is empty          → MAIN_MENU
  if $ARGUMENTS starts "install"  → INSTALL (with remainder as query)
  if $ARGUMENTS starts "remove"   → MY_PACKAGES (pre-selected package)
  if $ARGUMENTS starts "update"   → MY_PACKAGES (updates only)
  if $ARGUMENTS is "list"         → LIST (text output, no question)

[Section: MAIN_MENU]
[Section: INSTALL — A1, A2a/b/c, A3, A4]
[Section: MY_PACKAGES — B1, B2]
[Section: VAULTS — C1]

[Shared: HOW_TO_READ_INSTALLED_JSON — ~/.plugvault/installed.json + .plugvault/installed.json]
[Shared: HOW_TO_FETCH_INDEX — curl command + cache hint]
[Shared: HOW_TO_WRITE_FILE — path patterns per type: skill/agent/command]
[Shared: HOW_TO_UPDATE_INSTALLED_JSON — schema for adding/removing entries]
```

No Node.js. No plug CLI invoked. Claude uses Bash (curl), Read, Write directly.

---

## Implementation steps

1. Write `plug.md` command file with all sections above
2. Add install logic to plug CLI: `plug install plug --global` → writes `~/.claude/commands/plug.md`
3. Add `plug` package to plugvault official registry so it's discoverable via `/plug install plug`
4. Test each flow: `/plug`, `/plug install <name>`, `/plug install <description>`, `/plug list`, `/plug remove <name>`

## Files touched

| File | Change |
|---|---|
| `~/.claude/commands/plug.md` | New — the command itself |
| `plug/src/commands/install.js` | Self-install path: when package name is `plug`, write command file |
| `plugvault/registry/plug/` | Add plug to official vault |

---

## Relationship to main vision phases

| This work | Depends on |
|---|---|
| `/plug install` (natural language) | Phase B — community-index.json must exist |
| `/plug list` / `/plug remove` | Nothing — reads local installed.json only |
| Search quality gate | Separate vision — plugvault build pipeline |
| Context-aware auto-suggest (future) | Phase C dep resolution + this work |
