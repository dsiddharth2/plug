import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Temp directories for isolation
// ---------------------------------------------------------------------------

const tmpDir = path.join(os.tmpdir(), `plugvault-vault-test-${Date.now()}`);
const configPath = path.join(tmpDir, 'config.json');
const cacheDir = path.join(tmpDir, 'cache');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGlobalDir: () => tmpDir,
    getConfigFilePath: () => configPath,
    getCacheDir: () => cacheDir,
    ensureDir: actual.ensureDir,
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

const {
  parseGithubUrl,
  checkConnectivity,
  runVaultAdd,
  runVaultRemove,
  runVaultList,
  runVaultSetDefault,
  runVaultSetToken,
  runVaultSync,
} = await import('../src/commands/vault.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const officialVault = {
  name: 'official',
  owner: 'plugvault',
  repo: 'plugvault',
  branch: 'main',
  private: false,
};

const sampleRegistry = {
  packages: {
    'code-review': { type: 'command', version: '1.0.0', description: 'Code review' },
    'api-patterns': { type: 'skill', version: '1.0.0', description: 'API patterns' },
  },
};

function mockFetchOk(data = sampleRegistry) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function mockFetchStatus(status) {
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status });
}

async function writeConfig(config) {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

async function readConfig() {
  const raw = await fs.readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  // Seed default config
  await writeConfig({
    vaults: { official: officialVault },
    resolve_order: ['official'],
    default_vault: 'official',
  });
  // Silence stdout during tests
  vi.spyOn(process.stdout, 'write').mockImplementation(() => {});
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  delete global.fetch;
});

// ---------------------------------------------------------------------------
// parseGithubUrl
// ---------------------------------------------------------------------------

describe('parseGithubUrl', () => {
  it('parses https://github.com/owner/repo', () => {
    const result = parseGithubUrl('https://github.com/owner/repo');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('parses .git suffix', () => {
    const result = parseGithubUrl('https://github.com/owner/repo.git');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('parses URL with trailing slash', () => {
    const result = parseGithubUrl('https://github.com/owner/repo/');
    expect(result).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('returns null for non-GitHub URL', () => {
    expect(parseGithubUrl('https://gitlab.com/owner/repo')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkConnectivity
// ---------------------------------------------------------------------------

describe('checkConnectivity', () => {
  it('returns ok:true with data on success', async () => {
    mockFetchOk();
    const result = await checkConnectivity(officialVault);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(sampleRegistry);
  });

  it('returns ok:false with status on HTTP error', async () => {
    mockFetchStatus(404);
    const result = await checkConnectivity(officialVault);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it('returns ok:false with error on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));
    const result = await checkConnectivity(officialVault);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ENOTFOUND');
  });

  it('passes token in Authorization header', async () => {
    mockFetchOk();
    const vaultWithToken = { ...officialVault, token: 'mytoken' };
    await checkConnectivity(vaultWithToken);
    const call = global.fetch.mock.calls[0];
    expect(call[1].headers.Authorization).toBe('Bearer mytoken');
  });
});

// ---------------------------------------------------------------------------
// vault add
// ---------------------------------------------------------------------------

describe('vault add', () => {
  it('adds a vault and updates config', async () => {
    mockFetchOk();
    await runVaultAdd('myteam', 'https://github.com/myorg/myrepo');
    const config = await readConfig();
    expect(config.vaults.myteam).toMatchObject({ owner: 'myorg', repo: 'myrepo' });
    expect(config.resolve_order).toContain('myteam');
  });

  it('saves token when --token is provided', async () => {
    mockFetchOk();
    await runVaultAdd('private-vault', 'https://github.com/myorg/private', {
      token: 'secret123',
    });
    const config = await readConfig();
    expect(config.vaults['private-vault'].token).toBe('secret123');
  });

  it('marks vault as private when --private is set', async () => {
    mockFetchOk();
    await runVaultAdd('priv', 'https://github.com/org/repo', { private: true });
    const config = await readConfig();
    expect(config.vaults.priv.private).toBe(true);
  });

  it('throws on invalid URL', async () => {
    await expect(runVaultAdd('bad', 'not-a-url')).rejects.toThrow('Invalid URL');
  });

  it('throws on non-GitHub URL', async () => {
    await expect(
      runVaultAdd('bad', 'https://gitlab.com/owner/repo'),
    ).rejects.toThrow('Could not parse GitHub URL');
  });

  it('throws when vault name already exists', async () => {
    mockFetchOk();
    await runVaultAdd('myteam', 'https://github.com/myorg/myrepo');
    await expect(
      runVaultAdd('myteam', 'https://github.com/myorg/other'),
    ).rejects.toThrow("Vault 'myteam' already exists");
  });

  it('still adds vault when connectivity check returns 404', async () => {
    mockFetchStatus(404);
    await runVaultAdd('unreachable', 'https://github.com/org/repo');
    const config = await readConfig();
    expect(config.vaults.unreachable).toBeDefined();
  });

  it('still adds vault when network fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));
    await runVaultAdd('offline', 'https://github.com/org/repo');
    const config = await readConfig();
    expect(config.vaults.offline).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// vault remove
// ---------------------------------------------------------------------------

describe('vault remove', () => {
  beforeEach(async () => {
    mockFetchOk();
    await runVaultAdd('team', 'https://github.com/org/team-vault');
  });

  it('removes vault from config and resolve_order', async () => {
    await runVaultRemove('team');
    const config = await readConfig();
    expect(config.vaults.team).toBeUndefined();
    expect(config.resolve_order).not.toContain('team');
  });

  it('clears vault cache on removal', async () => {
    const cacheFile = path.join(cacheDir, 'team.json');
    await fs.writeFile(cacheFile, '{}', 'utf8');
    await runVaultRemove('team');
    await expect(fs.stat(cacheFile)).rejects.toThrow();
  });

  it('throws when vault does not exist', async () => {
    await expect(runVaultRemove('nonexistent')).rejects.toThrow("Vault 'nonexistent' not found");
  });

  it('throws when removing official vault without --force', async () => {
    await expect(runVaultRemove('official')).rejects.toThrow(
      'Cannot remove the official vault',
    );
  });

  it('removes official vault with --force', async () => {
    await runVaultRemove('official', { force: true });
    const config = await readConfig();
    expect(config.vaults.official).toBeUndefined();
  });

  it('resets default_vault when the default is removed', async () => {
    // Make team the default first
    await runVaultSetDefault('team');
    await runVaultRemove('team');
    const config = await readConfig();
    expect(config.default_vault).not.toBe('team');
  });
});

// ---------------------------------------------------------------------------
// vault list
// ---------------------------------------------------------------------------

describe('vault list', () => {
  it('returns rows for each vault', async () => {
    const rows = await runVaultList();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].name).toBe('official');
  });

  it('marks the default vault', async () => {
    const rows = await runVaultList();
    const defaultRow = rows.find((r) => r.default === 'yes');
    expect(defaultRow).toBeDefined();
    expect(defaultRow.name).toBe('official');
  });

  it('shows package count from cache', async () => {
    // Cache the official registry
    const { cacheRegistry } = await import('../src/utils/registry.js');
    await cacheRegistry('official', sampleRegistry);

    const rows = await runVaultList();
    const officialRow = rows.find((r) => r.name === 'official');
    expect(officialRow.packages).toBe('2');
  });

  it('shows - for package count when no cache', async () => {
    const rows = await runVaultList();
    const officialRow = rows.find((r) => r.name === 'official');
    expect(officialRow.packages).toBe('-');
  });

  it('shows correct visibility', async () => {
    mockFetchOk();
    await runVaultAdd('priv', 'https://github.com/org/repo', { private: true });
    const rows = await runVaultList();
    const privRow = rows.find((r) => r.name === 'priv');
    expect(privRow.visibility).toBe('private');
    const pubRow = rows.find((r) => r.name === 'official');
    expect(pubRow.visibility).toBe('public');
  });
});

// ---------------------------------------------------------------------------
// vault set-default
// ---------------------------------------------------------------------------

describe('vault set-default', () => {
  beforeEach(async () => {
    mockFetchOk();
    await runVaultAdd('team', 'https://github.com/org/team-vault');
  });

  it('updates default_vault in config', async () => {
    await runVaultSetDefault('team');
    const config = await readConfig();
    expect(config.default_vault).toBe('team');
  });

  it('moves the vault to top of resolve_order', async () => {
    await runVaultSetDefault('team');
    const config = await readConfig();
    expect(config.resolve_order[0]).toBe('team');
  });

  it('throws for unknown vault', async () => {
    await expect(runVaultSetDefault('unknown')).rejects.toThrow("Vault 'unknown' not found");
  });
});

// ---------------------------------------------------------------------------
// vault set-token
// ---------------------------------------------------------------------------

describe('vault set-token', () => {
  it('updates the token in config', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await runVaultSetToken('official', 'newtoken');
    const config = await readConfig();
    expect(config.vaults.official.token).toBe('newtoken');
  });

  it('tests connectivity after setting token', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await runVaultSetToken('official', 'newtoken');
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('throws for unknown vault', async () => {
    await expect(runVaultSetToken('unknown', 'token')).rejects.toThrow(
      "Vault 'unknown' not found",
    );
  });
});

// ---------------------------------------------------------------------------
// vault sync
// ---------------------------------------------------------------------------

describe('vault sync', () => {
  it('re-fetches all vaults and returns summary', async () => {
    mockFetchOk();
    const result = await runVaultSync();
    expect(result.synced).toBe(1);
    expect(result.totalPackages).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('clears cache before fetching (forces fresh data)', async () => {
    const { cacheRegistry } = await import('../src/utils/registry.js');
    const staleData = { packages: { old: { type: 'skill', version: '0.1.0' } } };
    await cacheRegistry('official', staleData);

    mockFetchOk(sampleRegistry);
    await runVaultSync();

    // After sync, cache should contain fresh data
    const { getCachedRegistry } = await import('../src/utils/registry.js');
    const cached = await getCachedRegistry('official');
    expect(Object.keys(cached.packages)).toHaveLength(2);
    expect(cached.packages['code-review']).toBeDefined();
  });

  it('records failed vaults in errors array', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const result = await runVaultSync();
    expect(result.errors).toContain('official');
    expect(result.synced).toBe(0);
  });

  it('syncs multiple vaults', async () => {
    mockFetchOk();
    await runVaultAdd('team', 'https://github.com/org/team-vault');

    // Both fetches succeed
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleRegistry,
    });

    const result = await runVaultSync();
    expect(result.synced).toBe(2);
    expect(result.totalPackages).toBe(4); // 2 packages × 2 vaults
  });
});

// ---------------------------------------------------------------------------
// Full vault lifecycle
// ---------------------------------------------------------------------------

describe('vault lifecycle', () => {
  it('add → list → set-default → set-token → sync → remove', async () => {
    // 1. Add
    mockFetchOk();
    await runVaultAdd('newvault', 'https://github.com/org/new-vault', { token: 'tok1' });
    let config = await readConfig();
    expect(config.vaults.newvault).toBeDefined();
    expect(config.resolve_order).toContain('newvault');

    // 2. List
    const rows = await runVaultList();
    expect(rows.map((r) => r.name)).toContain('newvault');

    // 3. Set-default
    await runVaultSetDefault('newvault');
    config = await readConfig();
    expect(config.default_vault).toBe('newvault');
    expect(config.resolve_order[0]).toBe('newvault');

    // 4. Set-token
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await runVaultSetToken('newvault', 'tok2');
    config = await readConfig();
    expect(config.vaults.newvault.token).toBe('tok2');

    // 5. Sync
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleRegistry,
    });
    const syncResult = await runVaultSync();
    expect(syncResult.synced).toBe(2);

    // 6. Remove
    await runVaultRemove('newvault');
    config = await readConfig();
    expect(config.vaults.newvault).toBeUndefined();
    expect(config.resolve_order).not.toContain('newvault');
  });
});
