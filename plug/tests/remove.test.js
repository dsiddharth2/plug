import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const tmpDir = path.join(os.tmpdir(), `plugvault-remove-test-${Date.now()}`);
const localInstalledFile = path.join(tmpDir, '.plugvault', 'installed.json');
const globalInstalledFile = path.join(tmpDir, 'global', '.plugvault', 'installed.json');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getInstalledFilePath: (global = false) =>
      global ? globalInstalledFile : localInstalledFile,
    ensureDir: actual.ensureDir,
  };
});

const { runRemove } = await import('../src/commands/remove.js');

describe('plug remove', () => {
  beforeEach(async () => {
    await fs.mkdir(path.dirname(localInstalledFile), { recursive: true });
    await fs.mkdir(path.dirname(globalInstalledFile), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('removes an installed package and deletes the file', async () => {
    // Create a fake installed .md file
    const fakeFile = path.join(tmpDir, '.claude', 'commands', 'code-review.md');
    await fs.mkdir(path.dirname(fakeFile), { recursive: true });
    await fs.writeFile(fakeFile, '# code-review', 'utf8');

    // Write installed.json with the package tracked
    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'code-review': { type: 'command', vault: 'official', version: '1.0.0', path: fakeFile },
        },
      }),
      'utf8',
    );

    await runRemove('code-review', {});

    // File should be deleted
    await expect(fs.access(fakeFile)).rejects.toThrow();

    // Should be removed from installed.json
    const data = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(data.installed['code-review']).toBeUndefined();
  });

  it('prints warning and returns when package is not installed', async () => {
    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({ installed: {} }),
      'utf8',
    );

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runRemove('nonexistent', {});
    consoleSpy.mockRestore();

    // No error thrown, function returns normally
  });

  it('removes from global scope with -g flag', async () => {
    const fakeFile = path.join(tmpDir, 'global', '.claude', 'skills', 'api-patterns.md');
    await fs.mkdir(path.dirname(fakeFile), { recursive: true });
    await fs.writeFile(fakeFile, '# api-patterns', 'utf8');

    await fs.writeFile(
      globalInstalledFile,
      JSON.stringify({
        installed: {
          'api-patterns': { type: 'skill', vault: 'official', version: '1.0.0', path: fakeFile },
        },
      }),
      'utf8',
    );

    await runRemove('api-patterns', { global: true });

    await expect(fs.access(fakeFile)).rejects.toThrow();

    const data = JSON.parse(await fs.readFile(globalInstalledFile, 'utf8'));
    expect(data.installed['api-patterns']).toBeUndefined();
  });

  it('still removes from tracker even if file is already gone (ENOENT)', async () => {
    const fakeFile = path.join(tmpDir, '.claude', 'commands', 'missing.md');

    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'missing': { type: 'command', vault: 'official', version: '1.0.0', path: fakeFile },
        },
      }),
      'utf8',
    );

    // File doesn't exist — should not throw
    await runRemove('missing', {});

    const data = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(data.installed['missing']).toBeUndefined();
  });

  it('removes an agent-type package and deletes the file', async () => {
    const fakeFile = path.join(tmpDir, '.claude', 'agents', 'code-agent.md');
    await fs.mkdir(path.dirname(fakeFile), { recursive: true });
    await fs.writeFile(fakeFile, '# code-agent', 'utf8');

    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'code-agent': { type: 'agent', vault: 'official', version: '1.0.0', path: fakeFile },
        },
      }),
      'utf8',
    );

    await runRemove('code-agent', {});

    await expect(fs.access(fakeFile)).rejects.toThrow();

    const data = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(data.installed['code-agent']).toBeUndefined();
  });

  it('does not touch global installed.json when removing locally', async () => {
    const fakeFile = path.join(tmpDir, '.claude', 'commands', 'code-review.md');
    await fs.mkdir(path.dirname(fakeFile), { recursive: true });
    await fs.writeFile(fakeFile, '# code-review', 'utf8');

    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'code-review': { type: 'command', vault: 'official', version: '1.0.0', path: fakeFile },
        },
      }),
      'utf8',
    );
    await fs.writeFile(
      globalInstalledFile,
      JSON.stringify({
        installed: {
          'code-review': { type: 'command', vault: 'official', version: '1.0.0', path: '/global/path.md' },
        },
      }),
      'utf8',
    );

    await runRemove('code-review', { global: false });

    const globalData = JSON.parse(await fs.readFile(globalInstalledFile, 'utf8'));
    expect(globalData.installed['code-review']).toBeDefined();
  });
});
