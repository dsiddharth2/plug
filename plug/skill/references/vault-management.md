# Vault Management — Procedures

Reference file for the `plug` skill. Read this file before executing any `vault` subcommand. Constants, fetch pattern, and auth resolution are in `SKILL.md`.

All vault state is stored in `~/.plugvault/config.json`. Schema is defined in `references/config-schema.md`.

---

## vault list

List all registered vaults and their configuration.

### Step 1 — Read config.json

Read `~/.plugvault/config.json` using the Read tool. If missing:
```
Config not found at `~/.plugvault/config.json`. Run `plug init` to initialize.
```
Stop.

### Step 2 — Format as markdown table

```
## Registered Vaults

| Name     | Owner        | Repo        | Branch | Private | Default |
|----------|--------------|-------------|--------|---------|---------|
| official | dsiddharth2  | plugvault   | main   | No      | Yes     |
| mycorp   | mycorp-org   | tools-vault | main   | Yes     | No      |

2 vaults registered. Resolve order: official → mycorp
```

- **Default** = `Yes` if `name == config.default_vault`
- **Private** = `Yes` if `vault.private == true`
- Resolve order: `config.resolve_order` joined with ` → `

If only the official vault exists:
```
1 vault registered. Resolve order: official
```

---

## vault add

Register a new GitHub-hosted vault.

### Step 1 — Panel: Vault visibility

```json
AskUserQuestion:
  question: "Is this a public or private vault?"
  header: "Visibility"
  multiSelect: false
  options:
    - label: "Public"
      description: "No authentication needed — anyone can fetch packages"
    - label: "Private"
      description: "Requires a GitHub personal access token (PAT) with repo read scope"
```

Store user's selection as `isPrivate = (label == "Private")`.

### Step 2 — Prompt for vault details

Output to chat (free-text input — not a panel):
```
Please provide the vault details:

1. **Name** — a short alias (e.g., "mycorp", "team-tools")
2. **GitHub URL** — full repo URL (e.g., https://github.com/mycorp-org/tools-vault)
3. **Branch** — (optional, default: main)
```

Parse the user's response:
- Extract `vaultName` (first token or labeled "Name:")
- Extract `githubUrl` (token starting with `https://github.com/`)
- Extract `branch` if provided; default to `"main"`
- Parse `githubUrl` to extract `owner` and `repo`:
  ```
  https://github.com/{owner}/{repo}
  ```
  Strip trailing `.git` if present.

**Validate URL format:** If `githubUrl` does not match `https://github.com/{owner}/{repo}`, report:
```
Invalid GitHub URL format. Expected: https://github.com/{owner}/{repo}
```
Re-prompt once. If still invalid, stop.

**Validate name:** If `vaultName` is empty or contains spaces or special characters other than `-_`, report:
```
Vault name must be a short alphanumeric alias (letters, numbers, hyphens, underscores only).
```
Stop.

**Check for duplicate name:** Read config.json. If `config.vaults[vaultName]` already exists, report:
```
A vault named "{vaultName}" is already registered. Use a different name or remove the existing one first.
```
Stop.

### Step 3 — Test connectivity

Fetch `registry.json` from the new vault using the fetch pattern (SKILL.md Section 4):
```
owner = parsed owner
repo = parsed repo
branch = branch
path = "registry.json"
vault = vaultName (new, auth resolved from user-provided token if private)
```

**If `isPrivate`:** Before fetching, prompt for token:
```
This is a private vault. Please provide a GitHub Personal Access Token (PAT) with `repo` read scope.
(The token will be stored in ~/.plugvault/config.json — see vault set-token for details.)
```
Store the token as `newToken`. Use it in the fetch Authorization header.

**Connectivity outcomes:**

| HTTP Status | Action                              |
|-------------|-------------------------------------|
| 200         | Proceed — parse package count       |
| 404         | registry.json not found → show error panel |
| 401 / 403   | Auth failure → show error panel     |
| 000         | Network failure → show error panel  |

**Error panel (on any failure):**

Show the failure reason in chat:
```
Could not reach https://raw.githubusercontent.com/{owner}/{repo}/{branch}/registry.json

Possible causes:
- Repository doesn't exist or is misspelled
- Repository is private and no token is configured (or token lacks `repo` scope)
- registry.json is missing from the repo root
```

Then present the retry panel:
```json
AskUserQuestion:
  question: "What would you like to do?"
  header: "Connection Error"
  multiSelect: false
  options:
    - label: "Set Token & Retry"
      description: "Provide a GitHub PAT and try the connection again"
    - label: "Add Anyway"
      description: "Register the vault without verifying connectivity (fix auth later)"
    - label: "Cancel"
      description: "Do not add this vault"
```

- **Set Token & Retry**: prompt for token, re-run the fetch. If it still fails, show the error panel again (loop once more, then if still failing, fall through to Cancel).
- **Add Anyway**: skip connectivity check, proceed to Step 4 with `packageCount = "unknown"`.
- **Cancel**: stop. Report "Vault not added."

### Step 4 — Add vault to config.json

Read current config.json. Build the new vault entry:
```json
{
  "name": "{vaultName}",
  "owner": "{owner}",
  "repo": "{repo}",
  "branch": "{branch}",
  "private": {isPrivate}
}
```

If `newToken` was provided, add `"token": "{newToken}"` to the entry.

- Add to `config.vaults[vaultName]`
- Append `vaultName` to `config.resolve_order`
- Do **not** change `config.default_vault`

Write updated config.json using the Write tool.

### Step 5 — Report confirmation

```
## Vault added

| Field    | Value                                |
|----------|--------------------------------------|
| Name     | {vaultName}                          |
| Repo     | {owner}/{repo}                       |
| Branch   | {branch}                             |
| Private  | {Yes/No}                             |
| Packages | {packageCount} packages found        |

Resolve order updated: {old_order} → {vaultName}
```

---

## vault remove

Unregister an existing vault.

### Step 1 — Read config.json

Read `~/.plugvault/config.json`. If missing, report as in vault list.

### Step 2 — Panel: Select vault to remove

Build options from `config.resolve_order`. Mark official as protected:

```json
AskUserQuestion:
  question: "Which vault do you want to remove?"
  header: "Remove Vault"
  multiSelect: false
  options:
    - label: "mycorp"
      description: "mycorp-org/tools-vault (private)"
    - label: "official (protected)"
      description: "dsiddharth2/plugvault (public) — removing this is not recommended"
```

**If user selects the "official" vault → Safety panel:**

```json
AskUserQuestion:
  question: "The official vault is the default package source. Are you sure you want to remove it?"
  header: "Warning"
  multiSelect: false
  options:
    - label: "Yes, Remove It"
      description: "I understand — I can re-add it later if needed"
    - label: "Cancel"
      description: "Keep the official vault"
```

If user selects **Cancel**, stop. Report "Official vault kept."

**If only one vault is registered:** Report:
```
Cannot remove the only registered vault. Add another vault first.
```
Stop.

### Step 3 — Remove from config

- Delete `config.vaults[vaultName]`
- Remove `vaultName` from `config.resolve_order`
- If `config.default_vault == vaultName`, set `config.default_vault` to the next vault remaining in `resolve_order` (first entry). If resolve_order is now empty, set `default_vault = ""`.

Write updated config.json using the Write tool.

### Step 4 — Report

```
## Vault removed

Removed "{vaultName}" ({owner}/{repo}).
Resolve order updated: {new_order}

Note: Packages already installed from "{vaultName}" remain on disk.
To remove them, use `plug list` then `plug remove {name}`.
```

---

## vault set-default

Change which vault is searched first.

### Step 1 — Read config.json

Read `~/.plugvault/config.json`. Extract `resolve_order` and `default_vault`.

If only one vault is registered:
```
Only one vault registered — it is already the default.
```
Stop.

### Step 2 — Panel: Pick new default

Build options from `config.resolve_order`, marking the current default:

```json
AskUserQuestion:
  question: "Which vault should be searched first?"
  header: "Set Default"
  multiSelect: false
  options:
    - label: "official (current default)"
      description: "dsiddharth2/plugvault — public"
    - label: "mycorp"
      description: "mycorp-org/tools-vault — private"
```

### Step 3 — Update config

- Set `config.default_vault = selectedVault`
- Move `selectedVault` to the front of `config.resolve_order`:
  ```python
  order = [selectedVault] + [v for v in config["resolve_order"] if v != selectedVault]
  config["resolve_order"] = order
  ```

Write updated config.json using the Write tool.

### Step 4 — Report

```
Default vault changed to "{selectedVault}".
Resolve order updated: {new_order joined with ' → '}
```

---

## vault set-token

Store or update an authentication token for a vault.

### Step 1 — Read config.json

Read `~/.plugvault/config.json`. If vault name was not provided as an argument, output in chat:
```
Which vault do you want to set a token for?
```
If still ambiguous, list the registered vaults and ask.

### Step 2 — Prompt for token

Output to chat (not a panel — token must not appear in AskUserQuestion options):
```
Please paste your GitHub Personal Access Token (PAT) for vault "{vaultName}".
The token requires `repo` read scope for private repositories.
```

Read the user's next message as `newToken`. Trim whitespace.

**Security rule:** Never echo, print, or include the token in any chat output, confirmation message, or log line. The token must only appear as a shell variable passed to curl.

**Warning to display regardless:**
```
⚠  Token storage warning: This token will be stored in plaintext at ~/.plugvault/config.json.
For better security, use the environment variable PLUGVAULT_TOKEN_{VAULT_NAME_UPPER} instead.
```

### Step 3 — Write token to config

Set `config.vaults[vaultName].token = newToken`. Write updated config.json.

### Step 4 — Test connectivity

Fetch `registry.json` using the updated token via the fetch pattern (SKILL.md Section 4). Report result:

**Success:**
```
Token saved and verified. Vault "{vaultName}" is now accessible.
{packageCount} packages found in registry.
```

**Failure (401 / 403):**
```
Token saved, but connectivity test failed (HTTP {status}).
Check that the token has `repo` read scope and has not expired.
You can update it anytime with `plug vault set-token {vaultName}`.
```

---

## vault sync

Re-fetch package registries from all vaults and report their status.

### Step 1 — Read config.json

Read `~/.plugvault/config.json`. Extract `resolve_order` and `vaults`.

### Step 2 — Fetch registry.json from each vault

For each vault in `resolve_order`:
1. Resolve auth token (SKILL.md Section 3)
2. Fetch `registry.json` using the fetch pattern (SKILL.md Section 4)
3. On success: parse package count. Record `{ vault, status: "OK", packageCount }`
4. On failure: record `{ vault, status: "<error>", packageCount: "—" }` where `<error>` is derived from HTTP status:
   - 404 → `"Not found"`
   - 401 → `"Auth failed (401)"`
   - 403 → `"Forbidden (403)"`
   - 000 → `"Network error"`
   - other → `"HTTP {status}"`

### Step 3 — Report status table

```
## Vault Sync Complete

| Vault    | Status           | Packages |
|----------|------------------|----------|
| official | OK               | 8        |
| mycorp   | Auth failed (401)| —        |

1 of 2 vaults synced successfully.
```

**If all vaults succeed:**
```
All {n} vaults synced successfully.
```

**For each failed vault, append a remediation hint:**
```
Fix "mycorp": run `/plug` → Manage Vaults → set-token, or set PLUGVAULT_TOKEN_MYCORP.
```

---

## Error Handling Summary

| Error                              | Message                                                                                              |
|------------------------------------|------------------------------------------------------------------------------------------------------|
| Config missing                     | "Config not found at `~/.plugvault/config.json`. Run `plug init` to initialize."                     |
| Vault not found in config          | "Vault `{name}` is not registered. Run `plug vault list` to see registered vaults."                  |
| Connectivity failure (connectivity test) | Show failure reason + retry/add-anyway/cancel panel (see vault add Step 3)                   |
| Auth failure on set-token test     | "Token saved but test failed. Check token scope and expiry."                                         |
| Corrupt config.json                | "Could not parse `~/.plugvault/config.json`. Check for JSON syntax errors or delete to reset."       |
| Write failure                      | "Failed to write config. Check file permissions at `~/.plugvault/`."                                 |
| Removing only vault                | "Cannot remove the only registered vault. Add another vault first."                                  |
