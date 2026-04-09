export function registerInit(program) {
  program
    .command('init')
    .description('Initialize .claude/ and .plugvault/ directories in the current project')
    .action(() => {
      console.log('init: not yet implemented');
    });
}
