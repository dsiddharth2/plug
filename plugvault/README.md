# plugvault — Official Registry

The official vault of Claude skills and commands, installable via the [plugvault CLI](https://github.com/dsiddharth2/plug).

```bash
npm install -g plugvault
plug install code-review
```

---

## Available Packages

### Commands

Commands are invoked in Claude with `/command-name`.

| Name | Description | Tags |
|------|-------------|------|
| [code-review](registry/code-review/code-review.md) | Deep code review with security & performance analysis | review, quality, security, performance |

### Skills

Skills are loaded automatically as project context.

| Name | Description | Tags |
|------|-------------|------|
| [api-patterns](registry/api-patterns/api-patterns.md) | Enforces consistent API design patterns | api, rest, design, patterns |

---

## Quick Start

```bash
# Install the CLI
npm install -g plugvault

# Initialize a project
cd my-project
plug init

# Install a package
plug install code-review

# List all available packages
plug list --remote
```

---

## Registry Structure

```
plugvault/
  registry.json                      # Package index
  registry/
    code-review/
      meta.json                      # Package metadata
      code-review.md                 # Command content
    api-patterns/
      meta.json
      api-patterns.md
```

`registry.json` is the index file the CLI fetches first. Each package entry points to a subdirectory containing `meta.json` and the content `.md` file.

---

## Contributing

Want to add a skill or command to this registry? See [CONTRIBUTING.md](CONTRIBUTING.md).
