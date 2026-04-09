# Contributing to plugvault Registry

This document covers adding new skills and commands to the **official plugvault registry**. For a full explanation of the package format, see the [Skill Authoring Guide](https://github.com/plugvault/plug/blob/main/docs/authoring-guide.md).

---

## Before You Start

Check the existing packages in [registry.json](registry.json) to avoid duplicates. If a similar package already exists, consider improving it rather than adding a new one.

---

## Adding a Package

### 1. Fork and clone

```bash
git clone https://github.com/your-username/plugvault
cd plugvault
```

### 2. Create your package directory

```bash
mkdir registry/my-package
```

### 3. Create meta.json

```json
{
  "name": "my-package",
  "type": "command",
  "version": "1.0.0",
  "description": "One-line description for search results",
  "author": "your-github-username",
  "tags": ["tag1", "tag2"],
  "entry": "my-package.md"
}
```

- `type` must be `"command"` or `"skill"`
- `name` must be lowercase, hyphen-separated, and unique in the registry
- `name` must match the directory name and the `entry` filename (without `.md`)

### 4. Create the content file

Create `registry/my-package/my-package.md` with your skill or command content.

See the [authoring guide](https://github.com/plugvault/plug/blob/main/docs/authoring-guide.md) for templates and best practices.

### 5. Register in registry.json

Add your package under the `packages` object in `registry.json`:

```json
"my-package": {
  "type": "command",
  "version": "1.0.0",
  "path": "registry/my-package",
  "description": "One-line description for search results",
  "tags": ["tag1", "tag2"]
}
```

The `version`, `description`, and `tags` must match `meta.json`.

### 6. Test your package

```bash
npm install -g plugvault

# Add a local vault pointing at your fork
plug vault add my-fork https://github.com/your-username/plugvault
plug vault sync

# Install and verify
plug install my-fork/my-package
plug list
```

Confirm the file is in `.claude/commands/` (commands) or `.claude/skills/` (skills) and works correctly in a Claude conversation.

### 7. Open a pull request

Open a PR against the `main` branch. Your PR description should include:

- What the package does and why it's useful
- An example of how it's used in Claude
- Any limitations or assumptions (e.g., language-specific, framework-specific)

---

## Updating an Existing Package

1. Edit the `.md` file and/or `meta.json` in `registry/<package-name>/`
2. Bump the `version` field in both `meta.json` and `registry.json` (use semantic versioning)
3. Open a PR with a description of what changed

---

## Review Criteria

Pull requests are reviewed for:

- **Correctness** — the package works as described
- **Quality** — clear, specific instructions that produce reliable Claude behavior
- **Uniqueness** — not a near-duplicate of an existing package
- **Safety** — no instructions that could cause harmful or unintended behavior

---

## Package Naming Conventions

- Lowercase, hyphen-separated: `code-review`, `api-patterns`, `test-writer`
- Descriptive but concise — the name should hint at what it does
- No vendor names or brand names unless you own them
- No generic names that could conflict with common CLI tools (`init`, `build`, `test`)
