import chalk from 'chalk';
import { getInstalled } from '../utils/tracker.js';
import { getResolveOrder } from '../utils/config.js';
import { fetchRegistry } from '../utils/registry.js';
import { createSpinner } from '../utils/ui.js';
import { ctx, verbose } from '../utils/context.js';

export function registerList(program) {
  program
    .command('list')
    .description('List installed skills and commands')
    .option('--remote', 'list all available packages across all vaults')
    .option('--vault <name>', 'filter by vault name')
    .option('--type <type>', 'filter by type (skill, command, or agent)')
    .action(async (options) => {
      try {
        await runList(options);
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

export async function runList(options = {}) {
  const isRemote = options.remote || false;
  const vaultFilter = options.vault || null;
  const typeFilter = options.type || null;

  if (isRemote) {
    await listRemote({ vaultFilter, typeFilter });
  } else {
    await listInstalled({ vaultFilter, typeFilter });
  }
}

async function listInstalled({ vaultFilter, typeFilter }) {
  const localData = await getInstalled(false);
  const globalData = await getInstalled(true);

  const entries = [];
  for (const [name, meta] of Object.entries(localData.installed)) {
    entries.push({ name, ...meta, scope: 'local' });
  }
  for (const [name, meta] of Object.entries(globalData.installed)) {
    entries.push({ name, ...meta, scope: 'global' });
  }

  let filtered = entries;
  if (vaultFilter) filtered = filtered.filter((e) => e.vault === vaultFilter);
  if (typeFilter) filtered = filtered.filter((e) => e.type === typeFilter);

  if (ctx.json) {
    process.stdout.write(JSON.stringify(filtered) + '\n');
    return;
  }

  if (filtered.length === 0) {
    console.log(chalk.yellow('No packages installed.'));
    return;
  }

  const header = ['NAME', 'TYPE', 'VAULT', 'VERSION', 'SCOPE'];
  const rows = filtered.map((e) => [
    e.name,
    e.type || '',
    e.vault || '',
    e.version || '',
    e.scope,
  ]);
  printTable(header, rows);
}

async function listRemote({ vaultFilter, typeFilter }) {
  const vaults = await getResolveOrder();
  const searchVaults = vaultFilter ? vaults.filter((v) => v.name === vaultFilter) : vaults;

  if (searchVaults.length === 0) {
    if (ctx.json) {
      process.stdout.write(JSON.stringify([]) + '\n');
    } else {
      console.log(chalk.yellow('No vaults configured.'));
    }
    return;
  }

  const spinner = createSpinner('Fetching registries...');
  const rows = [];
  const jsonRows = [];

  for (const vault of searchVaults) {
    spinner.text = `Fetching ${vault.name}...`;
    verbose(`Fetching registry for vault ${vault.name}`);
    try {
      const registry = await fetchRegistry(vault);
      const packages = registry.packages || {};
      for (const [name, pkg] of Object.entries(packages)) {
        if (typeFilter && pkg.type !== typeFilter) continue;
        rows.push([name, pkg.type || '', vault.name, pkg.version || '', pkg.description || '']);
        jsonRows.push({ name, type: pkg.type, vault: vault.name, version: pkg.version, description: pkg.description });
      }
    } catch (err) {
      spinner.stop();
      if (!ctx.json) {
        console.warn(chalk.yellow(`  Warning: Could not fetch registry for vault '${vault.name}': ${err.message}`));
      }
      spinner.start();
    }
  }

  spinner.stop();

  if (ctx.json) {
    process.stdout.write(JSON.stringify(jsonRows) + '\n');
    return;
  }

  if (rows.length === 0) {
    console.log(chalk.yellow('No packages available.'));
    return;
  }

  const header = ['NAME', 'TYPE', 'VAULT', 'VERSION', 'DESCRIPTION'];
  printTable(header, rows);
}

function printTable(header, rows) {
  const allRows = [header, ...rows];
  const colWidths = header.map((_, i) =>
    Math.max(...allRows.map((r) => String(r[i] || '').length)),
  );

  const sep = colWidths.map((w) => '-'.repeat(w + 2)).join('+');
  const formatRow = (row) =>
    row.map((cell, i) => ` ${String(cell || '').padEnd(colWidths[i])} `).join('|');

  console.log(chalk.cyan(formatRow(header)));
  console.log(chalk.cyan(sep));
  for (const row of rows) {
    console.log(formatRow(row));
  }
}
