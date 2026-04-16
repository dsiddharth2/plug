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
 * @param {object} metadata - { type, vault, version, path, installedAt, installed_as, dependencies, dependents }
 * @param {boolean} global
 */
export async function trackInstall(name, metadata, global = false) {
  const data = await getInstalled(global);
  data.installed[name] = {
    ...metadata,
    installed_as: metadata.installed_as ?? 'explicit',
    dependencies: metadata.dependencies ?? [],
    dependents: metadata.dependents ?? [],
    installedAt: metadata.installedAt || new Date().toISOString(),
  };
  await saveInstalled(data, global);
}

/**
 * Merges newDependents into data.installed[name].dependents (dedup); saves.
 * @param {string} name
 * @param {string[]} newDependents
 * @param {boolean} global
 */
export async function addDependents(name, newDependents, global = false) {
  const data = await getInstalled(global);
  const rec = data.installed[name];
  if (!rec) return;
  const existing = rec.dependents ?? [];
  const merged = [...new Set([...existing, ...newDependents])];
  rec.dependents = merged;
  await saveInstalled(data, global);
}

/**
 * Returns data.installed[name] ?? null.
 * @param {string} name
 * @param {boolean} global
 */
export async function getInstalledRecord(name, global = false) {
  const data = await getInstalled(global);
  return data.installed[name] ?? null;
}

/**
 * Returns names where installed_as === 'dependency' && dependents.length === 0.
 * @param {boolean} global
 */
export async function prunableOrphans(global = false) {
  const data = await getInstalled(global);
  return Object.entries(data.installed)
    .filter(([, rec]) => (rec.installed_as ?? 'explicit') === 'dependency' && (rec.dependents ?? []).length === 0)
    .map(([name]) => name);
}

/**
 * Removes fromName from data.installed[toName].dependents; saves.
 * @param {string} fromName
 * @param {string} toName
 * @param {boolean} global
 */
export async function removeDependentEdge(fromName, toName, global = false) {
  const data = await getInstalled(global);
  const rec = data.installed[toName];
  if (!rec) return;
  rec.dependents = (rec.dependents ?? []).filter(d => d !== fromName);
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
