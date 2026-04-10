# PlugVault

A package manager for Claude Code. Install reusable skills, commands, and agents into any project from GitHub-hosted registries.

---

## What is this?

[Claude Code](https://docs.anthropic.com/en/docs/claude-code) supports three types of extensions:

- **Skills** (`.claude/skills/*.md`) — background context that shapes how Claude works in your project. Think coding standards, API patterns, architecture rules.
- **Commands** (`.claude/commands/*.md`) — on-demand actions you invoke with `/command-name`. Think code review, test generation, documentation.
- **Agents** (`.claude/agents/*.md`) — specialized sub-agents that Claude can delegate tasks to via the `Agent` tool. Think background research, long-running analysis, parallel workstreams.

These are just markdown files. `plug` makes it easy to share, discover, and install them across projects — like npm, but for `.md` files.

---

## Quick Start

```bash
npm install -g plugvault
plug init
plug install code-review
```

For full documentation on CLI commands, flags, vaults, and authentication, see the [CLI README](plug/README.md).

---

## Creating Packages

To publish skills, commands, or agents to a vault:

1. **Learn the package format** — see the [Skill Authoring Guide](plug/docs/authoring-guide.md) for structure, meta.json schema, and templates
2. **Create your package** — write the `.md` content and `meta.json` metadata
3. **Test locally** — use `plug install` to verify your package works
4. **Submit to a vault** — open a PR to the vault's registry

---

## Contributing

Development setup and code style guidelines — see [CONTRIBUTING.md](plug/CONTRIBUTING.md).

To contribute packages to the official vault, see the [vault CONTRIBUTING guide](https://github.com/dsiddharth2/plugvault/blob/main/CONTRIBUTING.md).

---

## License

MIT
