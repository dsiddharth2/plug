/**
 * Temporarily intercepts process.stdout.write and process.stderr.write,
 * runs an async function, captures all output as a string, then restores.
 *
 * This prevents runInstall/runUpdate/runRemove console output from corrupting
 * Ink's terminal rendering during TUI operation.
 *
 * @param {() => Promise<any>} asyncFn - Async function whose stdout/stderr to capture
 * @returns {Promise<{ value: any, captured: string }>}
 */
export async function captureOutput(asyncFn) {
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  let captured = '';

  const capture = (chunk, encoding, callback) => {
    captured += typeof chunk === 'string' ? chunk : chunk.toString(encoding || 'utf8');
    if (typeof callback === 'function') callback();
    return true;
  };

  process.stdout.write = capture;
  process.stderr.write = capture;

  try {
    const value = await asyncFn();
    return { value, captured };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}
