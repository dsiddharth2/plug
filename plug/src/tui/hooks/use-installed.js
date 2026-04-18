import { useState, useEffect, useCallback } from 'react';
import { getInstalled } from '../../utils/tracker.js';
import { findPackage } from '../../utils/registry.js';
import { compareSemver } from '../../commands/update.js';

/**
 * Loads installed packages from both local and global scopes.
 * Enriches each record with scope label, update-available info.
 *
 * @returns {{
 *   packages: Array<{
 *     name: string,
 *     type: string,
 *     vault: string,
 *     version: string,
 *     path: string,
 *     installedAt: string,
 *     scope: 'local'|'global',
 *     latestVersion: string|null,
 *     hasUpdate: boolean,
 *   }>,
 *   loading: boolean,
 *   error: string|null,
 *   reload: () => void,
 * }}
 */
export function useInstalled() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [localData, globalData] = await Promise.all([
          getInstalled(false),
          getInstalled(true),
        ]);

        const merged = [];
        const localPaths = new Map();

        for (const [name, record] of Object.entries(localData.installed || {})) {
          merged.push({ name, ...record, scope: 'local', hasUpdate: false, latestVersion: null });
          localPaths.set(name, record.path);
        }
        for (const [name, record] of Object.entries(globalData.installed || {})) {
          if (localPaths.has(name) && localPaths.get(name) === record.path) continue;
          merged.push({ name, ...record, scope: 'global', hasUpdate: false, latestVersion: null });
        }

        // Sort by name then scope
        merged.sort((a, b) => a.name.localeCompare(b.name) || a.scope.localeCompare(b.scope));

        if (!cancelled) {
          setPackages(merged);
          setLoading(false);
        }

        // Async: check for updates in the background
        checkUpdates(merged, cancelled, setPackages);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load installed packages');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tick]);

  return { packages, loading, error, reload };
}

/**
 * Checks for available updates in the background and patches package state.
 * @param {Array} packages
 * @param {boolean} cancelled - ref to outer cancel flag
 * @param {Function} setPackages
 */
async function checkUpdates(packages, cancelled, setPackages) {
  if (packages.length === 0) return;

  const enriched = [...packages];
  let changed = false;

  for (let i = 0; i < enriched.length; i++) {
    if (cancelled) break;
    const pkg = enriched[i];
    if (!pkg.vault || !pkg.version) continue;

    try {
      const result = await findPackage(pkg.name, pkg.vault);
      if (result && result.pkg) {
        const latestVersion = result.pkg.version || '0.0.0';
        const hasUpdate = compareSemver(latestVersion, pkg.version || '0.0.0') > 0;
        if (hasUpdate || latestVersion !== pkg.latestVersion) {
          enriched[i] = { ...pkg, latestVersion, hasUpdate };
          changed = true;
        }
      }
    } catch {
      // Skip — vault may be unreachable
    }
  }

  if (!cancelled && changed) {
    setPackages([...enriched]);
  }
}
