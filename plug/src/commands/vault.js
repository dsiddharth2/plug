import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { getConfig, saveConfig } from '../utils/config.js';
import { getCachedRegistry, cacheRegistry } from '../utils/registry.js';
import { getAuthHeaders } from '../utils/auth.js';
import { getCacheDir } from '../utils/paths.js';
import { GITHUB_RAW_BASE, REGISTRY_FILE, DEFAULT_BRANCH } from '../constants.js';
import { createSpinner } from '../utils/ui.js';
import { ctx, verbose } from '../utils/context.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses a GitHub URL and returns { owner, repo } or null.
 * Accepts: https://github.com/owner/repo  or  https://github.com/owner/repo.git
 */
export function parseGithubUrl(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/**
 * Tests connectivity to a vault by fetching its registry.json.
 * Uses vault.token directly (does NOT read config/env).
 * Returns { ok: true, data } or { ok: false, status?, error? }.
 */
export async function checkConnectivity(vault) {
  const branch = vault.branch || DEFAULT_BRANCH;
  const url = `${GITHUB_RAW_BASE}/${vault.owner}/${vault.repo}/${branch}/${REGISTRY_FILE}`;
  const headers = vault.token ? { Authorization: `Bearer ${vault.token}` } : {};

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return { ok: false, status: response.status };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Deletes the cache file for a vault (if it exists).
 */
async function clearVaultCache(name) {
  try {
    const cacheFile = path.join(getCacheDir(), `${name}.json`);
    await fs.rm(cacheFile, { force: true });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Exported core logic (for testing)
// ---------------------------------------------------------------------------

export async function runVaultAdd(name, url, options = {}) {
  // Validate URL syntax
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const parsed = parseGithubUrl(url);
  if (!parsed) {
    throw new Error(
      `Could not parse GitHub URL: ${url}\nExpected format: https://github.com/owner/repo`,
    );
  }

  const config = await getConfig();

  if (config.vaults[name]) {
    throw new Error(`Vault '${name}' already exists. Remove it first with: plug vault remove ${name}`);
  }

  const newVault = {
    name,
    owner: parsed.owner,
    repo: parsed.repo,
    branch: DEFAULT_BRANCH,
    private: options.private || false,
    ...(options.token ? { token: options.token } : {}),
  };

  // Test connectivity
  verbose(`Testing connectivity to ${url}`);
  const spinner = createSpinner(`Testing connectivity to ${url}...`);
  const result = await checkConnectivity(newVault);
  spinner.stop();
  verbose(`Connectivity result: ok=${result.ok}${result.status ? ` status=${result.status}` : ''}${result.error ? ` error=${result.error}` : ''}`);

  if (!result.ok) {
    if (result.status === 401 || result.status === 403) {
      if (!ctx.json) console.log(
        chalk.yellow(`Warning: Authentication failed for vault '${name}'. The vault was added but you may need a token: plug vault set-token ${name} <token>`),
      );
    } else if (result.status === 404) {
      if (!ctx.json) console.log(
        chalk.yellow(`Warning: registry.json not found at ${url}. The vault was added but may not have a valid registry.`),
      );
    } else {
      if (!ctx.json) console.log(
        chalk.yellow(`Warning: Could not connect to ${url} (${result.error || `HTTP ${result.status}`}). Vault added anyway.`),
      );
    }
  }

  config.vaults[name] = newVault;
  config.resolve_order.push(name);
  await saveConfig(config);
  verbose(`Vault '${name}' saved to config`);

  const pkgCount =
    result.ok && result.data ? Object.keys(result.data.packages || {}).length : null;

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ status: 'added', name, url, packages: pkgCount }) + '\n');
  } else if (pkgCount !== null) {
    console.log(
      chalk.green(`Vault '${name}' added. Found ${pkgCount} package${pkgCount !== 1 ? 's' : ''} in registry.`),
    );
  } else {
    console.log(chalk.green(`Vault '${name}' added successfully.`));
  }

  return newVault;
}

export async function runVaultRemove(name, options = {}) {
  if (name === 'official' && !options.force) {
    throw new Error(`Cannot remove the official vault. Use --force to override.`);
  }

  const config = await getConfig();

  if (!config.vaults[name]) {
    throw new Error(`Vault '${name}' not found.`);
  }

  delete config.vaults[name];
  config.resolve_order = config.resolve_order.filter((v) => v !== name);

  if (config.default_vault === name) {
    config.default_vault = config.resolve_order[0] || 'official';
  }

  await saveConfig(config);
  await clearVaultCache(name);
  verbose(`Vault '${name}' removed and cache cleared`);

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ status: 'removed', name }) + '\n');
  } else {
    console.log(chalk.green(`Vault '${name}' removed.`));
  }
}

export async function runVaultList() {
  const config = await getConfig();
  const vaults = config.vaults || {};
  const order = config.resolve_order || [];
  const defaultVault = config.default_vault || 'official';

  const rows = [];
  for (const name of order) {
    const v = vaults[name];
    if (!v) continue;

    let pkgCount = '-';
    const cached = await getCachedRegistry(name);
    if (cached) {
      pkgCount = String(Object.keys(cached.packages || {}).length);
    }

    rows.push({
      name,
      url: `https://github.com/${v.owner}/${v.repo}`,
      visibility: v.private ? 'private' : 'public',
      default: name === defaultVault ? 'yes' : '',
      packages: pkgCount,
    });
  }

  if (ctx.json) {
    process.stdout.write(JSON.stringify(rows) + '\n');
    return rows;
  }

  if (rows.length === 0) {
    console.log(chalk.yellow('No vaults configured.'));
    return rows;
  }

  const header = `${'NAME'.padEnd(15)} ${'URL'.padEnd(45)} ${'VISIBILITY'.padEnd(12)} ${'DEFAULT'.padEnd(8)} PACKAGES`;
  console.log(chalk.cyan(`\n${header}`));
  console.log(chalk.cyan(`${'-'.repeat(header.length)}`));
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(15)} ${row.url.padEnd(45)} ${row.visibility.padEnd(12)} ${row.default.padEnd(8)} ${row.packages}`,
    );
  }
  console.log();

  return rows;
}

export async function runVaultSetDefault(name) {
  const config = await getConfig();

  if (!config.vaults[name]) {
    throw new Error(`Vault '${name}' not found.`);
  }

  config.default_vault = name;
  config.resolve_order = config.resolve_order.filter((v) => v !== name);
  config.resolve_order.unshift(name);

  await saveConfig(config);
  verbose(`Default vault updated to '${name}', resolve_order: ${config.resolve_order.join(', ')}`);

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ status: 'default-set', name }) + '\n');
  } else {
    console.log(chalk.green(`Default vault set to '${name}'.`));
  }
}

export async function runVaultSetToken(name, token) {
  const config = await getConfig();

  if (!config.vaults[name]) {
    throw new Error(`Vault '${name}' not found.`);
  }

  config.vaults[name].token = token;
  await saveConfig(config);

  // Test connectivity with the new token
  verbose(`Testing connectivity for vault '${name}' with new token`);
  const spinner = createSpinner('Testing connectivity with new token...');
  const result = await checkConnectivity(config.vaults[name]);
  spinner.stop();
  verbose(`Set-token connectivity: ok=${result.ok}`);

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ status: 'token-set', name, connected: result.ok }) + '\n');
  } else if (result.ok) {
    console.log(chalk.green(`Token updated and connectivity verified for vault '${name}'.`));
  } else {
    console.log(
      chalk.yellow(`Token updated for vault '${name}', but connectivity test failed (${result.error || `HTTP ${result.status}`}).`),
    );
  }
}

export async function runVaultSync() {
  const config = await getConfig();
  const order = config.resolve_order || [];

  let synced = 0;
  let totalPackages = 0;
  const errors = [];

  verbose(`Syncing ${order.length} vault(s): ${order.join(', ')}`);
  const spinner = createSpinner('Syncing vaults...');

  for (const name of order) {
    const v = config.vaults[name];
    if (!v) continue;

    spinner.text = `Syncing '${name}'...`;
    verbose(`Syncing vault '${name}' from ${v.owner}/${v.repo}`);

    try {
      // Clear cache to force a fresh fetch
      await clearVaultCache(name);

      // Re-fetch using config-aware auth (vault is already saved to config)
      const branch = v.branch || DEFAULT_BRANCH;
      const url = `${GITHUB_RAW_BASE}/${v.owner}/${v.repo}/${branch}/${REGISTRY_FILE}`;
      verbose(`Fetching ${url}`);
      const headers = await getAuthHeaders(name);

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      await cacheRegistry(name, data);

      const pkgCount = Object.keys(data.packages || {}).length;
      totalPackages += pkgCount;
      synced++;
      verbose(`Vault '${name}' synced: ${pkgCount} packages`);
      if (!ctx.json) console.log(chalk.green(`  ✓ Synced '${name}': ${pkgCount} package${pkgCount !== 1 ? 's' : ''}`));
    } catch (err) {
      errors.push(name);
      verbose(`Failed to sync vault '${name}': ${err.message}`);
      if (!ctx.json) console.log(chalk.yellow(`  Warning: Failed to sync vault '${name}': ${err.message}`));
    }
  }

  spinner.stop();

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ synced, totalPackages, errors }) + '\n');
  } else {
    console.log(
      chalk.bold(`\nSynced ${synced} vault${synced !== 1 ? 's' : ''}, ${totalPackages} package${totalPackages !== 1 ? 's' : ''} available.`),
    );
    if (errors.length > 0) {
      console.log(chalk.yellow(`Failed to sync: ${errors.join(', ')}`));
    }
  }

  return { synced, totalPackages, errors };
}

// ---------------------------------------------------------------------------
// Commander registration
// ---------------------------------------------------------------------------

export function registerVault(program) {
  const vault = program
    .command('vault')
    .description('Manage vaults (registries of skills and commands)');

  vault
    .command('add <name> <url>')
    .description('Register a vault')
    .option('--token <token>', 'auth token for private vaults')
    .option('--private', 'mark vault as private')
    .action(async (name, url, options) => {
      try {
        await runVaultAdd(name, url, options);
      } catch (err) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  vault
    .command('remove <name>')
    .description('Unregister a vault')
    .option('--force', 'force removal of the official vault')
    .action(async (name, options) => {
      try {
        await runVaultRemove(name, options);
      } catch (err) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  vault
    .command('list')
    .description('List all registered vaults')
    .action(async () => {
      try {
        await runVaultList();
      } catch (err) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  vault
    .command('set-default <name>')
    .description('Set the default vault')
    .action(async (name) => {
      try {
        await runVaultSetDefault(name);
      } catch (err) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  vault
    .command('set-token <name> <token>')
    .description('Set or update auth token for a vault')
    .action(async (name, token) => {
      try {
        await runVaultSetToken(name, token);
      } catch (err) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  vault
    .command('sync')
    .description('Refresh registries from all vaults')
    .action(async () => {
      try {
        await runVaultSync();
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
