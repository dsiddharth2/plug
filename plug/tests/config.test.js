import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

// We need to mock getConfigFilePath and getGlobalDir to use a temp dir
const tmpDir = path.join(os.tmpdir(), `plugvault-config-test-${Date.now()}`);
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

const { getConfig, saveConfig, getVault, getDefaultVault, getResolveOrder } = await import('../src/utils/config.js');

describe('config utils', () => {
  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    // Remove config if it exists
    try { await fs.rm(configPath); } catch {}
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('getConfig returns defaults when no config exists', async () => {
    const config = await getConfig();
    expect(config.vaults).toHaveProperty('official');
    expect(config.resolve_order).toContain('official');
    expect(config.default_vault).toBe('official');
  });

  it('getConfig creates config.json on first run', async () => {
    await getConfig();
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.vaults.official.name).toBe('official');
  });

  it('saveConfig and getConfig round-trips correctly', async () => {
    const custom = {
      vaults: { myvault: { name: 'myvault', owner: 'me', repo: 'vault', branch: 'main', private: false } },
      resolve_order: ['myvault'],
      default_vault: 'myvault',
    };
    await saveConfig(custom);
    const config = await getConfig();
    expect(config.default_vault).toBe('myvault');
    expect(config.vaults.myvault.owner).toBe('me');
  });

  it('getConfig backs up and resets corrupt config.json', async () => {
    await fs.writeFile(configPath, '{ invalid json !!', 'utf8');
    const config = await getConfig();
    expect(config.vaults).toHaveProperty('official');
    // backup should exist
    const backupStat = await fs.stat(configPath + '.bak');
    expect(backupStat.isFile()).toBe(true);
  });

  it('getVault returns vault by name', async () => {
    const vault = await getVault('official');
    expect(vault).toBeDefined();
    expect(vault.name).toBe('official');
  });

  it('getVault returns undefined for unknown vault', async () => {
    const vault = await getVault('nonexistent');
    expect(vault).toBeUndefined();
  });

  it('getDefaultVault returns the official vault by default', async () => {
    const vault = await getDefaultVault();
    expect(vault.name).toBe('official');
  });

  it('getResolveOrder returns ordered vault objects', async () => {
    const order = await getResolveOrder();
    expect(order.length).toBeGreaterThan(0);
    expect(order[0].name).toBe('official');
  });
});
