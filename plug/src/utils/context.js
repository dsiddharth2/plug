/**
 * Global CLI options context.
 * Set once in index.js via the Commander preAction hook,
 * then read by any command handler.
 */
const _opts = {
  verbose: false,
  json: false,
  yes: false,
};

export const ctx = {
  get verbose() { return _opts.verbose; },
  get json() { return _opts.json; },
  get yes() { return _opts.yes; },

  /** Merge new option values into the context. */
  set(opts) {
    if (opts.verbose !== undefined) _opts.verbose = Boolean(opts.verbose);
    if (opts.json !== undefined) _opts.json = Boolean(opts.json);
    if (opts.yes !== undefined) _opts.yes = Boolean(opts.yes);
  },

  /** Reset all options to defaults (useful in tests). */
  reset() {
    _opts.verbose = false;
    _opts.json = false;
    _opts.yes = false;
  },
};

/**
 * Print a debug line if --verbose is active.
 * @param {string} msg
 */
export function verbose(msg) {
  if (_opts.verbose) {
    process.stderr.write(`[verbose] ${msg}\n`);
  }
}
