# Contributing to plugvault

Thank you for your interest in contributing. This document covers contributing to the **CLI itself**. To contribute new skills or commands to the registry, see [plugvault/CONTRIBUTING.md](../plugvault/CONTRIBUTING.md).

---

## Development Setup

**Requirements:** Node.js 18+, npm

```bash
git clone https://github.com/dsiddharth2/plug
cd plug
npm install
npm test         # run all tests
```

The CLI entry point is `bin/plug.js`, which loads `src/index.js`. All command logic lives in `src/commands/`. Shared utilities are in `src/utils/`.

---

## Project Structure

```
plug/
  bin/plug.js             # CLI entry point (shebang)
  src/
    index.js              # Commander setup, global flags
    constants.js          # Default paths, URLs, TTLs
    commands/
      init.js             # plug init
      install.js          # plug install
      remove.js           # plug remove
      list.js             # plug list
      search.js           # plug search
      update.js           # plug update
      vault.js            # plug vault *
    utils/
      paths.js            # OS-aware path helpers
      config.js           # Config read/write
      auth.js             # Token resolution
      registry.js         # Fetch/cache registry.json
      fetcher.js          # Download files from vaults
      tracker.js          # installed.json read/write
      context.js          # Global flag singleton (--verbose, --json, --yes)
      ui.js               # Spinner abstraction (TTY-aware)
  tests/                  # vitest test files (mirror of src/)
```

---

## Code Style

- **ESM only** — use `import`/`export`, never `require()`.
- **No transpilation** — code runs directly on Node 18+; avoid syntax that requires a build step.
- **Native fetch** — use the built-in `fetch` (Node 18+). Do not add `node-fetch`.
- **Error messages match the spec** — error strings in `fetcher.js`, `registry.js`, and the commands are tested literally. Do not change them without updating the tests.
- **No stack traces to users** — all command actions catch errors and print `chalk.red(err.message)` before `process.exit(1)`.

---

## Adding a New Command

1. Create `src/commands/<name>.js` and export a `register<Name>(program)` function.
2. Import and call it in `src/index.js`.
3. Read `ctx` from `src/utils/context.js` for `--json`, `--verbose`, and `--yes` support.
4. Use `createSpinner` from `src/utils/ui.js` for any network operations.
5. Add tests in `tests/<name>.test.js`.

Minimal command skeleton:

```js
import chalk from 'chalk';
import { ctx } from '../utils/context.js';

export function registerMyCommand(program) {
  program
    .command('my-command <arg>')
    .description('Does something useful')
    .action(async (arg, options) => {
      try {
        await runMyCommand(arg, options);
      } catch (err) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });
}

export async function runMyCommand(arg, options = {}) {
  // implementation
}
```

---

## Testing

Tests use [vitest](https://vitest.dev/). Each utility and command module has a corresponding test file in `tests/`.

```bash
npm test              # run all tests once
npx vitest            # watch mode
```

**Test conventions:**
- Mock `fs`, `fetch`, and path utilities — tests must not touch the real filesystem or network.
- Export the core logic function (`runInstall`, `runSearch`, etc.) separately from `registerX` so it can be unit-tested directly.
- Keep tests deterministic — do not rely on timing or environment variables unless you set them in the test.

---

## Submitting a Pull Request

1. Fork the repo and create a feature branch from `main`.
2. Make your changes and add tests.
3. Ensure `npm test` passes with no failures.
4. Open a pull request with a clear description of what changed and why.

For significant changes (new commands, breaking changes to config format), open an issue first to discuss the design.
