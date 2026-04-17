import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { select, confirm } from '@inquirer/prompts';
import { getInstalled, trackRemove, prunableOrphans, removeDependentEdge } from '../utils/tracker.js';
import { ctx, verbose } from '../utils/context.js';

export function registerRemove(program) {
  program
    .command('remove <name>')
    .description('Remove an installed skill, command, or agent')
    .option('-g, --global', 'remove from global ~/.claude/ install')
    .action(async (name, options) => {
      try {
        await runRemove(name, options);
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

export async function runRemove(name, options = {}) {
  const isGlobal = options.global || false;
  verbose(`Removing '${name}' (global=${isGlobal})`);

  const data = await getInstalled(isGlobal);
  const pkg = data.installed[name];

  if (!pkg) {
    if (ctx.json) {
      process.stdout.write(JSON.stringify({ status: 'not-installed', name }) + '\n');
    } else {
      console.log(chalk.yellow(`'${name}' is not installed.`));
    }
    return;
  }

  const dependents = pkg.dependents ?? [];

  if (dependents.length > 0 && !options._cascade) {
    const choice = await select({
      message: `'${name}' is required by: ${dependents.join(', ')}. How do you want to proceed?`,
      choices: [
        { name: 'Cancel', value: 'cancel' },
        { name: 'Remove all (cascade) — removes dependents first, then this package', value: 'cascade' },
        { name: 'Force remove — removes only this package, severs dependent edges', value: 'force' },
      ],
    });

    if (choice === 'cancel') {
      return;
    }

    if (choice === 'cascade') {
      for (const dep of dependents) {
        await runRemove(dep, { global: isGlobal, _cascade: true });
      }
      // fall through to remove the target below
    }

    if (choice === 'force') {
      const filesToRemove = pkg.files && pkg.files.length > 0 ? pkg.files : [pkg.path];
      for (const filePath of filesToRemove) {
        verbose(`Removing file at ${filePath}`);
        try {
          await fs.unlink(filePath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            verbose(`Failed to remove ${filePath}: ${err.message}`);
          }
        }
        await cleanEmptyParents(filePath);
      }

      await trackRemove(name, isGlobal);
      for (const dep of dependents) {
        await removeDependentEdge(name, dep, isGlobal);
      }
      verbose(`'${name}' force-removed from tracker`);

      if (ctx.json) {
        process.stdout.write(JSON.stringify({ status: 'removed', name }) + '\n');
      } else {
        console.log(chalk.green(`✓ Removed ${name}`));
      }

      await _pruneOrphans(isGlobal);
      return;
    }
  }

  const filesToRemove = pkg.files && pkg.files.length > 0 ? pkg.files : [pkg.path];
  for (const filePath of filesToRemove) {
    verbose(`Removing file at ${filePath}`);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        verbose(`Failed to remove ${filePath}: ${err.message}`);
      }
    }
    // Always try to clean parents even if unlink failed (e.g. already gone)
    await cleanEmptyParents(filePath);
  }

  await trackRemove(name, isGlobal);
  verbose(`'${name}' removed from tracker`);

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ status: 'removed', name }) + '\n');
  } else {
    console.log(chalk.green(`✓ Removed ${name}`));
  }

  await _pruneOrphans(isGlobal);
}

/**
 * Recursively deletes empty parent directories up to (but not including) .claude subdirs.
 * @param {string} filePath
 */
export async function cleanEmptyParents(filePath) {
  let currentDir = path.dirname(filePath);
  while (true) {
    const dirName = path.basename(currentDir);
    // Stop if we hit one of the core subdirs
    if (['skills', 'commands', 'agents', '.claude', '.plugvault'].includes(dirName)) break;

    try {
      const files = await fs.readdir(currentDir);
      if (files.length === 0) {
        verbose(`Removing empty directory: ${currentDir}`);
        await fs.rmdir(currentDir);
        
        const parent = path.dirname(currentDir);
        if (parent === currentDir) break; // Root reached
        currentDir = parent;
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

async function _pruneOrphans(isGlobal) {
  const orphans = await prunableOrphans(isGlobal);
  if (orphans.length === 0) return;

  if (ctx.yes) {
    for (const orphan of orphans) {
      await runRemove(orphan, { global: isGlobal });
    }
    return;
  }

  const shouldPrune = await confirm({
    message: `${orphans.length} orphaned package(s) found: ${orphans.join(', ')}. Remove them?`,
    default: false,
  });

  if (shouldPrune) {
    for (const orphan of orphans) {
      await runRemove(orphan, { global: isGlobal });
    }
  }
}
