import ora from 'ora';
import { ctx } from './context.js';

/**
 * Creates a spinner. Returns a silent no-op in non-TTY environments
 * (tests, CI, piped output) or when JSON output is requested (TUI mode),
 * so output stays clean.
 *
 * @param {string} text - Initial spinner text
 * @returns {import('ora').Ora | object}
 */
export function createSpinner(text) {
  if (!process.stdout.isTTY || ctx.json) {
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
