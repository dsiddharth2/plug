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

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
  confirm: vi.fn(),
}));

const { runRemove } = await import('../src/commands/remove.js');
const { select, confirm } = await import('@inquirer/prompts');
const { ctx } = await import('../src/utils/context.js');

describe('plug remove', () => {
  beforeEach(async () => {
    await fs.mkdir(path.dirname(localInstalledFile), { recursive: true });
    await fs.mkdir(path.dirname(globalInstalledFile), { recursive: true });
    vi.clearAllMocks();
    ctx.reset();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    ctx.reset();
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

  // Phase 4 dependent check tests

  it('package with dependents triggers select prompt', async () => {
    const fakeFile = path.join(tmpDir, '.claude', 'commands', 'pkg-x.md');
    await fs.mkdir(path.dirname(fakeFile), { recursive: true });
    await fs.writeFile(fakeFile, '# pkg-x', 'utf8');

    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'pkg-x': {
            type: 'command', vault: 'official', version: '1.0.0', path: fakeFile,
            installed_as: 'explicit', dependents: ['pkg-a'],
          },
          'pkg-a': {
            type: 'command', vault: 'official', version: '1.0.0',
            path: path.join(tmpDir, '.claude', 'commands', 'pkg-a.md'),
            installed_as: 'explicit', dependents: [],
          },
        },
      }),
      'utf8',
    );

    select.mockResolvedValue('cancel');

    await runRemove('pkg-x', {});

    expect(select).toHaveBeenCalledOnce();
    const callArgs = select.mock.calls[0][0];
    expect(callArgs.message).toContain('pkg-a');
  });

  it('cancel leaves both packages in place', async () => {
    const pkgXFile = path.join(tmpDir, '.claude', 'commands', 'pkg-x.md');
    const pkgAFile = path.join(tmpDir, '.claude', 'commands', 'pkg-a.md');
    await fs.mkdir(path.dirname(pkgXFile), { recursive: true });
    await fs.writeFile(pkgXFile, '# pkg-x', 'utf8');
    await fs.writeFile(pkgAFile, '# pkg-a', 'utf8');

    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'pkg-x': {
            type: 'command', vault: 'official', version: '1.0.0', path: pkgXFile,
            installed_as: 'explicit', dependents: ['pkg-a'],
          },
          'pkg-a': {
            type: 'command', vault: 'official', version: '1.0.0', path: pkgAFile,
            installed_as: 'explicit', dependents: [],
          },
        },
      }),
      'utf8',
    );

    select.mockResolvedValue('cancel');

    await runRemove('pkg-x', {});

    // Both files should still exist
    await expect(fs.access(pkgXFile)).resolves.toBeUndefined();
    await expect(fs.access(pkgAFile)).resolves.toBeUndefined();

    // Both should still be in tracker
    const data = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(data.installed['pkg-x']).toBeDefined();
    expect(data.installed['pkg-a']).toBeDefined();
  });

  it('cascade removes target and all dependents', async () => {
    const pkgXFile = path.join(tmpDir, '.claude', 'commands', 'pkg-x.md');
    const pkgAFile = path.join(tmpDir, '.claude', 'commands', 'pkg-a.md');
    await fs.mkdir(path.dirname(pkgXFile), { recursive: true });
    await fs.writeFile(pkgXFile, '# pkg-x', 'utf8');
    await fs.writeFile(pkgAFile, '# pkg-a', 'utf8');

    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'pkg-x': {
            type: 'command', vault: 'official', version: '1.0.0', path: pkgXFile,
            installed_as: 'explicit', dependents: ['pkg-a'],
          },
          'pkg-a': {
            type: 'command', vault: 'official', version: '1.0.0', path: pkgAFile,
            installed_as: 'explicit', dependents: [],
          },
        },
      }),
      'utf8',
    );

    select.mockResolvedValue('cascade');

    await runRemove('pkg-x', {});

    // Both files should be deleted
    await expect(fs.access(pkgXFile)).rejects.toThrow();
    await expect(fs.access(pkgAFile)).rejects.toThrow();

    // Both should be removed from tracker
    const data = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(data.installed['pkg-x']).toBeUndefined();
    expect(data.installed['pkg-a']).toBeUndefined();
  });

  it('force removes only target and severs dependent edges', async () => {
    const pkgXFile = path.join(tmpDir, '.claude', 'commands', 'pkg-x.md');
    const pkgAFile = path.join(tmpDir, '.claude', 'commands', 'pkg-a.md');
    await fs.mkdir(path.dirname(pkgXFile), { recursive: true });
    await fs.writeFile(pkgXFile, '# pkg-x', 'utf8');
    await fs.writeFile(pkgAFile, '# pkg-a', 'utf8');

    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'pkg-x': {
            type: 'command', vault: 'official', version: '1.0.0', path: pkgXFile,
            installed_as: 'explicit', dependents: ['pkg-a'],
          },
          'pkg-a': {
            type: 'command', vault: 'official', version: '1.0.0', path: pkgAFile,
            installed_as: 'explicit', dependents: ['pkg-x'],
          },
        },
      }),
      'utf8',
    );

    select.mockResolvedValue('force');

    await runRemove('pkg-x', {});

    // Only pkg-x file should be deleted
    await expect(fs.access(pkgXFile)).rejects.toThrow();
    await expect(fs.access(pkgAFile)).resolves.toBeUndefined();

    // pkg-x removed from tracker; pkg-a still present
    const data = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(data.installed['pkg-x']).toBeUndefined();
    expect(data.installed['pkg-a']).toBeDefined();

    // Edge severed: pkg-a.dependents no longer contains 'pkg-x'
    expect(data.installed['pkg-a'].dependents).not.toContain('pkg-x');
  });

  it('orphan prompt fires after remove when orphans exist', async () => {
    const pkgAFile = path.join(tmpDir, '.claude', 'commands', 'pkg-a.md');
    await fs.mkdir(path.dirname(pkgAFile), { recursive: true });
    await fs.writeFile(pkgAFile, '# pkg-a', 'utf8');

    // dep-x is a dependency with no dependents — already a prunable orphan
    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'pkg-a': {
            type: 'command', vault: 'official', version: '1.0.0', path: pkgAFile,
            installed_as: 'explicit', dependents: [],
          },
          'dep-x': {
            type: 'command', vault: 'official', version: '1.0.0',
            path: path.join(tmpDir, '.claude', 'commands', 'dep-x.md'),
            installed_as: 'dependency', dependents: [],
          },
        },
      }),
      'utf8',
    );

    confirm.mockResolvedValue(false);

    await runRemove('pkg-a', {});

    // Orphan prompt should have fired
    expect(confirm).toHaveBeenCalledOnce();

    // dep-x still in tracker (user declined)
    const data = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(data.installed['dep-x']).toBeDefined();
  });

  it('--yes auto-prunes orphans without prompting', async () => {
    const pkgAFile = path.join(tmpDir, '.claude', 'commands', 'pkg-a.md');
    const depXFile = path.join(tmpDir, '.claude', 'commands', 'dep-x.md');
    await fs.mkdir(path.dirname(pkgAFile), { recursive: true });
    await fs.writeFile(pkgAFile, '# pkg-a', 'utf8');
    await fs.writeFile(depXFile, '# dep-x', 'utf8');

    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'pkg-a': {
            type: 'command', vault: 'official', version: '1.0.0', path: pkgAFile,
            installed_as: 'explicit', dependents: [],
          },
          'dep-x': {
            type: 'command', vault: 'official', version: '1.0.0', path: depXFile,
            installed_as: 'dependency', dependents: [],
          },
        },
      }),
      'utf8',
    );

    ctx.set({ yes: true });

    await runRemove('pkg-a', {});

    // confirm should NOT have been called (--yes skips prompt)
    expect(confirm).not.toHaveBeenCalled();

    // dep-x should be auto-pruned
    const data = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(data.installed['dep-x']).toBeUndefined();
  });
});
