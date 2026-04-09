import fs from 'fs/promises';
import { getInstalledFilePath, ensureDir } from './paths.js';
import path from 'path';

const EMPTY_INSTALLED = { installed: {} };

/**
 * Reads the installed.json for a scope.
 * If corrupt, backs up and resets to empty.
 * @param {boolean} global
 */
export async function getInstalled(global = false) {
  const filePath = getInstalledFilePath(global);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return structuredClone(EMPTY_INSTALLED);
    }
    if (err instanceof SyntaxError) {
      const backupPath = filePath + '.bak';
      try { await fs.copyFile(filePath, backupPath); } catch {}
      console.warn('Warning: installed.json was corrupt. Backed up and reset.');
      return structuredClone(EMPTY_INSTALLED);
    }
    throw err;
  }
}

/**
 * Persists the installed.json for a scope.
 * @param {object} data
 * @param {boolean} global
 */
async function saveInstalled(data, global = false) {
  const filePath = getInstalledFilePath(global);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Records a package as installed.
 * @param {string} name
 * @param {object} metadata - { type, vault, version, path, installedAt }
 * @param {boolean} global
 */
export async function trackInstall(name, metadata, global = false) {
  const data = await getInstalled(global);
  data.installed[name] = {
    ...metadata,
    installedAt: metadata.installedAt || new Date().toISOString(),
  };
  await saveInstalled(data, global);
}

/**
 * Removes a package from the installed record.
 * @param {string} name
 * @param {boolean} global
 */
export async function trackRemove(name, global = false) {
  const data = await getInstalled(global);
  delete data.installed[name];
  await saveInstalled(data, global);
}

/**
 * Returns true if the package is tracked as installed.
 * @param {string} name
 * @param {boolean} global
 */
export async function isInstalled(name, global = false) {
  const data = await getInstalled(global);
  return Object.prototype.hasOwnProperty.call(data.installed, name);
}
