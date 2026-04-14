# Search & List — Procedures

Reference file for the `plug` skill. Read this file before executing any `list` or `search` operation. Constants, fetch pattern, and auth resolution are in `SKILL.md`.

---

## List Local — `plug list`

Lists all packages installed in local and/or global scope.

### Step 1 — Read installed.json files

Read both scope files:
- **Local:** `.plugvault/installed.json` (current project)
- **Global:** `~/.plugvault/installed.json`

If a file is missing, treat as `{ "installed": {} }`. Parse both using the Read tool.

### Step 2 — Merge with scope labels

Build a flat list `allInstalled` from both maps, tagging each entry with its scope:
```python
# Pseudocode
allInstalled = []
for name, entry in local["installed"].items():
    allInstalled.append({ "name": name, "scope": "local", **entry })
for name, entry in global_["installed"].items():
    allInstalled.append({ "name": name, "scope": "global", **entry })
```

Same package name appearing in both scopes → include both rows (they are independent installations).

### Step 3 — Apply filters (if specified)

| Flag               | Filter behavior                                                    |
|--------------------|--------------------------------------------------------------------|
| `--type skill`     | Keep only entries where `entry.type == "skill"`                    |
| `--type command`   | Keep only entries where `entry.type == "command"`                  |
| `--type agent`     | Keep only entries where `entry.type == "agent"`                    |
| `--vault {name}`   | Keep only entries where `entry.vault == name`                      |
| `--local`          | Keep only entries with `scope == "local"`                          |
| `--global`         | Keep only entries with `scope == "global"`                         |

Flags may be combined: `plug list --type command --vault official`.

### Step 4 — Format as markdown table

```
## Installed Packages

| Package      | Type    | Version | Vault    | Scope  | Path                               |
|--------------|---------|---------|----------|--------|------------------------------------|
| code-review  | command | 1.0.0   | official | local  | .claude/commands/code-review.md    |
| api-patterns | skill   | 1.0.0   | official | local  | .claude/skills/api-patterns.md     |
| git-workflow | command | 1.0.0   | official | global | ~/.claude/commands/git-workflow.md |

3 packages installed (2 local, 1 global).
```

**If no packages installed (after filters applied):**
```
No packages installed yet. Use `plug install {name}` or `/plug` → Browse Packages to get started.
```

If filters were specified and produced an empty result, clarify:
```
No packages match the filter (--type command --vault official).
Run `plug list` without filters to see all installed packages.
```

---

## List Remote — `plug list --remote`

Lists all packages available across registered vaults.

### Step 1 — Read config.json

Read `~/.plugvault/config.json` using the Read tool. Extract `resolve_order` and the `vaults` map. If config is missing, report:
```
Config not found at `~/.plugvault/config.json`. Run `plug init` to initialize.
```
Stop.

### Step 2 — Fetch registry.json from each vault

For each vault name in `resolve_order`:
1. Look up vault details: `vaults[name]` (owner, repo, branch, private)
2. Resolve auth token (SKILL.md Section 3)
3. Fetch using the fetch pattern (SKILL.md Section 4):
   ```
   path = "registry.json"
   vault = name
   ```
4. On error: record `{ vault: name, status: "error", error: "<message>", packages: [] }` and continue to next vault (do not abort the whole operation).
5. On success: parse packages from registry body.

### Step 3 — Collect and apply filters

Build `allRemote`:
```python
allRemote = []
for vault_name, registry in registries.items():
    for pkg_name, pkg in registry["packages"].items():
        allRemote.append({ "vault": vault_name, "name": pkg_name, **pkg })
```

Apply the same `--type` and `--vault` filters as List Local (Step 3 above) if flags were provided.

### Step 4 — Format as markdown table

```
## Available Packages

| Name           | Type    | Vault    | Version | Description                              |
|----------------|---------|----------|---------|------------------------------------------|
| code-review    | command | official | 1.1.0   | Deep code review with security analysis  |
| api-patterns   | skill   | official | 1.0.0   | REST API design patterns and conventions |
| test-writer    | agent   | official | 1.0.0   | Generates unit tests for your code       |
| git-workflow   | command | official | 1.0.0   | Standardized git branching workflow      |
| corp-standards | skill   | mycorp   | 2.0.0   | Internal coding standards and checklist  |

5 packages across 2 vaults. Run `plug install {name}` to install.
```

**If a vault had an error during fetch:**
```
⚠  Could not fetch packages from vault "mycorp" (Auth failed — 401). Run `/plug` → Manage Vaults → set-token to fix.
```
Print this warning above the table. Still display packages from successful vaults.

**If no packages found anywhere:**
```
No packages found in any registered vault. Check your vault configuration with `plug vault list`.
```

---

## Search — `plug search {keyword}`

Searches all registered vaults and returns results ranked by relevance score.

### Step 1 — Normalize the keyword

Convert `keyword` to lowercase. Trim whitespace. If the keyword is empty, prompt the user:
```
Please provide a search keyword. Example: plug search testing
```
Stop.

### Step 2 — Fetch registry.json from each vault

Same as List Remote Step 2. Collect registries into `registryMap`.

### Step 3 — Score each package

For each package across all vaults, compute a relevance score using these rules:

| Criterion                                   | Points | Notes                                                   |
|---------------------------------------------|--------|---------------------------------------------------------|
| Exact name match                            | 40     | `pkg.name.toLowerCase() === keyword`                    |
| Partial name match (name contains keyword)  | 30     | `pkg.name.toLowerCase().includes(keyword)` (not exact)  |
| Description contains keyword                | 20     | `pkg.description.toLowerCase().includes(keyword)`       |
| Tag match                                   | 10     | Any tag in `pkg.tags` matches keyword (case-insensitive)|

**Scoring notes:**
- A package earns the **highest matching criterion only** for name (either exact 40 OR partial 30, not both).
- Description and tag points are **additive** with the name score: a package with a partial name match AND a description match earns 30 + 20 = 50.
- A package with score 0 is excluded from results.

**Score computation in Python:**
```python
def score_package(pkg_name, pkg, keyword):
    score = 0
    name_lower = pkg_name.lower()
    kw = keyword.lower()

    if name_lower == kw:
        score += 40
    elif kw in name_lower:
        score += 30

    desc = (pkg.get("description") or "").lower()
    if kw in desc:
        score += 20

    for tag in (pkg.get("tags") or []):
        if kw in tag.lower():
            score += 10
            break  # Only count once per package

    return score
```

### Step 4 — Sort and filter results

Sort `scoredResults` by score descending. Remove entries with score 0. If the keyword maps to a known category (e.g., "API & HTTP" → search for "api", "http", "rest", "graphql"), apply multi-keyword scoring by averaging across keywords.

### Step 5 — Format as markdown table

```
## Search results for "{keyword}"

| #  | Name          | Type    | Score | Vault    | Description                          |
|----|---------------|---------|-------|----------|--------------------------------------|
| 1  | test-writer   | agent   | 50    | official | Generates unit tests for your code   |
| 2  | tdd-workflow  | skill   | 30    | official | Test-driven development patterns     |
| 3  | code-review   | command | 10    | official | Deep code review (includes tests)    |

3 results across 1 vault. Run `plug install {name}` to install.
```

**If no results found:**
```
No packages found matching "{keyword}" across {n} vault(s).
Try a broader keyword or browse all packages with `plug list --remote`.
```

---

## Multi-Vault Notes

- All three operations (list local, list remote, search) check all registered vaults unless `--vault {name}` is specified.
- Packages with the same name from different vaults appear as separate rows with their respective `vault` column values.
- If a vault fetch fails during list-remote or search, include a warning message but continue processing remaining vaults. Never silently skip errors.

---

## Example: `plug list` output

```
## Installed Packages

| Package      | Type    | Version | Vault    | Scope  | Path                               |
|--------------|---------|---------|----------|--------|------------------------------------|
| code-review  | command | 1.0.0   | official | local  | .claude/commands/code-review.md    |
| api-patterns | skill   | 1.0.0   | official | global | ~/.claude/skills/api-patterns.md   |

2 packages installed (1 local, 1 global).
```

## Example: `plug list --remote` output

```
## Available Packages

| Name         | Type    | Vault    | Version | Description                             |
|--------------|---------|----------|---------|-----------------------------------------|
| code-review  | command | official | 1.1.0   | Deep code review with security analysis |
| api-patterns | skill   | official | 1.0.0   | REST API design patterns                |
| test-writer  | agent   | official | 1.0.0   | Generates unit tests for your code      |

3 packages across 1 vault. Run `plug install {name}` to install.
```

## Example: `plug search testing` output

```
## Search results for "testing"

| #  | Name         | Type    | Score | Vault    | Description                        |
|----|--------------|---------|-------|----------|------------------------------------|
| 1  | test-writer  | agent   | 50    | official | Generates unit tests for your code |
| 2  | tdd-workflow | skill   | 30    | official | Test-driven development patterns   |
| 3  | code-review  | command | 10    | official | Deep code review (includes tests)  |

3 results across 1 vault. Run `plug install {name}` to install.
```
