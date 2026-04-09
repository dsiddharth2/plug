import { program } from 'commander';
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
  .version('1.0.0');

registerInit(program);
registerInstall(program);
registerRemove(program);
registerList(program);
registerSearch(program);
registerUpdate(program);
registerVault(program);

program.parse();
