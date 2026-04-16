import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const tmpDir = path.join(os.tmpdir(), `plug-community-index-test-${Date.now()}`);
const cacheDir = path.join(tmpDir, 'cache');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCacheDir: () => cacheDir,
    ensureDir: actual.ensureDir,
  };
});

const {
  getCachedCommunityIndex,
  cacheCommunityIndex,
  fetchCommunityIndex,
  getStaleCommunityIndexCache,
  normalizeCommunityPackage,
} = await import('../src/utils/community-index.js');

const { CACHE_TTL_MS } = await import('../src/constants.js');

const sampleData = {
  packages: [
    {
      name: 'senior-engineer',
      vault: 'community',
      version: '1.0.0',
      type: 'skill',
      description: 'Senior engineer skill',
      tags: ['engineering'],
      directory: 'community/senior-engineer',
      entry: 'senior-engineer.md',
      rawBaseUrl: 'https://raw.githubusercontent.com/example/vault/main',
      dependencies: [],
    },
  ],
};

describe('community-index utils', () => {
  beforeEach(async () => {
    await fs.mkdir(cacheDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ── getCachedCommunityIndex ──────────────────────────────────────────────

  describe('getCachedCommunityIndex', () => {
    it('returns null when no cache file exists', async () => {
      const result = await getCachedCommunityIndex();
      expect(result).toBeNull();
    });

    it('returns null when cache is stale (mtime > CACHE_TTL_MS)', async () => {
      await cacheCommunityIndex(sampleData);
      const cachePath = path.join(cacheDir, 'community-index.json');
      const oldTime = new Date(Date.now() - (CACHE_TTL_MS + 60_000));
      await fs.utimes(cachePath, oldTime, oldTime);
      const result = await getCachedCommunityIndex();
      expect(result).toBeNull();
    });

    it('returns parsed data when cache is fresh', async () => {
      await cacheCommunityIndex(sampleData);
      const result = await getCachedCommunityIndex();
      expect(result).toEqual(sampleData);
    });
  });

  // ── cacheCommunityIndex + getCachedCommunityIndex round-trip ────────────

  describe('cacheCommunityIndex + getCachedCommunityIndex round-trip', () => {
    it('data written can be read back correctly', async () => {
      const payload = { packages: [{ name: 'test-pkg', version: '2.0.0' }] };
      await cacheCommunityIndex(payload);
      const result = await getCachedCommunityIndex();
      expect(result).toEqual(payload);
    });
  });

  // ── fetchCommunityIndex ─────────────────────────────────────────────────

  describe('fetchCommunityIndex', () => {
    it('returns cached data without network call when cache is fresh', async () => {
      await cacheCommunityIndex(sampleData);
      // If global.fetch were called it would throw (not mocked) — the fact it
      // succeeds proves the cache was served.
      const result = await fetchCommunityIndex();
      expect(result).toEqual(sampleData);
    });

    it('fetches, caches, and returns data on cache miss', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleData,
      });
      const result = await fetchCommunityIndex();
      expect(result).toEqual(sampleData);
      expect(global.fetch).toHaveBeenCalledOnce();

      // Verify data was cached — subsequent call should NOT hit network
      global.fetch.mockClear();
      const cached = await fetchCommunityIndex();
      expect(cached).toEqual(sampleData);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('throws NETWORK_ERROR when fetch fails with ENOTFOUND', async () => {
      global.fetch = vi.fn().mockRejectedValue(
        Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })
      );
      await expect(fetchCommunityIndex()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    });

    it('throws on non-OK HTTP status', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      await expect(fetchCommunityIndex()).rejects.toThrow('HTTP 500');
    });
  });

  // ── getStaleCommunityIndexCache ─────────────────────────────────────────

  describe('getStaleCommunityIndexCache', () => {
    it('returns data regardless of mtime (even when stale)', async () => {
      await cacheCommunityIndex(sampleData);
      const cachePath = path.join(cacheDir, 'community-index.json');
      const oldTime = new Date(Date.now() - (CACHE_TTL_MS + 60_000));
      await fs.utimes(cachePath, oldTime, oldTime);
      const result = await getStaleCommunityIndexCache();
      expect(result).toEqual(sampleData);
    });

    it('returns null when no cache file exists', async () => {
      const result = await getStaleCommunityIndexCache();
      expect(result).toBeNull();
    });
  });

  // ── normalizeCommunityPackage ────────────────────────────────────────────

  describe('normalizeCommunityPackage', () => {
    const base = {
      name: 'agent-fleet',
      vault: 'community',
      vaultUrl: 'https://github.com/example/vault',
      version: '1.2.3',
      type: 'agent',
      description: 'Fleet management agent',
      tags: ['agents', 'fleet'],
      directory: 'community/agent-fleet',
      entry: 'agent-fleet.md',
      rawBaseUrl: 'https://raw.githubusercontent.com/example/vault/main',
      dependencies: [
        { name: 'dep-one', vault: 'community', required: true },
        { name: 'dep-two', vault: 'community', required: false },
        { name: 'dep-three', vault: 'community', required: true },
      ],
    };

    it('depCount equals dependencies.length', () => {
      const result = normalizeCommunityPackage(base);
      expect(result.depCount).toBe(base.dependencies.length);
    });

    it('source is always "community"', () => {
      const result = normalizeCommunityPackage(base);
      expect(result.source).toBe('community');
    });

    it('path is set from directory field, not pkg.path', () => {
      const pkg = { ...base, path: 'WRONG/path' };
      const result = normalizeCommunityPackage(pkg);
      expect(result.path).toBe(base.directory);
    });

    it('version defaults to "?" when null', () => {
      const result = normalizeCommunityPackage({ ...base, version: null });
      expect(result.version).toBe('?');
    });

    it('version defaults to "?" when undefined', () => {
      const { version: _v, ...noVersion } = base;
      const result = normalizeCommunityPackage(noVersion);
      expect(result.version).toBe('?');
    });

    it('tags defaults to [] when null', () => {
      const result = normalizeCommunityPackage({ ...base, tags: null });
      expect(result.tags).toEqual([]);
    });

    it('dependencies defaults to [] when missing', () => {
      const { dependencies: _d, ...noDeps } = base;
      const result = normalizeCommunityPackage(noDeps);
      expect(result.dependencies).toEqual([]);
      expect(result.depCount).toBe(0);
    });

    it('rawBaseUrl is preserved from input', () => {
      const result = normalizeCommunityPackage(base);
      expect(result.rawBaseUrl).toBe(base.rawBaseUrl);
    });
  });
});
