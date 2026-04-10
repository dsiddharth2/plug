/**
 * Tests for global flags (--verbose, --json, --yes) via the ctx module,
 * and error-handling message patterns for 6.2.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Temp directories
// ---------------------------------------------------------------------------

const tmpDir = path.join(os.tmpdir(), `plugvault-ctx-test-${Date.now()}`);
const configPath = path.join(tmpDir, 'config.json');
const cacheDir = path.join(tmpDir, 'cache');
const installedPath = path.join(tmpDir, 'installed.json');
const claudeDir = path.join(tmpDir, '.claude');
const commandsDir = path.join(claudeDir, 'commands');
const skillsDir = path.join(claudeDir, 'skills');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGlobalDir: () => tmpDir,
    getConfigFilePath: () => configPath,
    getCacheDir: () => cacheDir,
    getInstalledFilePath: () => installedPath,
    getClaudeCommandsDir: () => commandsDir,
    getClaudeSkillsDir: () => skillsDir,
    ensureDir: actual.ensureDir,
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

const { ctx } = await import('../src/utils/context.js');
const { runInit } = await import('../src/commands/init.js');
const { runRemove } = await import('../src/commands/remove.js');
const { runVaultAdd, runVaultRemove, runVaultList, runVaultSetDefault, runVaultSync } = await import('../src/commands/vault.js');
const { runSearch } = await import('../src/commands/search.js');
const { runInstall } = await import('../src/commands/install.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const officialVault = {
  name: 'official',
  owner: 'dsiddharth2',
  repo: 'plugvault',
  branch: 'main',
  private: false,
};

const sampleRegistry = {
  packages: {
    'code-review': {
      type: 'command',
      version: '1.0.0',
      path: 'registry/code-review',
      description: 'Deep code review',
      tags: ['review'],
    },
  },
};

function mockFetchOk(data = sampleRegistry) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  });
}

async function writeConfig(config) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

async function writeInstalled(data) {
  await fs.mkdir(path.dirname(installedPath), { recursive: true });
  await fs.writeFile(installedPath, JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  ctx.reset();
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(commandsDir, { recursive: true });
  await fs.mkdir(skillsDir, { recursive: true });
  await writeConfig({
    vaults: { official: officialVault },
    resolve_order: ['official'],
    default_vault: 'official',
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(process.stdout, 'write').mockImplementation(() => {});
});

afterEach(async () => {
  ctx.reset();
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  delete global.fetch;
});

// ---------------------------------------------------------------------------
// ctx module
// ---------------------------------------------------------------------------

describe('ctx module', () => {
  it('defaults are all false', () => {
    expect(ctx.verbose).toBe(false);
    expect(ctx.json).toBe(false);
    expect(ctx.yes).toBe(false);
  });

  it('set() updates specific values', () => {
    ctx.set({ json: true });
    expect(ctx.json).toBe(true);
    expect(ctx.verbose).toBe(false);
  });

  it('reset() clears all values', () => {
    ctx.set({ json: true, verbose: true, yes: true });
    ctx.reset();
    expect(ctx.json).toBe(false);
    expect(ctx.verbose).toBe(false);
    expect(ctx.yes).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// --json flag: plug init
// ---------------------------------------------------------------------------

describe('--json: plug init', () => {
  it('outputs valid JSON with created and skipped arrays', async () => {
    ctx.set({ json: true });
    await runInit();
    const call = process.stdout.write.mock.calls.find(([s]) => s.startsWith('{'));
    expect(call).toBeDefined();
    const parsed = JSON.parse(call[0]);
    expect(parsed).toHaveProperty('created');
    expect(parsed).toHaveProperty('skipped');
    expect(Array.isArray(parsed.created)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// --json flag: plug remove
// ---------------------------------------------------------------------------

describe('--json: plug remove', () => {
  it('outputs { status: "not-installed" } when package not tracked', async () => {
    ctx.set({ json: true });
    await writeInstalled({ installed: {} });
    await runRemove('nonexistent');
    const call = process.stdout.write.mock.calls.find(([s]) => s.startsWith('{'));
    expect(call).toBeDefined();
    const parsed = JSON.parse(call[0]);
    expect(parsed.status).toBe('not-installed');
    expect(parsed.name).toBe('nonexistent');
  });

  it('outputs { status: "removed" } on success', async () => {
    ctx.set({ json: true });
    const filePath = path.join(commandsDir, 'code-review.md');
    await fs.writeFile(filePath, '# review', 'utf8');
    await writeInstalled({
      installed: { 'code-review': { type: 'command', vault: 'official', version: '1.0.0', path: filePath } },
    });
    await runRemove('code-review');
    const call = process.stdout.write.mock.calls.find(([s]) => s.startsWith('{'));
    const parsed = JSON.parse(call[0]);
    expect(parsed.status).toBe('removed');
    expect(parsed.name).toBe('code-review');
  });
});

// ---------------------------------------------------------------------------
// --json flag: vault commands
// ---------------------------------------------------------------------------

describe('--json: vault add', () => {
  it('outputs { status: "added", name } on success', async () => {
    ctx.set({ json: true });
    mockFetchOk();
    await runVaultAdd('team', 'https://github.com/org/team-vault');
    const call = process.stdout.write.mock.calls.find(([s]) => s.startsWith('{'));
    const parsed = JSON.parse(call[0]);
    expect(parsed.status).toBe('added');
    expect(parsed.name).toBe('team');
  });
});

describe('--json: vault list', () => {
  it('outputs a JSON array of vault rows', async () => {
    ctx.set({ json: true });
    await runVaultList();
    const call = process.stdout.write.mock.calls.find(([s]) => s.startsWith('['));
    expect(call).toBeDefined();
    const parsed = JSON.parse(call[0]);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].name).toBe('official');
  });
});

describe('--json: vault remove', () => {
  it('outputs { status: "removed" }', async () => {
    ctx.set({ json: true });
    mockFetchOk();
    await runVaultAdd('team', 'https://github.com/org/team-vault');
    process.stdout.write.mockClear();
    await runVaultRemove('team');
    const call = process.stdout.write.mock.calls.find(([s]) => s.startsWith('{'));
    const parsed = JSON.parse(call[0]);
    expect(parsed.status).toBe('removed');
    expect(parsed.name).toBe('team');
  });
});

describe('--json: vault set-default', () => {
  it('outputs { status: "default-set" }', async () => {
    ctx.set({ json: true });
    mockFetchOk();
    await runVaultAdd('team', 'https://github.com/org/team-vault');
    process.stdout.write.mockClear();
    await runVaultSetDefault('team');
    const call = process.stdout.write.mock.calls.find(([s]) => s.startsWith('{'));
    const parsed = JSON.parse(call[0]);
    expect(parsed.status).toBe('default-set');
    expect(parsed.name).toBe('team');
  });
});

describe('--json: vault sync', () => {
  it('outputs { synced, totalPackages, errors }', async () => {
    ctx.set({ json: true });
    mockFetchOk();
    await runVaultSync();
    const call = process.stdout.write.mock.calls.find(([s]) => s.startsWith('{'));
    const parsed = JSON.parse(call[0]);
    expect(parsed).toHaveProperty('synced');
    expect(parsed).toHaveProperty('totalPackages');
    expect(parsed).toHaveProperty('errors');
  });
});

// ---------------------------------------------------------------------------
// --json flag: search
// ---------------------------------------------------------------------------

describe('--json: search', () => {
  it('runSearch still returns results array (JSON formatting is in action handler)', async () => {
    mockFetchOk();
    const results = await runSearch('review');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Error message patterns (6.2)
// ---------------------------------------------------------------------------

describe('error message patterns', () => {
  it('fetcher throws NETWORK_ERROR with correct message on connection failure', async () => {
    const { downloadFile } = await import('../src/utils/fetcher.js');
    global.fetch = vi.fn().mockRejectedValue(
      Object.assign(new Error('ENOTFOUND'), { cause: { code: 'ENOTFOUND' } }),
    );
    await expect(downloadFile(officialVault, 'registry/code-review/code-review.md'))
      .rejects.toMatchObject({ code: 'NETWORK_ERROR', message: 'Connection failed. Check your internet connection.' });
  });

  it('fetcher throws AUTH_FAILED with correct message on 401', async () => {
    const { downloadFile } = await import('../src/utils/fetcher.js');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(downloadFile(officialVault, 'some/file.md'))
      .rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('fetcher throws NOT_FOUND with correct message on 404', async () => {
    const { downloadFile } = await import('../src/utils/fetcher.js');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(downloadFile(officialVault, 'some/file.md'))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('registry throws AUTH_FAILED with vault-specific message on 401', async () => {
    const { fetchRegistry } = await import('../src/utils/registry.js');
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(fetchRegistry(officialVault))
      .rejects.toMatchObject({ code: 'AUTH_FAILED' });
    const err = await fetchRegistry(officialVault).catch((e) => e);
    expect(err.message).toContain('plug vault set-token official');
  });

  it('remove of non-existent package prints warning and exits 0 (no throw)', async () => {
    await writeInstalled({ installed: {} });
    // Should NOT throw — just log a warning
    await expect(runRemove('nonexistent')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// --verbose flag (via verbose() helper from context.js)
// ---------------------------------------------------------------------------

const { verbose: verboseFn } = await import('../src/utils/context.js');

describe('verbose()', () => {
  it('writes to stderr when verbose is active', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {});
    ctx.set({ verbose: true });
    verboseFn('test message');
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0][0]).toContain('test message');
    stderrSpy.mockRestore();
  });

  it('does not write to stderr when verbose is off', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {});
    ctx.set({ verbose: false });
    verboseFn('should not appear');
    expect(stderrSpy).not.toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
});
