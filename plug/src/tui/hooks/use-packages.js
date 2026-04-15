import { useState, useEffect } from 'react';
import { getResolveOrder } from '../../utils/config.js';
import { fetchRegistry } from '../../utils/registry.js';

/**
 * Fetches packages from all configured vaults and merges them into a flat list.
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
 * }}
 */
export function usePackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const vaults = await getResolveOrder();
        const all = [];

        for (const vault of vaults) {
          try {
            const registry = await fetchRegistry(vault);
            const pkgs = registry.packages || {};
            for (const [name, pkg] of Object.entries(pkgs)) {
              all.push({
                name,
                vault: vault.name,
                version: pkg.version || '?',
                type: pkg.type || 'skill',
                description: pkg.description || '',
                tags: pkg.tags || [],
                path: pkg.path || '',
                entry: pkg.entry || '',
              });
            }
          } catch {
            // Skip unavailable vaults silently
          }
        }

        if (!cancelled) {
          // Sort by name for consistent ordering
          all.sort((a, b) => a.name.localeCompare(b.name));
          setPackages(all);
          setLoading(false);
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

  return { packages, loading, error };
}
