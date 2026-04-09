export function registerInstall(program) {
  program
    .command('install')
    .description('Install a skill or command from a vault')
    .requiredOption('-i, --item <name>', 'name of the skill/command to install (use vault/name for specific vault)')
    .option('-g, --global', 'install globally to ~/.claude/')
    .action((options) => {
      console.log('install: not yet implemented', options);
    });
}
