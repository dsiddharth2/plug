export function registerInstall(program) {
  program
    .command('install <name>')
    .description('Install a skill or command from a vault')
    .option('-g, --global', 'install globally to ~/.claude/')
    .action((name, options) => {
      console.log('install: not yet implemented', name, options);
    });
}
