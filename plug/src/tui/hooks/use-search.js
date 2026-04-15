import { useMemo } from 'react';
import { scoreMatch } from '../../utils/search-scoring.js';

/**
 * Filters and sorts packages by a search query using the shared scoring algorithm.
 * Returns all packages when query is empty.
 *
 * @param {Array<object>} packages - Full package list from usePackages
 * @param {string} query - Current search query string
 * @returns {Array<object>} Filtered and scored package list
 */
export function useSearch(packages, query) {
  return useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return packages;

    return packages
      .map((pkg) => ({ pkg, score: scoreMatch(pkg.name, pkg, trimmed) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.pkg.name.localeCompare(b.pkg.name);
      })
      .map(({ pkg }) => pkg);
  }, [packages, query]);
}
