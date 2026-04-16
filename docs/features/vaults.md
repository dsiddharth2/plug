# Vaults & Registries

Plug uses a decentralized "Vault" model for package distribution. A Vault is simply a GitHub repository that contains a `registry.json` file at its root.

## Core Concepts

### 1. The Registry
Each vault maintains a `registry.json` file. This is the index of all packages available in that vault. It stores:
*   **Package Metadata**: Name, version, type, and description.
*   **Path**: The subdirectory within the vault repo where the package lives.
*   **Tags**: Used by Plug for search scoring and discoverability.

### 2. Resolve Order
When you install a package, Plug searches through all your registered vaults in a specific order (the "resolve order").
*   The first vault in the list that contains the package wins.
*   You can prioritize your own internal or private vaults over the official one.
*   Manage this order via `plug vault set-default` or by editing `~/.plugvault/config.json`.

---

## Vault Types

### Public Vaults
Public repositories on GitHub. No authentication is needed to browse or install packages.
*   **Example**: The official [PlugVault](https://github.com/dsiddharth2/plugvault).

### Private Vaults
Private GitHub repositories. These require a GitHub Personal Access Token (PAT) with `repo` (read) scope.
*   **Authentication**: Plug supports tokens via environment variables (`PLUGVAULT_GITHUB_TOKEN`) or by storing them securely in the global configuration file.
*   **Interactive Setup**: You can add and configure private vaults directly in the Plug TUI's "Vaults" screen.

---

## Management Commands

### Interactive (TUI)
Press `Tab` to navigate to the "Vaults" screen. From there, you can:
*   Add new public or private vaults.
*   Remove existing vaults.
*   Update authentication tokens.
*   Set a vault as the "default" (moving it to the front of the resolve order).

### CLI
```bash
# List all registered vaults
plug vault list

# Add a public vault
plug vault add my-vault https://github.com/owner/repo

# Set a GitHub token for a private vault
plug vault set-token my-vault <your-pat>

# Change default vault
plug vault set-default my-vault
```

---

## Global Configuration
Vault settings are stored in `~/.plugvault/config.json`.

```json
{
  "vaults": {
    "official": {
      "url": "https://github.com/dsiddharth2/plugvault",
      "branch": "main",
      "private": false
    }
  },
  "resolve_order": ["official"],
  "default_vault": "official"
}
```
