# Config Schema Reference

JSON schemas for all data files used by the plug skill.

---

## config.json

**Location:** `~/.plugvault/config.json`

Stores registered vaults, resolve order, and the default vault.

### Schema

```typescript
{
  vaults: {
    [name: string]: {
      name: string,       // vault alias (e.g., "official", "mycorp")
      owner: string,      // GitHub org or user (e.g., "dsiddharth2")
      repo: string,       // GitHub repo name (e.g., "plugvault")
      branch: string,     // git branch (e.g., "main")
      private: boolean,   // true if repo requires auth
      token?: string      // optional GitHub PAT (prefer env vars)
    }
  },
  resolve_order: string[],  // vault names in priority order (first = highest priority)
  default_vault: string     // alias of the default vault
}
```

### Example

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
    "mycorp": {
      "name": "mycorp",
      "owner": "mycorp-org",
      "repo": "tools-vault",
      "branch": "main",
      "private": true,
      "token": "ghp_..."
    }
  },
  "resolve_order": ["official", "mycorp"],
  "default_vault": "official"
}
```

### Default Seed (used by `plug init` when config.json is missing)

```json
{
  "vaults": {
    "official": {
      "name": "official",
      "owner": "dsiddharth2",
      "repo": "plugvault",
      "branch": "main",
      "private": false
    }
  },
  "resolve_order": ["official"],
  "default_vault": "official"
}
```

---

## installed.json

**Locations:**
- Local (per-project): `.plugvault/installed.json`
- Global: `~/.plugvault/installed.json`

Tracks all packages installed in that scope.

### Schema

```typescript
{
  installed: {
    [packageName: string]: {
      type: "skill" | "command" | "agent",
      vault: string,       // vault alias the package was installed from
      version: string,     // semver string at time of install (e.g., "1.0.0")
      path: string,        // full path where the .md file was written
      installedAt: string  // ISO 8601 timestamp (e.g., "2026-04-14T10:00:00Z")
    }
  }
}
```

### Example

```json
{
  "installed": {
    "code-review": {
      "type": "command",
      "vault": "official",
      "version": "1.0.0",
      "path": ".claude/commands/code-review.md",
      "installedAt": "2026-04-14T10:00:00Z"
    },
    "api-patterns": {
      "type": "skill",
      "vault": "official",
      "version": "1.0.0",
      "path": ".claude/skills/api-patterns.md",
      "installedAt": "2026-04-14T10:05:00Z"
    }
  }
}
```

### Empty initial state (written by `plug init`)

```json
{ "installed": {} }
```

---

## registry.json

**Location:** vault repo root (e.g., `https://raw.githubusercontent.com/dsiddharth2/plugvault/main/registry.json`)

The package index for a vault. Fetched to browse, search, and resolve package names.

### Schema

```typescript
{
  name: string,      // vault display name
  version: string,   // registry schema version (not package version)
  packages: {
    [packageName: string]: {
      type: "skill" | "command" | "agent",
      version: string,      // current published version
      path: string,         // path within the vault repo (e.g., "packages/code-review")
      description: string,  // short description (shown in search results)
      tags?: string[]       // optional tags for search scoring
    }
  }
}
```

### Example

```json
{
  "name": "Official PlugVault",
  "version": "1",
  "packages": {
    "code-review": {
      "type": "command",
      "version": "1.0.0",
      "path": "packages/code-review",
      "description": "Deep code review with security analysis",
      "tags": ["review", "security", "quality"]
    },
    "api-patterns": {
      "type": "skill",
      "version": "1.0.0",
      "path": "packages/api-patterns",
      "description": "REST API design patterns and conventions",
      "tags": ["api", "rest", "http", "design"]
    },
    "test-writer": {
      "type": "agent",
      "version": "1.0.0",
      "path": "packages/test-writer",
      "description": "Generates unit tests for your code",
      "tags": ["testing", "unit-tests", "tdd"]
    }
  }
}
```

---

## meta.json

**Location:** `{pkg.path}/meta.json` within the vault repo (e.g., `packages/code-review/meta.json`)

Per-package metadata. Fetched during install to get the entry filename and full metadata.

### Schema

```typescript
{
  name: string,         // package name (matches registry key)
  type: "skill" | "command" | "agent",
  version: string,      // semver (e.g., "1.0.0")
  description: string,  // full description
  author?: string,      // optional author name or GitHub handle
  tags?: string[],      // optional tags
  entry: string         // filename of the main .md file (e.g., "SKILL.md" or "command.md")
}
```

### Example

```json
{
  "name": "code-review",
  "type": "command",
  "version": "1.0.0",
  "description": "Deep code review with security analysis, covering OWASP top 10, code smells, and architectural issues.",
  "author": "dsiddharth2",
  "tags": ["review", "security", "quality"],
  "entry": "command.md"
}
```

---

## File Location Summary

| File                           | Purpose                               | Read by                    |
|--------------------------------|---------------------------------------|----------------------------|
| `~/.plugvault/config.json`     | Vault registry + auth config          | All operations             |
| `.plugvault/installed.json`    | Local installed package tracking      | install, remove, list, update |
| `~/.plugvault/installed.json`  | Global installed package tracking     | install, remove, list, update |
| `{vault}/registry.json`        | Package index for a vault             | browse, search, install, update |
| `{vault}/{pkg.path}/meta.json` | Per-package metadata + entry filename | install, update            |
