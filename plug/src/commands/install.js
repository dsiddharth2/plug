import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { confirm, select } from '@inquirer/prompts';
import { findPackage, findAllPackages } from '../utils/registry.js';
import { downloadFile } from '../utils/fetcher.js';
import { trackInstall, isInstalled } from '../utils/tracker.js';
import { getClaudeSkillsDir, getClaudeCommandsDir, ensureDir } from '../utils/paths.js';

export function registerInstall(program) {
  program
    .command('install <name>')
    .description('Install a skill or command from a vault')
    .option('-g, --global', 'install globally to ~/.claude/')
    .action(async (name, options) => {
      try {
        await runInstall(name, options);
      } catch (err) {
        if (err.code === 'EACCES' || err.code === 'EPERM') {
          console.error(chalk.red(`Cannot write to destination. Check permissions.`));
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
  const commandsDir = getClaudeCommandsDir(isGlobal);
  let skillsDirExists = false;
  try {
    await fs.access(skillsDir);
    skillsDirExists = true;
  } catch {
    skillsDirExists = false;
  }
  if (!skillsDirExists) {
    await ensureDir(skillsDir);
    await ensureDir(commandsDir);
  }

  // Resolve package — with conflict detection if no vault prefix
  let result;
  if (vaultName) {
    result = await findPackage(pkgName, vaultName);
    if (!result) {
      throw new Error(`Package '${pkgName}' not found in vault '${vaultName}'.`);
    }
  } else {
    const allMatches = await findAllPackages(pkgName);
    if (allMatches.length === 0) {
      throw new Error(`Package '${pkgName}' not found in any vault.`);
    }
    if (allMatches.length > 1) {
      // Conflict — prompt user to pick a vault
      const choice = await select({
        message: `'${pkgName}' found in multiple vaults. Select one:`,
        choices: allMatches.map((m) => ({
          name: `${m.vault.name} — ${m.pkg.description || '(no description)'}`,
          value: m,
        })),
      });
      result = choice;
    } else {
      result = allMatches[0];
    }
  }

  const { pkg, vault } = result;

  // Overwrite prompt if already installed
  const alreadyInstalled = await isInstalled(pkgName, isGlobal);
  if (alreadyInstalled) {
    const overwrite = await confirm({
      message: `'${pkgName}' is already installed. Overwrite?`,
      default: false,
    });
    if (!overwrite) {
      console.log(chalk.yellow('Aborted.'));
      return;
    }
  }

  // Fetch meta.json from the vault
  let meta;
  try {
    const metaContent = await downloadFile(vault, `${pkg.path}/meta.json`);
    meta = JSON.parse(metaContent);
  } catch {
    // Fall back to registry data if meta.json is unavailable
    meta = {
      type: pkg.type,
      entry: `${pkgName}.md`,
      version: pkg.version,
    };
  }

  // Download the entry file
  const entryFile = meta.entry || `${pkgName}.md`;
  const content = await downloadFile(vault, `${pkg.path}/${entryFile}`);

  // Route to correct directory by type
  const type = meta.type || pkg.type || 'command';
  const destDir = type === 'skill' ? getClaudeSkillsDir(isGlobal) : getClaudeCommandsDir(isGlobal);
  await ensureDir(destDir);
  const destPath = path.join(destDir, entryFile);

  await fs.writeFile(destPath, content, 'utf8');

  // Track in installed.json
  await trackInstall(
    pkgName,
    {
      type,
      vault: vault.name,
      version: meta.version || pkg.version || '1.0.0',
      path: destPath,
    },
    isGlobal,
  );

  // Print result with usage hint
  console.log(chalk.green(`✓ Installed ${pkgName} (${type}) from ${vault.name}`));
  console.log(chalk.cyan(`  Path: ${destPath}`));
  if (type === 'skill') {
    console.log(chalk.cyan(`  Usage: The skill '${pkgName}' is available in your Claude project`));
  } else {
    console.log(chalk.cyan(`  Usage: /${pkgName}`));
  }
}
