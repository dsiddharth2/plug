import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const tmpDir = path.join(os.tmpdir(), `plugvault-registry-test-${Date.now()}`);
const cacheDir = path.join(tmpDir, 'cache');
const configPath = path.join(tmpDir, 'config.json');

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

vi.mock('../src/utils/community-index.js', () => ({
  fetchCommunityIndex: vi.fn(),
  normalizeCommunityPackage: (pkg) => ({
    name: pkg.name,
    vault: pkg.vault,
    vaultUrl: pkg.vaultUrl,
    version: pkg.version ?? '?',
    type: pkg.type,
    description: pkg.description ?? '',
    tags: pkg.tags ?? [],
    path: pkg.directory,
    entry: pkg.entry,
    rawBaseUrl: pkg.rawBaseUrl,
    dependencies: pkg.dependencies ?? [],
    source: 'community',
  }),
}));

const { getCachedRegistry, cacheRegistry, fetchRegistry, findPackage, findAllPackages } = await import('../src/utils/registry.js');
const { fetchCommunityIndex } = await import('../src/utils/community-index.js');

// registry.json uses an object-based packages schema (key = package name)
const sampleRegistry = {
  packages: {
    'code-review': { type: 'command', version: '1.0.0', path: 'registry/code-review', description: 'Code review command' },
    'api-patterns': { type: 'skill', version: '1.0.0', path: 'registry/api-patterns', description: 'API patterns skill' },
  },
};

const sampleCommunityIndex = {
  packages: [
    {
      name: 'requesting-code-review',
      vault: 'superpowers',
      vaultUrl: 'https://github.com/user/superpowers',
      type: 'skill',
      version: '1.1.0',
      directory: 'skills/requesting-code-review',
      rawBaseUrl: 'https://raw.githubusercontent.com/user/superpowers/main',
    }
  ]
};

const sampleVault = { name: 'official', owner: 'dsiddharth2', repo: 'plugvault', branch: 'main', private: false };

describe('registry utils', () => {
  beforeEach(async () => {
    await fs.mkdir(cacheDir, { recursive: true });
    // Write a minimal config for resolve order
    const config = {
      vaults: { official: sampleVault },
      resolve_order: ['official'],
      default_vault: 'official',
    };
    await fs.writeFile(configPath, JSON.stringify(config), 'utf8');
    fetchCommunityIndex.mockResolvedValue(sampleCommunityIndex);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe('getCachedRegistry / cacheRegistry', () => {
    it('returns null when no cache exists', async () => {
      const result = await getCachedRegistry('official');
      expect(result).toBeNull();
    });

    it('caches and retrieves registry data', async () => {
      await cacheRegistry('official', sampleRegistry);
      const result = await getCachedRegistry('official');
      expect(result).toEqual(sampleRegistry);
    });

    it('returns null when cache is stale (mtime manipulation)', async () => {
      await cacheRegistry('official', sampleRegistry);
      const cachePath = path.join(cacheDir, 'official.json');
      // Set mtime to 2 hours ago
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await fs.utimes(cachePath, oldTime, oldTime);
      const result = await getCachedRegistry('official');
      expect(result).toBeNull();
    });
  });

  describe('fetchRegistry', () => {
    it('returns cached registry without network call', async () => {
      await cacheRegistry('official', sampleRegistry);
      // If fetch is called it would fail; the fact it doesn't means cache was used
      const result = await fetchRegistry(sampleVault);
      expect(Object.keys(result.packages)).toHaveLength(2);
    });

    it('fetches from network when cache is empty', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleRegistry,
      });
      const result = await fetchRegistry(sampleVault);
      expect(Object.keys(result.packages)).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    it('throws AUTH_FAILED on 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
      await expect(fetchRegistry(sampleVault)).rejects.toMatchObject({ code: 'AUTH_FAILED' });
    });

    it('throws NOT_FOUND on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      await expect(fetchRegistry(sampleVault)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws NETWORK_ERROR on ENOTFOUND', async () => {
      global.fetch = vi.fn().mockRejectedValue(
        Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })
      );
      await expect(fetchRegistry(sampleVault)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });

    it('throws NETWORK_ERROR on ECONNREFUSED', async () => {
      global.fetch = vi.fn().mockRejectedValue(
        Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
      );
      await expect(fetchRegistry(sampleVault)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });
  });

  describe('findPackage', () => {
    it('finds package by name in cached registry (object schema)', async () => {
      await cacheRegistry('official', sampleRegistry);
      const result = await findPackage('code-review');
      expect(result).not.toBeNull();
      expect(result.pkg.name).toBe('code-review');
      expect(result.pkg.type).toBe('command');
      expect(result.vault.name).toBe('official');
    });

    it('finds skill by name in cached registry', async () => {
      await cacheRegistry('official', sampleRegistry);
      const result = await findPackage('api-patterns');
      expect(result).not.toBeNull();
      expect(result.pkg.name).toBe('api-patterns');
      expect(result.pkg.type).toBe('skill');
    });

    it('finds community package when not in official vault', async () => {
      await cacheRegistry('official', sampleRegistry);
      const result = await findPackage('requesting-code-review');
      expect(result).not.toBeNull();
      expect(result.pkg.name).toBe('requesting-code-review');
      expect(result.pkg.source).toBe('community');
      expect(result.vault.name).toBe('superpowers');
    });

    it('returns null when package not found', async () => {
      await cacheRegistry('official', sampleRegistry);
      const result = await findPackage('nonexistent');
      expect(result).toBeNull();
    });

    it('searches only specified vault', async () => {
      await cacheRegistry('official', sampleRegistry);
      const result = await findPackage('code-review', 'official');
      expect(result).not.toBeNull();
    });

    it('returns null when searching non-existent vault', async () => {
      await cacheRegistry('official', sampleRegistry);
      const result = await findPackage('code-review', 'other-vault');
      expect(result).toBeNull();
    });

    it('finds community package by specific vault name', async () => {
      const result = await findPackage('requesting-code-review', 'superpowers');
      expect(result).not.toBeNull();
      expect(result.pkg.name).toBe('requesting-code-review');
      expect(result.vault.name).toBe('superpowers');
    });
  });

  describe('findAllPackages', () => {
    it('returns all vaults containing the package including community', async () => {
      await cacheRegistry('official', sampleRegistry);
      // Mock code-review in community too to test multi-source
      fetchCommunityIndex.mockResolvedValue({
        packages: [
          ...sampleCommunityIndex.packages,
          { name: 'code-review', vault: 'other-vault', type: 'command' }
        ]
      });

      const results = await findAllPackages('code-review');
      expect(results).toHaveLength(2);
      expect(results.map(r => r.vault.name)).toContain('official');
      expect(results.map(r => r.vault.name)).toContain('other-vault');
    });

    it('returns empty array when package not found', async () => {
      await cacheRegistry('official', sampleRegistry);
      const results = await findAllPackages('nonexistent');
      expect(results).toHaveLength(0);
    });
  });
});
