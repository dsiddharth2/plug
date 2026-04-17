import chalk from 'chalk';
import fs from 'fs/promises';
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
      verbose(`Removing file at ${pkg.path}`);
      try {
        await fs.unlink(pkg.path);
      } catch (err) {
        if (err.code === 'EACCES' || err.code === 'EPERM') {
          throw Object.assign(
            new Error(`Cannot remove '${pkg.path}'. Check permissions.`),
            { code: err.code },
          );
        }
        if (err.code !== 'ENOENT') {
          throw err;
        }
        verbose(`File already gone (ENOENT), removing from tracker`);
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

  verbose(`Removing file at ${pkg.path}`);
  try {
    await fs.unlink(pkg.path);
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw Object.assign(
        new Error(`Cannot remove '${pkg.path}'. Check permissions.`),
        { code: err.code },
      );
    }
    if (err.code !== 'ENOENT') {
      throw err;
    }
    verbose(`File already gone (ENOENT), removing from tracker`);
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
