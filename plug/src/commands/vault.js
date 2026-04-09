export function registerVault(program) {
  const vault = program
    .command('vault')
    .description('Manage vaults (registries of skills and commands)');

  vault
    .command('add <name> <url>')
    .description('Register a vault')
    .option('--token <token>', 'auth token for private vaults')
    .option('--private', 'use system git credentials for private vault')
    .action((name, url, options) => {
      console.log('vault add: not yet implemented', name, url, options);
    });

  vault
    .command('remove <name>')
    .description('Unregister a vault')
    .option('--force', 'force removal of the official vault')
    .action((name, options) => {
      console.log('vault remove: not yet implemented', name, options);
    });

  vault
    .command('list')
    .description('List all registered vaults')
    .action(() => {
      console.log('vault list: not yet implemented');
    });

  vault
    .command('set-default <name>')
    .description('Set the default vault')
    .action((name) => {
      console.log('vault set-default: not yet implemented', name);
    });

  vault
    .command('set-token <name> <token>')
    .description('Set or update auth token for a vault')
    .action((name, token) => {
      console.log('vault set-token: not yet implemented', name);
    });

  vault
    .command('sync')
    .description('Refresh registries from all vaults')
    .action(() => {
      console.log('vault sync: not yet implemented');
    });
}
