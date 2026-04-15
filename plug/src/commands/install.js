import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { confirm, select } from '@inquirer/prompts';
import { findPackage, findAllPackages } from '../utils/registry.js';
import { downloadFile } from '../utils/fetcher.js';
import { trackInstall, isInstalled } from '../utils/tracker.js';
import { getClaudeSkillsDir, getClaudeAgentsDir, getClaudeDirForType, ensureDir } from '../utils/paths.js';
import { createSpinner } from '../utils/ui.js';
import { ctx, verbose } from '../utils/context.js';
import { pkgVersion } from '../utils/pkg-version.js';

export function registerInstall(program) {
  program
    .command('install <name>')
    .description('Install a skill or command from a vault')
    .option('-g, --global', 'install globally to ~/.claude/')
    .action(async (name, options) => {
      try {
        await runInstall(name, options);
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

export async function runInstall(name, options = {}) {
  const isGlobal = options.global || false;

  // Parse vault prefix (vault/name)
  let vaultName = null;
  let pkgName = name;
  if (name.includes('/')) {
    const slashIdx = name.indexOf('/');
    vaultName = name.slice(0, slashIdx);
    pkgName = name.slice(slashIdx + 1);
  }

  // Auto-init if .claude/ directories don't exist
  const skillsDir = getClaudeSkillsDir(isGlobal);
  const agentsDir = getClaudeAgentsDir(isGlobal);
  let skillsDirExists = false;
  try {
    await fs.access(skillsDir);
    skillsDirExists = true;
  } catch {
    skillsDirExists = false;
  }
  if (!skillsDirExists) {
    verbose('Auto-initializing .claude/ directories');
    await ensureDir(skillsDir);
    await ensureDir(getClaudeDirForType('command', isGlobal));
    await ensureDir(agentsDir);
  }

  // Resolve package — with conflict detection if no vault prefix
  const resolveSpinner = createSpinner('Resolving package...');
  let result;
  try {
    if (vaultName) {
      verbose(`Resolving ${pkgName} from vault ${vaultName}`);
      result = await findPackage(pkgName, vaultName);
      resolveSpinner.stop();
      if (!result) {
        throw new Error(`Package '${pkgName}' not found in vault '${vaultName}'.`);
      }
    } else {
      verbose(`Searching all vaults for ${pkgName}`);
      const allMatches = await findAllPackages(pkgName);
      resolveSpinner.stop();
      if (allMatches.length === 0) {
        throw new Error(`Package '${pkgName}' not found in any vault.`);
      }
      if (allMatches.length > 1) {
        verbose(`Found in ${allMatches.length} vaults: ${allMatches.map(m => m.vault.name).join(', ')}`);
        // Conflict — auto-pick first if --yes, else prompt
        if (ctx.yes) {
          result = allMatches[0];
        } else {
          const choice = await select({
            message: `'${pkgName}' found in multiple vaults. Select one:`,
            choices: allMatches.map((m) => ({
              name: `${m.vault.name} — ${m.pkg.description || '(no description)'}`,
              value: m,
            })),
          });
          result = choice;
        }
      } else {
        result = allMatches[0];
      }
    }
  } catch (err) {
    resolveSpinner.stop();
    throw err;
  }

  const { pkg, vault } = result;
  verbose(`Resolved ${pkgName} from vault ${vault.name} (v${pkg.version || '?'})`);

  // Overwrite prompt if already installed
  const alreadyInstalled = await isInstalled(pkgName, isGlobal);
  if (alreadyInstalled) {
    if (ctx.yes) {
      verbose(`--yes: auto-confirming overwrite of ${pkgName}`);
    } else {
      const overwrite = await confirm({
        message: `'${pkgName}' is already installed. Overwrite?`,
        default: false,
      });
      if (!overwrite) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ status: 'aborted', name: pkgName }) + '\n');
        } else {
          console.log(chalk.yellow('Aborted.'));
        }
        return;
      }
    }
  }

  // Download meta.json + entry file
  const dlSpinner = createSpinner(`Downloading ${pkgName}...`);
  let meta;
  let content;
  try {
    try {
      verbose(`Fetching meta.json from ${vault.name}`);
      const metaContent = await downloadFile(vault, `${pkg.path}/meta.json`);
      meta = JSON.parse(metaContent);
    } catch {
      // Fall back to registry data if meta.json is unavailable
      verbose('meta.json unavailable, falling back to registry data');
      meta = {
        type: pkg.type,
        entry: `${pkgName}.md`,
        version: pkg.version,
      };
    }

    const entryFile = meta.entry || `${pkgName}.md`;
    verbose(`Downloading entry file: ${entryFile}`);
    content = await downloadFile(vault, `${pkg.path}/${entryFile}`);
    dlSpinner.stop();
  } catch (err) {
    dlSpinner.stop();
    throw err;
  }

  // Route to correct directory by type
  const entryFile = meta.entry || `${pkgName}.md`;
  const type = meta.type || pkg.type || 'command';
  const destDir = getClaudeDirForType(type, isGlobal);
  await ensureDir(destDir);
  const destPath = path.join(destDir, entryFile);

  verbose(`Writing to ${destPath}`);
  try {
    await fs.writeFile(destPath, content, 'utf8');
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw Object.assign(
        new Error(`Cannot write to ${destPath}. Check permissions.`),
        { code: err.code },
      );
    }
    throw err;
  }

  // Track in installed.json
  const version = meta.version || pkg.version || pkgVersion;
  await trackInstall(
    pkgName,
    { type, vault: vault.name, version, path: destPath },
    isGlobal,
  );

  if (ctx.json) {
    process.stdout.write(JSON.stringify({
      status: 'installed',
      name: pkgName,
      type,
      vault: vault.name,
      version,
      path: destPath,
    }) + '\n');
  } else {
    console.log(chalk.green(`✓ Installed ${pkgName} (${type}) from ${vault.name}`));
    console.log(chalk.cyan(`  Path: ${destPath}`));
    if (type === 'skill') {
      console.log(chalk.cyan(`  Usage: The skill '${pkgName}' is available in your Claude project`));
    } else if (type === 'agent') {
      console.log(chalk.cyan(`  Usage: The agent '${pkgName}' is available for delegation`));
    } else {
      console.log(chalk.cyan(`  Usage: /${pkgName}`));
    }
  }
}
