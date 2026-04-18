import { useState, useEffect, useCallback } from 'react';
import { getConfig } from '../../utils/config.js';
import { getCachedRegistry } from '../../utils/registry.js';
import { getCachedCommunityIndex, getStaleCommunityIndexCache } from '../../utils/community-index.js';

/**
 * Loads vault configuration and enriches each vault with metadata:
 * package count (from cache), public/private, default star, GitHub URL.
 *
 * @returns {{
 *   vaults: Array<{
 *     name: string,
 *     owner: string,
 *     repo: string,
 *     branch: string,
 *     private: boolean,
 *     isDefault: boolean,
 *     githubUrl: string,
 *     packageCount: number|null,
 *   }>,
 *   loading: boolean,
 *   error: string|null,
 *   reload: () => void,
 * }}
 */
export function useVaults() {
  const [vaults, setVaults] = useState([]);
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
        const config = await getConfig();
        const order = config.resolve_order || [];
        const defaultVault = config.default_vault || 'official';

        const enriched = [];
        for (const name of order) {
          const v = config.vaults?.[name];
          if (!v) continue;

          let packageCount = null;
          try {
            const cached = await getCachedRegistry(name);
            if (cached) {
              packageCount = Object.keys(cached.packages || {}).length;
            }
          } catch {
            // ignore cache errors
          }

          enriched.push({
            name,
            owner: v.owner || '',
            repo: v.repo || '',
            branch: v.branch || 'main',
            private: v.private || false,
            isDefault: name === defaultVault,
            githubUrl: `https://github.com/${v.owner}/${v.repo}`,
            packageCount,
          });
        }

        const communityData = await getCachedCommunityIndex() || await getStaleCommunityIndexCache();
        if (communityData) {
          const pkgs = communityData.packages || [];
          const communityVaultMap = new Map();
          for (const pkg of pkgs) {
            if (!pkg.vault || enriched.some(v => v.name === pkg.vault)) continue;
            if (!communityVaultMap.has(pkg.vault)) {
              communityVaultMap.set(pkg.vault, { count: 0, url: pkg.vaultUrl || '' });
            }
            communityVaultMap.get(pkg.vault).count++;
          }
          for (const [name, info] of communityVaultMap) {
            let owner = '';
            let repo = '';
            try {
              const parts = new URL(info.url).pathname.split('/').filter(Boolean);
              owner = parts[0] || '';
              repo = parts[1] || '';
            } catch {}
            enriched.push({
              name,
              owner,
              repo,
              branch: 'main',
              private: false,
              isDefault: false,
              githubUrl: info.url,
              packageCount: info.count,
              isCommunity: true,
            });
          }
        }

        if (!cancelled) {
          setVaults(enriched);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load vaults');
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tick]);

  return { vaults, loading, error, reload };
}
