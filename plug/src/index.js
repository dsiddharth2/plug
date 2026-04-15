import { program } from 'commander';
import { ctx } from './utils/context.js';
import { pkgVersion } from './utils/pkg-version.js';
import { registerInit } from './commands/init.js';
import { registerInstall } from './commands/install.js';
import { registerRemove } from './commands/remove.js';
import { registerList } from './commands/list.js';
import { registerSearch } from './commands/search.js';
import { registerUpdate } from './commands/update.js';
import { registerVault } from './commands/vault.js';

program
  .name('plug')
  .description('Install Claude skills and commands from vaults')
  .version(pkgVersion)
  .option('--verbose', 'enable debug output (log fetch URLs, auth method, cache hits)')
  .option('--json', 'output results as machine-readable JSON')
  .option('--yes', 'skip interactive prompts (auto-confirm overwrites, auto-pick first vault on conflict)');

// Propagate global options to context before every command action
program.hook('preAction', () => {
  ctx.set(program.opts());
});

registerInit(program);
registerInstall(program);
registerRemove(program);
registerList(program);
registerSearch(program);
registerUpdate(program);
registerVault(program);

// 'plug tui' — explicit TUI launch subcommand
program
  .command('tui')
  .description('Launch the interactive TUI (default when no args given)')
  .action(launchTui);

// Default: no args → launch TUI; otherwise run existing CLI
if (process.argv.length <= 2) {
  await launchTui();
} else {
  program.parse();
}

async function launchTui() {
  const { resolveStdin } = await import('./tui/utils/resolve-stdin.js');
  let inputStream;
  try {
    inputStream = resolveStdin();
  } catch (err) {
    process.stderr.write(err.message + '\n');
    process.exit(1);
  }

  const { render } = await import('ink');
  const { createElement } = await import('react');
  const { default: App } = await import('./tui/app.jsx');
  const options = inputStream !== process.stdin ? { stdin: inputStream } : {};
  render(createElement(App), options);
}
