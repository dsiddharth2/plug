export function registerRemove(program) {
  program
    .command('remove <name>')
    .description('Remove an installed skill or command')
    .option('-g, --global', 'remove from global ~/.claude/ install')
    .action((name, options) => {
      console.log('remove: not yet implemented', name, options);
    });
}
