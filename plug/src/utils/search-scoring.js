/**
 * Scores a package match against a keyword.
 * Returns 0 if no match, higher is better.
 * Score tiers:
 *   40 — exact name match
 *   30 — partial name match
 *   20 — description match
 *   10 — tag match
 *
 * @param {string} name - Package name
 * @param {{ description?: string, tags?: string[] }} pkg - Package metadata
 * @param {string} keyword - Search keyword
 * @returns {number} Score (0 = no match)
 */
export function scoreMatch(name, pkg, keyword) {
  const kw = keyword.toLowerCase();
  const pkgName = name.toLowerCase();
  const desc = (pkg.description || '').toLowerCase();
  const tags = (pkg.tags || []).map((t) => t.toLowerCase());

  if (pkgName === kw) return 40;
  if (pkgName.includes(kw)) return 30;
  if (desc.includes(kw)) return 20;
  if (tags.some((t) => t.includes(kw))) return 10;
  return 0;
}
