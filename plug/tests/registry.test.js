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

const { getCachedRegistry, cacheRegistry, fetchRegistry, findPackage } = await import('../src/utils/registry.js');

const sampleRegistry = {
  packages: [
    { name: 'code-review', type: 'command', version: '1.0.0', description: 'Code review command' },
    { name: 'api-patterns', type: 'skill', version: '1.0.0', description: 'API patterns skill' },
  ],
};

const sampleVault = { name: 'official', owner: 'plugvault', repo: 'plugvault', branch: 'main', private: false };

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
      expect(result.packages).toHaveLength(2);
    });

    it('fetches from network when cache is empty', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleRegistry,
      });
      const result = await fetchRegistry(sampleVault);
      expect(result.packages).toHaveLength(2);
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
  });

  describe('findPackage', () => {
    it('finds package by name in cached registry', async () => {
      await cacheRegistry('official', sampleRegistry);
      const result = await findPackage('code-review');
      expect(result).not.toBeNull();
      expect(result.pkg.name).toBe('code-review');
      expect(result.vault.name).toBe('official');
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
  });
});
