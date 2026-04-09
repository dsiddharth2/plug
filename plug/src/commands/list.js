export function registerList(program) {
  program
    .command('list')
    .description('List installed skills and commands')
    .option('--remote', 'list all available across all vaults')
    .option('--vault <name>', 'filter by vault name')
    .option('--type <type>', 'filter by type (skill or command)')
    .action((options) => {
      console.log('list: not yet implemented', options);
    });
}
