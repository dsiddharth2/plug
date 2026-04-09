export function registerUpdate(program) {
  program
    .command('update [name]')
    .description('Update an installed skill or command to the latest version')
    .option('--all', 'update all installed skills and commands')
    .action((name, options) => {
      console.log('update: not yet implemented', name, options);
    });
}
