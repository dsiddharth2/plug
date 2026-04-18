import chalk from 'chalk';
import fs from 'fs/promises';
import { getInstalled, trackInstall } from '../utils/tracker.js';
import { findPackage } from '../utils/registry.js';
import { createSpinner } from '../utils/ui.js';
import { ctx, verbose } from '../utils/context.js';
import { installSinglePackage } from './install.js';
import { cleanEmptyParents } from './remove.js';

export function registerUpdate(program) {
  program
    .command('update [name]')
    .description('Update an installed skill, command, or agent to the latest version')
    .option('--all', 'update all installed skills, commands, and agents')
    .option('-g, --global', 'check the global install scope')
    .action(async (name, options) => {
      try {
        if (options.all) {
          const result = await runUpdateAll(options);
          if (ctx.json) {
            process.stdout.write(JSON.stringify(result) + '\n');
          }
        } else if (name) {
          const result = await runUpdate(name, options);
          if (ctx.json) {
            process.stdout.write(JSON.stringify(result) + '\n');
          }
        } else {
          if (ctx.json) {
            process.stdout.write(JSON.stringify({ error: 'Specify a package name or use --all.' }) + '\n');
          } else {
            console.error(chalk.red('Specify a package name or use --all.'));
          }
          process.exit(1);
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
 * Compares two semver strings.
 * Returns  1 if a > b
 *          0 if a === b
 *         -1 if a < b
 */
export function compareSemver(a, b) {
  const parse = (v) => String(v || '0.0.0').split('.').map(Number);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);

  if (aMaj !== bMaj) return aMaj > bMaj ? 1 : -1;
  if (aMin !== bMin) return aMin > bMin ? 1 : -1;
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1;
  return 0;
}

/**
 * Updates a single named package.
 * @param {string} name
 * @param {{ global?: boolean }} options
 * @returns {Promise<{ name: string, status: 'updated'|'up-to-date'|'not-installed'|'vault-unavailable', from?: string, to?: string }>}
 */
export async function runUpdate(name, options = {}) {
  const isGlobal = options.global || false;
  const installed = await getInstalled(isGlobal);
  const record = installed.installed?.[name];

  if (!record) {
    if (!ctx.json) console.log(chalk.yellow(`'${name}' is not installed.`));
    return { name, status: 'not-installed' };
  }

  // Find latest version in registry
  const checkSpinner = createSpinner(`Checking ${name}...`);
  verbose(`Checking ${name} in vault ${record.vault}`);
  let result;
  try {
    result = await findPackage(name, record.vault);
  } catch {
    result = null;
  }
  checkSpinner.stop();

  if (!result) {
    if (!ctx.json) console.log(chalk.yellow(`'${name}': vault '${record.vault}' is not accessible. Skipping.`));
    return { name, status: 'vault-unavailable' };
  }

  const { pkg, vault } = result;
  const installedVersion = record.version || '0.0.0';
  const latestVersion = pkg.version || '0.0.0';

  verbose(`${name}: installed=${installedVersion}, latest=${latestVersion}`);

  if (compareSemver(latestVersion, installedVersion) <= 0) {
    if (!ctx.json) console.log(chalk.dim(`${name}: already up to date (${installedVersion})`));
    return { name, status: 'up-to-date', version: installedVersion };
  }

  // Use installSinglePackage to handle multi-file and community downloads
  const dlSpinner = createSpinner(`Updating ${name} to v${latestVersion}...`);
  let installInfo;
  try {
    installInfo = await installSinglePackage(result, isGlobal);
    dlSpinner.stop();
  } catch (err) {
    dlSpinner.stop();
    throw err;
  }

  // Clean up old files that are not in the new file list
  const oldFiles = record.files || [record.path];
  const newFiles = new Set(installInfo.files);
  for (const oldPath of oldFiles) {
    if (!newFiles.has(oldPath)) {
      verbose(`Cleaning up old file: ${oldPath}`);
      try {
        await fs.unlink(oldPath);
        await cleanEmptyParents(oldPath);
      } catch { /* ignore */ }
    }
  }

  await trackInstall(
    name,
    {
      type: installInfo.type,
      vault: vault.name,
      version: latestVersion,
      path: installInfo.destPath,
      files: installInfo.files,
      installedAt: record.installedAt,
      installed_as: record.installed_as || 'explicit',
      dependencies: record.dependencies || [],
      dependents: record.dependents || [],
    },
    isGlobal,
  );

  if (!ctx.json) console.log(chalk.green(`Updated ${name}: v${installedVersion} → v${latestVersion}`));
  return { name, status: 'updated', from: installedVersion, to: latestVersion };
}

/**
 * Updates all installed packages.
 * @param {{ global?: boolean }} options
 * @returns {Promise<{ updated: number, upToDate: number, errors: string[] }>}
 */
export async function runUpdateAll(options = {}) {
  const isGlobal = options.global || false;
  const installed = await getInstalled(isGlobal);
  const names = Object.keys(installed.installed || {});

  if (names.length === 0) {
    if (!ctx.json) console.log(chalk.yellow('No packages installed.'));
    return { updated: 0, upToDate: 0, errors: [] };
  }

  let updated = 0;
  let upToDate = 0;
  const errors = [];

  for (const name of names) {
    try {
      const result = await runUpdate(name, options);
      if (result.status === 'updated') updated++;
      else if (result.status === 'up-to-date') upToDate++;
    } catch (err) {
      if (!ctx.json) console.error(chalk.red(`Error updating '${name}': ${err.message}`));
      errors.push(name);
    }
  }

  if (!ctx.json) {
    console.log(
      chalk.bold(
        `\nDone. Updated: ${updated}, Up to date: ${upToDate}${errors.length > 0 ? `, Errors: ${errors.length}` : ''}`
      )
    );
  }

  return { updated, upToDate, errors };
}
