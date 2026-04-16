# Authoring Guide

Learn how to create, test, and publish extensions for Claude Code using Plug.

## Extension Types

Plug supports three types of extensions. Each is a Markdown (`.md`) file:

1.  **Skills** (`.claude/skills/*.md`): Procedural knowledge and workflows. Claude automatically activates these when they match the context.
2.  **Commands** (`.claude/commands/*.md`): Slash commands for explicit tasks (e.g., `/lint`, `/test-gen`).
3.  **Agents** (`.claude/agents/*.md`): Specialized sub-agents Claude can delegate complex tasks to.

---

## Package Structure

A package consists of:
1.  **Entry Point**: A `.md` file with the extension's logic and frontmatter.
2.  **Metadata**: A `meta.json` file describing the package.

### Example Package File (`packages/code-review/command.md`)

```markdown
---
name: code-review
description: "Deep code review with security analysis"
argument-hint: "[scope]"
allowed-tools: ["Read", "Edit", "Bash", "Grep"]
---

# Code Review Command

You are a senior software architect performing a deep code review.
Focus on:
1.  Security (OWASP Top 10)
2.  Code Smells & Readability
3.  Architectural Alignment
```

### Example Metadata (`packages/code-review/meta.json`)

```json
{
  "name": "code-review",
  "type": "command",
  "version": "1.0.0",
  "description": "Deep code review with security analysis, covering OWASP Top 10 and architectural issues.",
  "author": "dsiddharth2",
  "tags": ["review", "security", "quality"],
  "entry": "command.md"
}
```

---

## Registry Schema

A Vault's `registry.json` indexes all available packages.

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
    }
  }
}
```

---

## Authoring Workflow

### 1. Develop Locally
Create your extension file directly in your project's `.claude/` directory and test it manually within Claude Code.

### 2. Create your Vault Repository
Create a GitHub repository (e.g., `my-claude-extensions`). Initialize it with:
*   `registry.json` at the root.
*   A directory for each package containing the `.md` file and `meta.json`.

### 3. Test with Plug
Add your local or GitHub repository as a vault to verify Plug can install it:

```bash
# Add local vault
plug vault add my-extensions /path/to/my-repo

# Test install
plug install my-extensions/code-review
```

### 4. Publish
Push your changes to GitHub. If you're contributing to a shared vault (like the official one), submit a Pull Request.

---

## Best Practices

*   **Frontmatter**: Ensure all required frontmatter fields (`name`, `description`, `allowed-tools`) are present and accurate.
*   **Version Management**: Always increment the version in both `meta.json` and `registry.json` when making changes.
*   **Tags**: Use descriptive tags to improve search discoverability within the Plug TUI.
*   **Documentation**: Keep your extension's description concise but informative.
