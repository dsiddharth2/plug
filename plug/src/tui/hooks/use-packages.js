import { useState, useEffect } from 'react';
import { getResolveOrder } from '../../utils/config.js';
import { fetchRegistry, getStaleRegistryCache } from '../../utils/registry.js';
import { fetchCommunityIndex, getStaleCommunityIndexCache, normalizeCommunityPackage } from '../../utils/community-index.js';

/**
 * Fetches packages from all configured vaults and merges them into a flat list.
 * Falls back to stale cache when a vault is unreachable (offline support).
 *
 * @returns {{
 *   packages: Array<{
 *     name: string,
 *     vault: string,
 *     version: string,
 *     type: string,
 *     description: string,
 *     tags: string[],
 *     path: string,
 *   }>,
 *   loading: boolean,
 *   error: string | null,
 *   warning: string | null,
 * }}
 */
export function usePackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const vaults = await getResolveOrder();
        const all = [];
        let networkFailCount = 0;
        let staleFallbackCount = 0;

        for (const vault of vaults) {
          try {
            const registry = await fetchRegistry(vault);
            addVaultPackages(all, vault.name, registry);
          } catch {
            // Network/fetch failed — try stale cache as offline fallback
            const stale = await getStaleRegistryCache(vault.name);
            if (stale) {
              addVaultPackages(all, vault.name, stale);
              staleFallbackCount++;
            } else {
              networkFailCount++;
            }
          }
        }

        try {
          const communityIndex = await fetchCommunityIndex();
          all.push(...(communityIndex.packages ?? []).map(normalizeCommunityPackage));
        } catch {
          const stale = await getStaleCommunityIndexCache();
          if (stale) {
            all.push(...(stale.packages ?? []).map(normalizeCommunityPackage));
            staleFallbackCount++;
          }
          // Do NOT increment networkFailCount — community failure is non-blocking.
        }

        if (!cancelled) {
          all.sort((a, b) => a.name.localeCompare(b.name));
          setPackages(all);
          setLoading(false);

          if (all.length === 0 && networkFailCount > 0) {
            setError('No packages available. Check your internet connection and vault configuration.');
          } else if (staleFallbackCount > 0) {
            setWarning('Offline — showing cached data. Some packages may be out of date.');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load packages');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { packages, loading, error, warning };
}

/**
 * Extracts packages from a registry object and appends them to the list.
 */
function addVaultPackages(list, vaultName, registry) {
  const pkgs = registry.packages || {};
  for (const [name, pkg] of Object.entries(pkgs)) {
    list.push({
      name,
      vault: vaultName,
      version: pkg.version || null,
      type: pkg.type || 'skill',
      description: pkg.description || '',
      tags: pkg.tags || [],
      path: pkg.path || '',
      entry: pkg.entry || '',
    });
  }
}
