# Install & Update — Procedures

Reference file for the `plug` skill. Read this file before executing any `install` or `update` operation. All constants, fetch patterns, and auth resolution are defined in `SKILL.md`.

---

## Install Procedure

### Step 1 — Parse the package name

Accept two formats:
- `vault/name` — explicit vault prefix (e.g., `official/code-review`)
- `name` — bare name, resolve using `resolve_order`

Extract `packageName` and (optionally) `explicitVault`. Trim whitespace. If the name contains a `/`, split on the first `/`; left side is `explicitVault`, right side is `packageName`.

---

### Step 2 — Auto-init if directories are missing

Check whether `.plugvault/` exists using Glob: `.plugvault/`. If not found, run the `init` inline operation from SKILL.md Section 5a before continuing. This creates all required directories and an empty `installed.json`. Do not fail — initialize silently and continue.

---

### Step 3 — Fetch registry.json from the target vault(s)

**If `explicitVault` was provided:**
- Set `targetVaults = [explicitVault]`
- Resolve auth for that vault (SKILL.md Section 3)
- Fetch using the fetch pattern (SKILL.md Section 4):
  ```
  path = "registry.json"
  vault = explicitVault
  ```
- On error, stop and report using the error table in SKILL.md Section 4.3.

**If no explicit vault:**
- Read `~/.plugvault/config.json` using Read tool. Extract `resolve_order`.
- Set `targetVaults = resolve_order`
- Fetch `registry.json` from each vault in order. Collect results into `registryMap = { vaultName: registryBody }`.

---

### Step 4 — Look up the package in registry.packages

For each fetched registry, parse the JSON body:
```bash
echo "$BODY" | python3 -c "import sys,json; r=json.load(sys.stdin); print(json.dumps(r.get('packages', {})))"
```

Check if `packages[packageName]` exists in each registry. Collect all matches into `matches = [{ vault, pkg }]`.

**If no match found in any vault:**
```
Package `{packageName}` not found in any registered vault.
Searched: {resolve_order joined with ', '}
Tip: run `plug search {packageName}` to find similarly named packages.
```
Stop.

---

### Step 5 — Resolve multi-vault conflict

**If exactly 1 match:** Use that vault. Set `selectedVault` and `selectedPkg`.

**If 2+ matches (same name found in multiple vaults):** Use AskUserQuestion:

```json
AskUserQuestion:
  question: "Package '{packageName}' was found in multiple vaults. Which one do you want to install from?"
  header: "Multiple Sources"
  multiSelect: false
  options:
    - label: "{vault1}"
      description: "{pkg1.type} · v{pkg1.version} — {pkg1.description}"
    - label: "{vault2}"
      description: "{pkg2.type} · v{pkg2.version} — {pkg2.description}"
```

Use the user's selection as `selectedVault` and `selectedPkg`.

---

### Step 6 — Check installed.json for existing entry

Determine scope (local default; `-g`/`--global`/`"globally"` = global). Read the appropriate installed.json:
- Local: `.plugvault/installed.json`
- Global: `~/.plugvault/installed.json`

If the file is missing, treat as `{ "installed": {} }`.

Check `installed[packageName]`. If present:

```json
AskUserQuestion:
  question: "`{packageName}` v{installed.version} is already installed. What would you like to do?"
  header: "Conflict"
  multiSelect: false
  options:
    - label: "Overwrite"
      description: "Replace with the latest version from {selectedVault}"
    - label: "Skip"
      description: "Keep the current installation unchanged"
```

If user selects **Skip**, stop. If user selects **Overwrite**, continue.

---

### Step 7 — Fetch meta.json

Using the fetch pattern (SKILL.md Section 4):
```
path = "{selectedPkg.path}/meta.json"
vault = selectedVault
```

Parse the response body as JSON. Extract:
- `meta.name`
- `meta.type` (skill | command | agent)
- `meta.version`
- `meta.entry` (the .md filename, e.g., `code-review.md`)
- `meta.description`

On error, stop and report with the error table.

---

### Step 8 — Fetch the package file

Using the fetch pattern (SKILL.md Section 4):
```
path = "{selectedPkg.path}/{meta.entry}"
vault = selectedVault
```

This is the actual .md file content. Store as `fileContent = $BODY`.

On error, stop and report.

---

### Step 9 — Route by type and determine destination path

| `meta.type` | Scope: local             | Scope: global               |
|-------------|--------------------------|------------------------------|
| `skill`     | `.claude/skills/`        | `~/.claude/skills/`          |
| `command`   | `.claude/commands/`      | `~/.claude/commands/`        |
| `agent`     | `.claude/agents/`        | `~/.claude/agents/`          |

Set `destDir` based on type and scope. Set `destPath = "{destDir}{meta.entry}"`.

If `destDir` does not exist, create it:
```bash
mkdir -p "{destDir}"
```

---

### Step 10 — Write the file

Use the Write tool to write `fileContent` to `destPath`.

---

### Step 11 — Update installed.json

Read the current installed.json (same path as Step 6). If missing, start with `{ "installed": {} }`.

Add or replace the entry for `packageName`:
```json
{
  "type": "{meta.type}",
  "vault": "{selectedVault}",
  "version": "{meta.version}",
  "path": "{destPath}",
  "installedAt": "{ISO 8601 timestamp}"
}
```

Get the current timestamp:
```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
```

Write the updated installed.json using the Write tool.

---

### Step 12 — Report success

```
## Installed `{packageName}` v{meta.version}

| Field    | Value                          |
|----------|--------------------------------|
| Type     | {meta.type}                    |
| Vault    | {selectedVault}                |
| Path     | {destPath}                     |
| Scope    | {scope}                        |
```

Add a usage hint based on type:
- `skill` → "The `{packageName}` skill will auto-activate when relevant."
- `command` → "Run `/{meta.entry without .md}` to use this command."
- `agent` → "The `{packageName}` agent is now available as a sub-agent."

---

## Error Handling

All fetch errors use the SKILL.md Section 4.3 error table. Additional errors:

| Condition                      | Message                                                                                |
|-------------------------------|----------------------------------------------------------------------------------------|
| `config.json` missing          | "Config not found at `~/.plugvault/config.json`. Run `plug init` to initialize."       |
| `resolve_order` empty          | "No vaults are registered. Run `/plug` → Manage Vaults → Add a Vault."                |
| Corrupt `installed.json`       | "Could not parse `{path}`. Check for JSON syntax errors or delete the file to reset." |
| Corrupt `registry.json`        | "Registry from `{vaultName}` returned invalid JSON. The vault may be misconfigured."  |
| `meta.entry` missing in meta.json | "Package `{name}` has no `entry` field in meta.json. The vault entry may be broken." |
| Write tool failure             | "Failed to write `{destPath}`. Check disk space and directory permissions."            |

---

## Scope Support

| Trigger words                   | Scope  | installed.json                    | Target dirs                                          |
|---------------------------------|--------|-----------------------------------|------------------------------------------------------|
| (none / default)                | local  | `.plugvault/installed.json`       | `.claude/skills/`, `.claude/commands/`, `.claude/agents/` |
| `-g`, `--global`, "globally"    | global | `~/.plugvault/installed.json`     | `~/.claude/skills/`, `~/.claude/commands/`, `~/.claude/agents/` |

The global `~/.plugvault/config.json` (vault registry) is always read regardless of scope.

---

## Update Procedure

### Step 1 — Read installed.json

Determine scope. Read the appropriate installed.json. If missing or empty, report:
```
No packages installed in {scope} scope. Nothing to update.
```
Stop.

### Step 2 — Determine which packages to update

**`update X`** — single package: look up `installed[X]`. If not found:
```
Package `{X}` is not installed in {scope} scope.
```
Stop. Otherwise set `updateList = [{ name: X, entry: installed[X] }]`.

**`update --all`** — iterate all keys in `installed`. Set `updateList = all entries`.

### Step 3 — Fetch registry for each package's recorded vault

For each item in `updateList`:
- Get `entry.vault`
- Fetch `registry.json` from that vault using the fetch pattern (SKILL.md Section 4)
- Parse and look up `packages[item.name]`
- Get `registryPkg.version` (the latest version)

### Step 4 — Compare versions using semver

Use the `compare_versions` function from SKILL.md Section 7:
```bash
result=$(compare_versions "{entry.version}" "{registryPkg.version}")
```

- `"newer"` → update available, add to `toUpdate`
- `"same"` or `"older"` → skip, add to `upToDate`

### Step 5 — Report version comparison table

```
## Update Check

| Package      | Installed | Latest | Status           |
|--------------|-----------|--------|------------------|
| code-review  | 1.0.0     | 1.1.0  | Update available |
| api-patterns | 1.0.0     | 1.0.0  | Up to date       |
```

**If `toUpdate` is empty:**
```
All {n} packages are up to date.
```
Stop.

### Step 6 — Re-download updated packages

For each package in `toUpdate`, execute Install Steps 7–11 (fetch meta.json → fetch .md file → write → update installed.json). Use `entry.vault` as `selectedVault`.

### Step 7 — Report update confirmation

```
## Updated {n} package(s)

| Package     | From  | To    |
|-------------|-------|-------|
| code-review | 1.0.0 | 1.1.0 |
```
