# Vaults

A **vault** is a GitHub repository that hosts a `registry.json` file. Vaults are the package sources that plug fetches from. Anyone can create and publish a vault; plug can be pointed at any GitHub repo that follows the registry format.

## What a vault is

A vault repository contains:
- `registry.json` at the repo root — lists all available packages with metadata
- One directory per package containing a `meta.json` and the package entry file (a `.md` file for skills, commands, and agents)

`registry.json` schema:
```json
{
  "name": "vault-display-name",
  "version": "1.0.0",
  "packages": {
    "package-name": {
      "type": "skill|command|agent",
      "version": "1.2.0",
      "path": "packages/package-name",
      "description": "Short description",
      "tags": ["optional", "tag", "list"]
    }
  }
}
```

## The official vault

The official vault (`dsiddharth2/plugvault`, branch `main`) is pre-seeded on first run. It is the default vault and the starting point of the resolve order. It cannot be removed from config — the Vaults screen blocks removal with a message explaining it is required for plug to function.

## Vault config format

Vault configuration lives at `~/.plugvault/config.json`:

```json
{
  "vaults": {
    "official": {
      "name": "official",
      "owner": "dsiddharth2",
      "repo": "plugvault",
      "branch": "main",
      "private": false
    },
    "myorg": {
      "name": "myorg",
      "owner": "myorg",
      "repo": "claude-packages",
      "branch": "main",
      "private": true
    }
  },
  "resolve_order": ["myorg", "official"],
  "default_vault": "myorg"
}
```

## Resolve order

When plug searches for a package, it walks `resolve_order` from front to back and checks each vault's registry. The first vault that contains the package wins. If the same package name appears in multiple vaults, plug reports a conflict and asks which vault to use (or auto-picks the first with `--yes`).

The default vault (`default_vault`) is where new packages are published. It is also the vault prepended to `resolve_order` when set via `vault set-default`. Custom vaults are typically placed before `official` so they take precedence for organisation-specific packages.

## Adding a private vault

Private vaults require a GitHub personal access token with `repo` read scope.

**Token resolution order** (auth.js):
1. Environment variable: `PLUG_VAULT_{NAME}_TOKEN` (vault name uppercased, hyphens → underscores)
2. Token stored in `config.json` under `vaults.{name}.token`

Environment variables are preferred for CI and shared machines. Storing a token in config is convenient for local development but stores it as plaintext — use with care.

**Via CLI:**
```sh
plug vault set-token myorg <token>
```

**Via TUI:**
When adding a vault on the Vaults screen and answering `y` to the "Private vault?" prompt, the add form records the private flag. The actual token must be set separately via the CLI (`plug vault set-token`) or via the environment variable.

## Sync semantics

Vault sync re-fetches `registry.json` for every vault in `resolve_order` and updates the local cache (`~/.plugvault/cache/{vault-name}.json`). The cache TTL is 1 hour. Syncing is useful when:
- A vault maintainer has published new packages
- The cache is stale and you want the latest list immediately without waiting for TTL expiry

Sync does **not** update installed packages — it only refreshes the package listing. To update installed packages use `plug update` or the Installed screen's `u` action.

## Adding and removing vaults

**CLI:**
```sh
plug vault add <name> <github-url>       # Add a vault
plug vault remove <name>                  # Remove a vault
plug vault set-default <name>             # Change default vault
plug vault sync                           # Sync all vault registries
plug vault list                           # List configured vaults
```

**TUI:**
Use the Vaults tab (tab 2). Keys: `a` add, `r` remove, `d` set default, `s` sync. See `docs/features/tui.md` for the full keyboard reference.
