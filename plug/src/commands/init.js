import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import {
  getClaudeSkillsDir,
  getClaudeCommandsDir,
  getInstalledFilePath,
  ensureDir,
} from '../utils/paths.js';
import { ctx } from '../utils/context.js';

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function runInit() {
  const skillsDir = getClaudeSkillsDir(false);
  const commandsDir = getClaudeCommandsDir(false);
  const installedFile = getInstalledFilePath(false);

  const created = [];
  const skipped = [];

  for (const dir of [skillsDir, commandsDir]) {
    if (await pathExists(dir)) {
      skipped.push(dir);
    } else {
      await ensureDir(dir);
      created.push(dir);
    }
  }

  if (await pathExists(installedFile)) {
    skipped.push(installedFile);
  } else {
    await ensureDir(path.dirname(installedFile));
    await fs.writeFile(installedFile, JSON.stringify({ installed: {} }, null, 2), 'utf8');
    created.push(installedFile);
  }

  if (ctx.json) {
    process.stdout.write(JSON.stringify({ created, skipped }) + '\n');
    return;
  }

  if (created.length > 0) {
    console.log(chalk.green('Initialized:'));
    for (const p of created) console.log(chalk.green(`  ${p}`));
  }
  if (skipped.length > 0) {
    console.log(chalk.yellow('Already exists (skipped):'));
    for (const p of skipped) console.log(chalk.yellow(`  ${p}`));
  }
}

export function registerInit(program) {
  program
    .command('init')
    .description('Initialize .claude/ and .plugvault/ directories in the current project')
    .action(async () => {
      try {
        await runInit();
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
