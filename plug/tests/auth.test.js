import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const tmpDir = path.join(os.tmpdir(), `plugvault-auth-test-${Date.now()}`);
const configPath = path.join(tmpDir, 'config.json');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGlobalDir: () => tmpDir,
    getConfigFilePath: () => configPath,
    ensureDir: actual.ensureDir,
  };
});

const { getAuthForVault, getAuthHeaders } = await import('../src/utils/auth.js');

describe('auth utils', () => {
  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    try { await fs.rm(configPath); } catch {}
    // Clear env vars
    delete process.env.PLUGVAULT_TOKEN_OFFICIAL;
    delete process.env.PLUGVAULT_TOKEN_MYVAULT;
    delete process.env.PLUGVAULT_GITHUB_TOKEN;
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    delete process.env.PLUGVAULT_TOKEN_OFFICIAL;
    delete process.env.PLUGVAULT_TOKEN_MYVAULT;
    delete process.env.PLUGVAULT_GITHUB_TOKEN;
  });

  it('returns null when no token is set', async () => {
    const token = await getAuthForVault('official');
    expect(token).toBeNull();
  });

  it('resolves vault-specific env var first', async () => {
    process.env.PLUGVAULT_TOKEN_OFFICIAL = 'vault-specific-token';
    process.env.PLUGVAULT_GITHUB_TOKEN = 'generic-token';
    const token = await getAuthForVault('official');
    expect(token).toBe('vault-specific-token');
  });

  it('resolves PLUGVAULT_GITHUB_TOKEN as fallback', async () => {
    process.env.PLUGVAULT_GITHUB_TOKEN = 'generic-token';
    const token = await getAuthForVault('official');
    expect(token).toBe('generic-token');
  });

  it('resolves token from config as last fallback', async () => {
    const config = {
      vaults: { myvault: { name: 'myvault', owner: 'me', repo: 'r', branch: 'main', private: true, token: 'config-token' } },
      resolve_order: ['myvault'],
      default_vault: 'myvault',
    };
    await fs.writeFile(configPath, JSON.stringify(config), 'utf8');
    const token = await getAuthForVault('myvault');
    expect(token).toBe('config-token');
  });

  it('getAuthHeaders returns empty object when no token', async () => {
    const headers = await getAuthHeaders('official');
    expect(headers).toEqual({});
  });

  it('getAuthHeaders returns Authorization header when token present', async () => {
    process.env.PLUGVAULT_GITHUB_TOKEN = 'mytoken';
    const headers = await getAuthHeaders('official');
    expect(headers).toEqual({ Authorization: 'Bearer mytoken' });
  });
});
