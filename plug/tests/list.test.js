import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const tmpDir = path.join(os.tmpdir(), `plugvault-list-test-${Date.now()}`);
const localInstalledFile = path.join(tmpDir, '.plugvault', 'installed.json');
const globalInstalledFile = path.join(tmpDir, 'global', '.plugvault', 'installed.json');
const configPath = path.join(tmpDir, 'config.json');
const cacheDir = path.join(tmpDir, 'cache');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGlobalDir: () => tmpDir,
    getConfigFilePath: () => configPath,
    getCacheDir: () => cacheDir,
    getInstalledFilePath: (global = false) =>
      global ? globalInstalledFile : localInstalledFile,
    ensureDir: actual.ensureDir,
  };
});

const sampleVault = { name: 'official', owner: 'plugvault', repo: 'plugvault', branch: 'main', private: false };

const sampleRegistry = {
  packages: {
    'code-review': { type: 'command', version: '1.0.0', path: 'registry/code-review', description: 'Code review command' },
    'api-patterns': { type: 'skill', version: '1.0.0', path: 'registry/api-patterns', description: 'API patterns skill' },
  },
};

const { runList } = await import('../src/commands/list.js');

describe('plug list', () => {
  beforeEach(async () => {
    await fs.mkdir(path.dirname(localInstalledFile), { recursive: true });
    await fs.mkdir(path.dirname(globalInstalledFile), { recursive: true });
    await fs.mkdir(cacheDir, { recursive: true });

    const config = {
      vaults: { official: sampleVault },
      resolve_order: ['official'],
      default_vault: 'official',
    };
    await fs.writeFile(configPath, JSON.stringify(config), 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('shows "No packages installed." when nothing installed', async () => {
    await fs.writeFile(localInstalledFile, JSON.stringify({ installed: {} }), 'utf8');
    await fs.writeFile(globalInstalledFile, JSON.stringify({ installed: {} }), 'utf8');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runList({});
    consoleSpy.mockRestore();
  });

  it('lists locally installed packages', async () => {
    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'code-review': { type: 'command', vault: 'official', version: '1.0.0', path: '/some/path.md' },
        },
      }),
      'utf8',
    );
    await fs.writeFile(globalInstalledFile, JSON.stringify({ installed: {} }), 'utf8');

    const output = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));
    await runList({});
    consoleSpy.mockRestore();

    const allOutput = output.join('\n');
    expect(allOutput).toContain('code-review');
    expect(allOutput).toContain('command');
    expect(allOutput).toContain('official');
    expect(allOutput).toContain('local');
  });

  it('lists both local and global installed packages', async () => {
    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'code-review': { type: 'command', vault: 'official', version: '1.0.0', path: '/local.md' },
        },
      }),
      'utf8',
    );
    await fs.writeFile(
      globalInstalledFile,
      JSON.stringify({
        installed: {
          'api-patterns': { type: 'skill', vault: 'official', version: '1.0.0', path: '/global.md' },
        },
      }),
      'utf8',
    );

    const output = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));
    await runList({});
    consoleSpy.mockRestore();

    const allOutput = output.join('\n');
    expect(allOutput).toContain('code-review');
    expect(allOutput).toContain('api-patterns');
    expect(allOutput).toContain('local');
    expect(allOutput).toContain('global');
  });

  it('filters by --type', async () => {
    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'code-review': { type: 'command', vault: 'official', version: '1.0.0', path: '/p.md' },
          'api-patterns': { type: 'skill', vault: 'official', version: '1.0.0', path: '/p.md' },
        },
      }),
      'utf8',
    );
    await fs.writeFile(globalInstalledFile, JSON.stringify({ installed: {} }), 'utf8');

    const output = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));
    await runList({ type: 'skill' });
    consoleSpy.mockRestore();

    const allOutput = output.join('\n');
    expect(allOutput).toContain('api-patterns');
    expect(allOutput).not.toContain('code-review');
  });

  it('filters by --vault', async () => {
    await fs.writeFile(
      localInstalledFile,
      JSON.stringify({
        installed: {
          'code-review': { type: 'command', vault: 'official', version: '1.0.0', path: '/p.md' },
          'other-pkg': { type: 'command', vault: 'community', version: '1.0.0', path: '/p2.md' },
        },
      }),
      'utf8',
    );
    await fs.writeFile(globalInstalledFile, JSON.stringify({ installed: {} }), 'utf8');

    const output = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));
    await runList({ vault: 'official' });
    consoleSpy.mockRestore();

    const allOutput = output.join('\n');
    expect(allOutput).toContain('code-review');
    expect(allOutput).not.toContain('other-pkg');
  });

  it('--remote lists all available packages from registry', async () => {
    // Cache the registry so no network call needed
    const { cacheRegistry } = await import('../src/utils/registry.js');
    await cacheRegistry('official', sampleRegistry);

    const output = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));
    await runList({ remote: true });
    consoleSpy.mockRestore();

    const allOutput = output.join('\n');
    expect(allOutput).toContain('code-review');
    expect(allOutput).toContain('api-patterns');
  });

  it('--remote with --type filter shows only matching packages', async () => {
    const { cacheRegistry } = await import('../src/utils/registry.js');
    await cacheRegistry('official', sampleRegistry);

    const output = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));
    await runList({ remote: true, type: 'skill' });
    consoleSpy.mockRestore();

    const allOutput = output.join('\n');
    expect(allOutput).toContain('api-patterns');
    expect(allOutput).not.toContain('code-review');
  });
});
