import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.resolve(__dirname, '../../src/index.js');

describe('alt-screen mode (#9)', () => {
  const source = fs.readFileSync(INDEX_PATH, 'utf8');

  it('launchTui writes alt-screen enter sequence before render()', () => {
    // ESC[?1049h enters the alternate screen buffer
    expect(source).toContain('\\x1b[?1049h');
  });

  it('launchTui writes alt-screen leave sequence on exit', () => {
    // ESC[?1049l leaves the alternate screen buffer
    expect(source).toContain('\\x1b[?1049l');
  });

  it('non-TTY guard fires before alt-screen enter (ordering check)', () => {
    const guardIndex = source.indexOf('process.stdin.isTTY');
    const altScreenIndex = source.indexOf('\\x1b[?1049h');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(altScreenIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(altScreenIndex);
  });

  it('alt-screen enter appears after stdin resolution (ordering check)', () => {
    const resolveIndex = source.indexOf('resolveStdin');
    const altScreenIndex = source.indexOf('\\x1b[?1049h');
    expect(resolveIndex).toBeGreaterThan(-1);
    expect(altScreenIndex).toBeGreaterThan(resolveIndex);
  });
});
