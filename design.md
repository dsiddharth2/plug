# Design — PlugVault CLI

## Problem
- Claude skills and commands are .md files scattered across projects with no sharing mechanism
- No way to discover, install, or update reusable Claude extensions
- Manual copy-paste between projects is error-prone and doesn't track versions

## Solution
Two-repo architecture: a Node.js CLI (`plug`) that fetches .md packages from GitHub-hosted registries (`plug-valut`). CLI reads a registry.json index, downloads meta.json + entry .md file, and places it in the correct `.claude/skills/` or `.claude/commands/` directory. Multiple vaults supported with resolve order priority.

## Data Model
`~/.plugvault/config.json`:
```json
{
  "vaults": {
    "official": {
      "url": "https://github.com/{owner}/plug-valut",
      "default": true,
      "branch": "main"
    }
  },
  "resolve_order": ["official"]
}
```

`.plugvault/installed.json`:
```json
{
  "code-review": {
    "vault": "official",
    "version": "1.0.0",
    "type": "command",
    "path": ".claude/commands/code-review.md",
    "installed_at": "2026-04-07T00:00:00Z"
  }
}
```

Registry `meta.json`:
```json
{
  "name": "code-review",
  "version": "1.0.0",
  "type": "command",
  "entry": "code-review.md",
  "description": "AI-powered code review slash command",
  "tags": ["review", "quality"]
}
```

## API Changes
N/A — CLI tool, no API

## What Gets Deleted
N/A — greenfield project

## What Stays / Adapts
| What | Change |
|------|--------|
| `.claude/skills/` | Target dir for skill-type packages |
| `.claude/commands/` | Target dir for command-type packages |

## Out of Scope
- Multi-file packages — v2
- Package publishing CLI — manual git push for now
