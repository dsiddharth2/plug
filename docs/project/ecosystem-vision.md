# plug — Ecosystem Vision
**Status:** planning (2026-04-16)

---

## Today — What exists (Sprints 1 & 2)

Currently, Plug provides the foundational "Unified Harness" for installing Claude Code extensions from the official registry.

```
┌─────────────────────────────────────────────────────────────────┐
│  PLUGVAULT REPO  (github.com/dsiddharth2/plugvault)             │
│                                                                 │
│  registry.json          ← index of all packages                │
│  registry/                                                      │
│    pm/                                                          │
│      meta.json          ← name, type, version, description      │
│      SKILL.md           ← actual skill content                  │
└─────────────────────────────────────────────────────────────────┘
          │
          │  plug install pm
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  USER'S MACHINE                                                 │
│                                                                 │
│  ~/.plugvault/config.json     ← registered vaults               │
│  .plugvault/installed.json    ← what's installed                │
│                                                                 │
│  .claude/skills/pm/SKILL.md   ← installed skill                │
│                                                                 │
│  ⚠️  senior-engineer NOT installed — pm silently broken         │
└─────────────────────────────────────────────────────────────────┘
```

**Current Limitations:**
1. **Single-Package Install**: `plug install pm` installs ONLY `pm`. Dependencies declared in metadata are not yet resolved, which can lead to broken extensions if requirements aren't met.
2. **Centralized Sources**: `plugvault` is the primary source of packages. While users can add vaults manually, there is no automated discovery of community-contributed vaults.
3. **Manual Publishing**: Developers must manually write `registry.json` and `meta.json` to publish, which creates friction for community growth.

---

## Target — What we are building (Sprint 3 & Beyond)

### Part 1: Dependency Resolution
We are implementing a DFS (Depth-First Search) resolver that allows authors to declare dependencies directly in their skill's frontmatter.

*   **Closure Resolution**: Installing a package will automatically resolve and present an "Install Plan" for its full dependency closure.
*   **Scope Awareness**: The resolver tracks whether dependencies are satisfied in the project (`.claude/`) or global (`~/.claude/`) scope.
*   **Graph-Aware Removal**: Uninstalling a package will check for dependents to prevent breaking other installed extensions.

### Part 2: Community Marketplace (Cross-Repo Sources)
We are moving away from the single-registry model to a decentralized marketplace indexed by `plugvault`.

*   **Developer Workflow**: Just commit a `.md` file with frontmatter to your own GitHub repo. No `registry.json` needed.
*   **Automated Indexing**: A GitHub Action in the `plugvault` repo will daily scan a curated list of trusted community repos and build a `community-index.json`.
*   **One-Fetch Search**: The TUI hits this single index to provide instant search across the entire community ecosystem.

---

## Full Ecosystem Picture

```
                    VAULT REPOS (GitHub)
   ┌──────────────────────┐    ┌─────────────────────────┐
   │  plugvault (official)│    │  developer/my-skills-repo│
   │  registry.json       │    │  superpowers.md          │
   │  registry/pm/        │    │  (frontmatter only)      │
   │    SKILL.md          │    └──────────┬───────────────┘
   │    (frontmatter)     │               │
   └──────────┬───────────┘               │
              │          ┌────────────────┘
              │          │  GitHub Action (daily)
              ▼          ▼
        ┌─────────────────────────────┐
        │  community-index.json       │
        │  (all packages + deps,      │
        │   built from frontmatter)   │
        └──────────────┬──────────────┘
                       │  1 HTTP fetch (cached 1hr)
                       ▼
              ┌────────────────┐
              │   plug TUI     │ ← primary interface
              │   resolver.js  │ ← builds install plan
              │   install.js   │ ← executes plan
              └────────┬───────┘
                       │
                       ▼
              USER'S MACHINE
        .claude/skills/pm/SKILL.md
        .claude/skills/superpowers/SKILL.md
        .claude/agents/senior-engineer.md
        .plugvault/installed.json  ← with dependency edges
```

---

## Build Phases

### Phase A — Dependency Resolution (Current Focus)
Implementing the `resolver.js` and extending `tracker.js` to handle `installed_as`, `dependencies`, and `dependents` fields. Includes the TUI "Install Plan" screen with scope toggles.

### Phase B — Community Marketplace
Building the `community-index.json` pipeline and the TUI "Community Vaults" discovery browser.

### Phase C — Integration
Connecting the resolver to the community index to handle dependencies across multiple vaults seamlessly.
