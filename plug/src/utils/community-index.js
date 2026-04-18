import fs from 'fs/promises';
import path from 'path';
import { getCacheDir, ensureDir } from './paths.js';
import { CACHE_TTL_MS, COMMUNITY_INDEX_URL } from '../constants.js';

const COMMUNITY_CACHE_FILE = 'community-index.json';

function getCacheFilePath() {
  return path.join(getCacheDir(), COMMUNITY_CACHE_FILE);
}

/**
 * Returns cached community index data if fresh (< CACHE_TTL_MS), else null.
 */
export async function getCachedCommunityIndex() {
  const cachePath = getCacheFilePath();
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
 * Writes community index data to cache.
 * @param {object} data
 */
export async function cacheCommunityIndex(data) {
  await ensureDir(getCacheDir());
  const cachePath = getCacheFilePath();
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Returns cached community index data regardless of age (offline/stale fallback).
 */
export async function getStaleCommunityIndexCache() {
  const cachePath = getCacheFilePath();
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Fetches community-index.json from plugvault (with cache support).
 * Does not use auth headers — URL is always public.
 * @returns {object} community index data
 */
export async function fetchCommunityIndex() {
  const cached = await getCachedCommunityIndex();
  if (cached) return cached;

  let response;
  try {
    response = await fetch(COMMUNITY_INDEX_URL);
  } catch (err) {
    if (err.cause?.code === 'ENOTFOUND' || err.cause?.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw Object.assign(
        new Error('Connection failed. Check your internet connection.'),
        { code: 'NETWORK_ERROR' }
      );
    }
    throw err;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch community index: HTTP ${response.status}`);
  }

  const data = await response.json();
  await cacheCommunityIndex(data);
  return data;
}

/**
 * Adapter: community-index shape → internal package shape.
 * @param {object} pkg
 */
export function normalizeCommunityPackage(pkg) {
  return {
    name:         pkg.name,
    vault:        pkg.vault,
    vaultUrl:     pkg.vaultUrl,
    version:      pkg.version || null,
    type:         pkg.type,
    description:  pkg.description ?? '',
    tags:         pkg.tags ?? [],
    path:         pkg.directory,       // maps to registry.json "path"
    entry:        pkg.entry,
    files:        pkg.files ?? [],     // additional files to download
    rawBaseUrl:   pkg.rawBaseUrl,      // used by install in Sprint 3
    dependencies: pkg.dependencies ?? [],
    depCount:     (pkg.dependencies ?? []).length,
    source:       'community',         // distinguishes from official vault packages
  }
}
