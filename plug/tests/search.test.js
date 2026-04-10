import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Temp directories for isolation
// ---------------------------------------------------------------------------

const tmpDir = path.join(os.tmpdir(), `plugvault-search-test-${Date.now()}`);
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
// Imports (after mocks)
// ---------------------------------------------------------------------------

const { runSearch } = await import('../src/commands/search.js');

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
      description: 'Deep code review with security & performance analysis',
      tags: ['review', 'quality', 'security', 'performance'],
    },
    'api-patterns': {
      type: 'skill',
      version: '1.0.0',
      description: 'Enforces consistent API design patterns',
      tags: ['api', 'rest', 'design', 'patterns'],
    },
  },
};

function mockFetchOk(data = sampleRegistry) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

async function writeConfig(config) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await writeConfig({
    vaults: { official: officialVault },
    resolve_order: ['official'],
    default_vault: 'official',
  });
  vi.spyOn(process.stdout, 'write').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  delete global.fetch;
});

// ---------------------------------------------------------------------------
// Scoring and matching
// ---------------------------------------------------------------------------

describe('runSearch — keyword matching', () => {
  it('finds package by exact name match', async () => {
    mockFetchOk();
    const results = await runSearch('code-review');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('code-review');
  });

  it('finds package by partial name match', async () => {
    mockFetchOk();
    const results = await runSearch('review');
    expect(results.some((r) => r.name === 'code-review')).toBe(true);
  });

  it('finds package by description keyword', async () => {
    mockFetchOk();
    const results = await runSearch('security');
    expect(results.some((r) => r.name === 'code-review')).toBe(true);
  });

  it('finds package by tag match', async () => {
    mockFetchOk();
    const results = await runSearch('rest');
    expect(results.some((r) => r.name === 'api-patterns')).toBe(true);
  });

  it('returns empty array when nothing matches', async () => {
    mockFetchOk();
    const results = await runSearch('nonexistent-xyz');
    expect(results).toHaveLength(0);
  });

  it('is case-insensitive', async () => {
    mockFetchOk();
    const results = await runSearch('REVIEW');
    expect(results.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Result ordering (score)
// ---------------------------------------------------------------------------

describe('runSearch — result ordering', () => {
  it('exact name match scores higher than partial name match', async () => {
    const registry = {
      packages: {
        review: { type: 'command', version: '1.0.0', description: 'A review tool', tags: [] },
        'code-review': {
          type: 'command',
          version: '1.0.0',
          description: 'Code analysis',
          tags: [],
        },
      },
    };
    mockFetchOk(registry);
    const results = await runSearch('review');
    expect(results[0].name).toBe('review'); // exact match first
  });

  it('partial name match scores higher than description match', async () => {
    const registry = {
      packages: {
        'review-tool': { type: 'command', version: '1.0.0', description: 'No match here', tags: [] },
        other: { type: 'command', version: '1.0.0', description: 'review your code', tags: [] },
      },
    };
    mockFetchOk(registry);
    const results = await runSearch('review');
    expect(results[0].name).toBe('review-tool'); // partial name > description
  });
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe('runSearch — --type filter', () => {
  it('filters by type=command', async () => {
    mockFetchOk();
    const results = await runSearch('review', { type: 'command' });
    expect(results.every((r) => r.pkg.type === 'command')).toBe(true);
    expect(results.some((r) => r.name === 'code-review')).toBe(true);
  });

  it('filters by type=skill', async () => {
    mockFetchOk();
    const results = await runSearch('api', { type: 'skill' });
    expect(results.every((r) => r.pkg.type === 'skill')).toBe(true);
    expect(results.some((r) => r.name === 'api-patterns')).toBe(true);
  });

  it('returns empty when type filter excludes all matches', async () => {
    mockFetchOk();
    const results = await runSearch('code-review', { type: 'skill' });
    expect(results).toHaveLength(0);
  });
});

describe('runSearch — --vault filter', () => {
  it('searches only the specified vault', async () => {
    mockFetchOk();
    const results = await runSearch('review', { vault: 'official' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.vault.name === 'official')).toBe(true);
  });

  it('throws when vault does not exist in config', async () => {
    mockFetchOk();
    await expect(runSearch('review', { vault: 'nonexistent' })).rejects.toThrow(
      "Vault 'nonexistent' not found"
    );
  });
});

// ---------------------------------------------------------------------------
// Multi-vault search
// ---------------------------------------------------------------------------

describe('runSearch — multi-vault', () => {
  it('searches multiple vaults and deduplicates by vault source', async () => {
    // Add a second vault to config
    await fs.writeFile(
      configPath,
      JSON.stringify({
        vaults: {
          official: officialVault,
          team: { name: 'team', owner: 'org', repo: 'team-vault', branch: 'main', private: false },
        },
        resolve_order: ['official', 'team'],
        default_vault: 'official',
      }),
      'utf8'
    );

    const teamRegistry = {
      packages: {
        'team-linter': {
          type: 'command',
          version: '1.0.0',
          description: 'Team linting rules',
          tags: ['lint', 'review'],
        },
      },
    };

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const data = callCount === 1 ? sampleRegistry : teamRegistry;
      return Promise.resolve({ ok: true, status: 200, json: async () => data });
    });

    const results = await runSearch('review');
    const vaultNames = results.map((r) => r.vault.name);
    expect(vaultNames).toContain('official');
    expect(vaultNames).toContain('team');
  });

  it('skips unavailable vaults without error', async () => {
    await fs.writeFile(
      configPath,
      JSON.stringify({
        vaults: {
          official: officialVault,
          down: { name: 'down', owner: 'org', repo: 'down-vault', branch: 'main', private: false },
        },
        resolve_order: ['official', 'down'],
        default_vault: 'official',
      }),
      'utf8'
    );

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, status: 200, json: async () => sampleRegistry });
      }
      return Promise.reject(new Error('ENOTFOUND'));
    });

    const results = await runSearch('review');
    expect(results.length).toBeGreaterThan(0);
  });
});
