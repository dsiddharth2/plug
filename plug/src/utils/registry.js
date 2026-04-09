import fs from 'fs/promises';
import path from 'path';
import { getCacheDir, ensureDir } from './paths.js';
import { getAuthHeaders } from './auth.js';
import { getResolveOrder } from './config.js';
import {
  GITHUB_RAW_BASE,
  REGISTRY_FILE,
  DEFAULT_BRANCH,
  CACHE_TTL_MS,
} from '../constants.js';

/**
 * Returns the cache file path for a vault's registry.
 * @param {string} vaultName
 */
function getCacheFilePath(vaultName) {
  return path.join(getCacheDir(), `${vaultName}.json`);
}

/**
 * Returns cached registry data if fresh (< 1 hour old), else null.
 * @param {string} vaultName
 */
export async function getCachedRegistry(vaultName) {
  const cachePath = getCacheFilePath(vaultName);
  try {
    const stat = await fs.stat(cachePath);
    const age = Date.now() - stat.mtimeMs;
    if (age > CACHE_TTL_MS) return null;
    const raw = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Writes registry data to cache.
 * @param {string} vaultName
 * @param {object} data
 */
export async function cacheRegistry(vaultName, data) {
  await ensureDir(getCacheDir());
  const cachePath = getCacheFilePath(vaultName);
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Fetches registry.json from a vault's GitHub repo (with cache support).
 * @param {object} vault - { name, owner, repo, branch }
 * @returns {object} registry data
 */
export async function fetchRegistry(vault) {
  const cached = await getCachedRegistry(vault.name);
  if (cached) return cached;

  const branch = vault.branch || DEFAULT_BRANCH;
  const url = `${GITHUB_RAW_BASE}/${vault.owner}/${vault.repo}/${branch}/${REGISTRY_FILE}`;
  const headers = await getAuthHeaders(vault.name);

  let response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    if (err.cause?.code === 'ENOTFOUND' || err.cause?.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw Object.assign(
        new Error('Connection failed. Check your internet connection.'),
        { code: 'NETWORK_ERROR' }
      );
    }
    throw err;
  }

  if (response.status === 401 || response.status === 403) {
    throw Object.assign(
      new Error(`Authentication failed for vault '${vault.name}'. Run: plug vault set-token ${vault.name} <token>`),
      { code: 'AUTH_FAILED', status: response.status }
    );
  }
  if (response.status === 404) {
    throw Object.assign(
      new Error(`Registry not found for vault '${vault.name}'.`),
      { code: 'NOT_FOUND', status: 404 }
    );
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch registry for '${vault.name}': HTTP ${response.status}`);
  }

  const data = await response.json();
  await cacheRegistry(vault.name, data);
  return data;
}

/**
 * Searches for a package across all vaults (or a specific vault).
 * Returns { pkg, vault } or null if not found.
 * @param {string} name - Package name
 * @param {string|null} vaultName - Optional specific vault to search
 */
export async function findPackage(name, vaultName = null) {
  const vaults = await getResolveOrder();
  const searchVaults = vaultName
    ? vaults.filter((v) => v.name === vaultName)
    : vaults;

  for (const vault of searchVaults) {
    try {
      const registry = await fetchRegistry(vault);
      const packages = registry.packages || {};
      const pkgData = packages[name];
      if (pkgData) return { pkg: { name, ...pkgData }, vault };
    } catch {
      // Skip unavailable vaults
    }
  }
  return null;
}

/**
 * Returns all vaults that contain a package with the given name.
 * Used for conflict detection when the same name exists in multiple vaults.
 * @param {string} name - Package name
 * @returns {Array<{ pkg, vault }>}
 */
export async function findAllPackages(name) {
  const vaults = await getResolveOrder();
  const results = [];

  for (const vault of vaults) {
    try {
      const registry = await fetchRegistry(vault);
      const packages = registry.packages || {};
      const pkgData = packages[name];
      if (pkgData) results.push({ pkg: { name, ...pkgData }, vault });
    } catch {
      // Skip unavailable vaults
    }
  }
  return results;
}
