import ora from 'ora';

/**
 * Creates a spinner. Returns a silent no-op in non-TTY environments
 * (tests, CI, piped output) so output stays clean.
 * In TTY mode, starts and returns an ora spinner.
 *
 * @param {string} text - Initial spinner text
 * @returns {import('ora').Ora | object}
 */
export function createSpinner(text) {
  if (!process.stdout.isTTY) {
    return {
      start() { return this; },
      stop() { return this; },
      succeed() { return this; },
      fail() { return this; },
      warn() { return this; },
      info() { return this; },
      get text() { return ''; },
      set text(_) {},
    };
  }
  return ora(text).start();
}
