import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.resolve(__dirname, '../../bin/plug.js');

describe('non-TTY guard', () => {
  it('exits with code 1 and prints guard message when stdin is not a TTY', () => {
    const result = spawnSync(process.execPath, [BIN], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(result.status).toBe(1);
    const stderr = result.stderr.toString();
    expect(stderr).toContain('plug requires an interactive terminal (TTY).');
    expect(stderr).toContain("Claude Code's Bash tool");
    expect(stderr).toContain('Run plug directly in a terminal');
  });

  it('does not emit a React/Ink stack trace on non-TTY stdin', () => {
    const result = spawnSync(process.execPath, [BIN], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const combined = result.stdout.toString() + result.stderr.toString();
    expect(combined).not.toContain('setRawMode');
    expect(combined).not.toContain('at <App>');
  });

  it('--version is unaffected by the non-TTY guard (stdout contains package version)', () => {
    const result = spawnSync(process.execPath, [BIN, '--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(result.status).toBe(0);
    const stdout = result.stdout.toString().trim();
    expect(stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
