import { program } from 'commander';
import { ctx } from './utils/context.js';
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
  .version('1.0.0')
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

program.parse();
