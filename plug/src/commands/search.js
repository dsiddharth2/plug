import chalk from 'chalk';
import { getResolveOrder } from '../utils/config.js';
import { fetchRegistry } from '../utils/registry.js';
import { createSpinner } from '../utils/ui.js';
import { ctx, verbose } from '../utils/context.js';

export function registerSearch(program) {
  program
    .command('search <keyword>')
    .description('Search across all vaults by name, description, or tags')
    .option('--vault <name>', 'search in a specific vault only')
    .option('--type <type>', 'filter by type (skill or command)')
    .action(async (keyword, options) => {
      try {
        const results = await runSearch(keyword, options);
        if (ctx.json) {
          process.stdout.write(JSON.stringify(results.map(({ name, pkg, vault, score }) => ({
            name,
            type: pkg.type,
            version: pkg.version,
            description: pkg.description,
            tags: pkg.tags,
            vault: vault.name,
            score,
          }))) + '\n');
        } else {
          printSearchResults(results, keyword);
        }
      } catch (err) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });
}

/**
 * Scores a package match against a keyword.
 * Returns 0 if no match, higher is better.
 * Score tiers:
 *   40 — exact name match
 *   30 — partial name match
 *   20 — description match
 *   10 — tag match
 */
function scoreMatch(name, pkg, keyword) {
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

/**
 * Searches all (or a specific) vault for packages matching keyword.
 * Applies optional --vault and --type filters.
 * Returns array of { name, pkg, vault, score } sorted by score descending.
 *
 * @param {string} keyword
 * @param {{ vault?: string, type?: string }} options
 * @returns {Promise<Array<{ name: string, pkg: object, vault: object, score: number }>>}
 */
export async function runSearch(keyword, options = {}) {
  const vaults = await getResolveOrder();
  const searchVaults = options.vault
    ? vaults.filter((v) => v.name === options.vault)
    : vaults;

  if (options.vault && searchVaults.length === 0) {
    throw new Error(`Vault '${options.vault}' not found.`);
  }

  const results = [];
  const spinner = createSpinner('Searching...');

  for (const vault of searchVaults) {
    let registry;
    spinner.text = `Searching in ${vault.name}...`;
    verbose(`Fetching registry for vault ${vault.name}`);
    try {
      registry = await fetchRegistry(vault);
    } catch {
      // Skip unavailable vaults silently
      continue;
    }

    const packages = registry.packages || {};
    for (const [name, pkg] of Object.entries(packages)) {
      // --type filter
      if (options.type && pkg.type !== options.type) continue;

      const score = scoreMatch(name, pkg, keyword);
      if (score > 0) {
        results.push({ name, pkg, vault, score });
      }
    }
  }

  spinner.stop();

  // Sort by score descending, then by name alphabetically for ties
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  verbose(`Search complete: ${results.length} results for "${keyword}"`);
  return results;
}

/**
 * Prints search results to stdout.
 * @param {Array} results
 * @param {string} keyword
 */
function printSearchResults(results, keyword) {
  if (results.length === 0) {
    console.log(chalk.yellow(`No packages found matching "${keyword}".`));
    return;
  }

  console.log(chalk.bold(`\nSearch results for "${keyword}" (${results.length} found):\n`));

  for (const { name, pkg, vault } of results) {
    const typeLabel = pkg.type === 'skill' ? chalk.blue('[skill]') : chalk.magenta('[command]');
    const vaultLabel = chalk.dim(`vault:${vault.name}`);
    const version = chalk.dim(`v${pkg.version || '?'}`);
    console.log(`  ${chalk.green(name)} ${typeLabel} ${version} ${vaultLabel}`);
    if (pkg.description) {
      console.log(`    ${pkg.description}`);
    }
    if (pkg.tags && pkg.tags.length > 0) {
      console.log(`    ${chalk.dim('tags: ' + pkg.tags.join(', '))}`);
    }
    console.log();
  }
}
