import fs from 'fs';
import tty from 'tty';

/**
 * Resolves the stdin stream to use for the TUI.
 *
 * When stdin is already a TTY, returns process.stdin directly.
 * When stdin is piped (e.g. launched via `! plug` from Claude Code),
 * attempts to reopen the controlling terminal so Ink's raw mode works.
 *
 * @param {object} overrides - For testing: { isTTY, openSync, ReadStream }
 * @returns {import('stream').Readable} A readable stream that supports raw mode
 * @throws {Error} When no interactive terminal can be obtained
 */
export function resolveStdin({
  isTTY = process.stdin.isTTY,
  openSync = fs.openSync,
  ReadStream = tty.ReadStream,
} = {}) {
  if (isTTY) {
    return process.stdin;
  }

  // stdin is piped — try to reopen the controlling terminal
  const candidates = ['/dev/tty', '\\\\.\\CONIN$'];
  for (const path of candidates) {
    let fd;
    try {
      fd = openSync(path, 'r');
    } catch {
      continue;
    }
    return new ReadStream(fd);
  }

  throw new Error(
    'PlugVault TUI requires an interactive terminal.\n' +
    '- From Claude Code: run `! plug`\n' +
    '- Directly: run `plug` or `npx plugvault` in your terminal\n' +
    '- For scripting: use `plug install <pkg>`, `plug search <q>`, etc.'
  );
}
