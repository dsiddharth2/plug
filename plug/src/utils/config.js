import fs from 'fs/promises';
import { getConfigFilePath, getGlobalDir, ensureDir } from './paths.js';
import { OFFICIAL_VAULT } from '../constants.js';

const DEFAULT_CONFIG = {
  vaults: {
    official: OFFICIAL_VAULT,
  },
  resolve_order: ['official'],
  default_vault: 'official',
};

/**
 * Reads and returns the config from ~/.plugvault/config.json.
 * Auto-seeds official vault on first run.
 * If config is corrupt, backs up and resets to defaults.
 */
export async function getConfig() {
  const configPath = getConfigFilePath();
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // First run — seed defaults
      const config = structuredClone(DEFAULT_CONFIG);
      await saveConfig(config);
      return config;
    }
    if (err instanceof SyntaxError) {
      // Corrupt config — back up and reset
      const backupPath = configPath + '.bak';
      try { await fs.copyFile(configPath, backupPath); } catch {}
      console.warn('Warning: config.json was corrupt. Backed up and reset to defaults.');
      const config = structuredClone(DEFAULT_CONFIG);
      await saveConfig(config);
      return config;
    }
    throw err;
  }
}

/**
 * Persists config to disk.
 * @param {object} config
 */
export async function saveConfig(config) {
  await ensureDir(getGlobalDir());
  await fs.writeFile(getConfigFilePath(), JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Returns a vault object by name, or undefined if not found.
 * @param {string} name
 */
export async function getVault(name) {
  const config = await getConfig();
  return config.vaults?.[name];
}

/**
 * Returns the default vault object.
 */
export async function getDefaultVault() {
  const config = await getConfig();
  const name = config.default_vault || 'official';
  return config.vaults?.[name];
}

/**
 * Returns the vault resolution order as an array of vault objects.
 */
export async function getResolveOrder() {
  const config = await getConfig();
  const order = config.resolve_order || ['official'];
  return order.map((name) => config.vaults?.[name]).filter(Boolean);
}
