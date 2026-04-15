# Non-TTY Guard

## Purpose

plug's interactive TUI requires a real terminal (TTY). When `plug` is invoked in a non-interactive context — piped input, CI runners, Claude Code's Bash tool, VS Code task runners — there is no terminal to render into. Without a guard, Ink attempts to call `setRawMode` on a non-TTY stdin, which throws `EPERM` and produces a confusing Node/React stack trace instead of a clear error.

The guard detects this condition early and exits with a human-readable message before any Ink initialisation occurs.

## Placement

The guard lives at the top of `launchTui()` in `src/index.js`, immediately after the function is entered and **before**:
- `resolveStdin()` (which would call `setRawMode`)
- alt-screen entry (`\x1b[?1049h`)
- `render()` (Ink)

```js
async function launchTui() {
  if (!process.stdin.isTTY) {
    console.error(
      "plug requires an interactive terminal (TTY).\n" +
      "It cannot be rendered here — this looks like a non-TTY context such as:\n" +
      "  - Claude Code's Bash tool\n" +
      "  - a piped shell (e.g. `plug | cat`, `plug < /dev/null`)\n" +
      "  - a CI runner\n" +
      "  - a VS Code task runner\n" +
      "Run plug directly in a terminal (Windows Terminal, PowerShell, bash, etc.)."
    );
    process.exit(1);
  }
  // ...
}
```

`process.stdin.isTTY` is `undefined` (falsy) when stdin is not a terminal, and `true` when it is. This is a Node.js built-in — no extra dependency.

## What the message names

The error message deliberately names **Claude Code's Bash tool** because that is the most common non-TTY context users encounter. The Bash tool runs commands with piped stdio, so `isTTY` is `undefined`. The message also lists other common non-TTY contexts so users in CI or VS Code get the same clear explanation.

## Non-interactive CLI paths are not gated

The guard only runs inside `launchTui()`. Commands that go through `program.parse()` — including `--version`, `--help`, `install`, `search`, `list`, `update`, `vault` — are never gated by the TTY check. This is intentional: scripting use cases must work in any environment.

```
plug --version        → program.parse() → no guard
plug install foo      → program.parse() → no guard
plug                  → launchTui() → guard fires if not TTY
plug tui              → launchTui() → guard fires if not TTY
```

## Testing

`tests/tui/non-tty-guard.test.js` spawns `node bin/plug.js` with `stdio: ['pipe', 'pipe', 'pipe']`. This gives the child process a piped (non-TTY) stdin without monkey-patching `process.stdin.isTTY`, which makes the test an accurate simulation of the real condition.

Tests assert:
- Exit code is `1`
- Stderr contains the guard message
- No Ink/React stack trace appears
- `--version` still exits `0` and returns the package version
