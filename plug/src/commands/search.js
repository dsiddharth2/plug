export function registerSearch(program) {
  program
    .command('search <keyword>')
    .description('Search across all vaults by name, description, or tags')
    .option('--vault <name>', 'search in a specific vault only')
    .option('--type <type>', 'filter by type (skill or command)')
    .action((keyword, options) => {
      console.log('search: not yet implemented', keyword, options);
    });
}
