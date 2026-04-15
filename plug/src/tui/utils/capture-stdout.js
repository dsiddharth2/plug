import { AsyncLocalStorage } from 'async_hooks';

const captureStorage = new AsyncLocalStorage();

/**
 * Yields to the Node.js event loop so Ink can flush any pending React renders
 * to the real terminal before stdout is intercepted by captureOutput.
 */
export function yieldToInk() {
  return new Promise((r) => setImmediate(r));
}

/**
 * Temporarily intercepts process.stdout.write and process.stderr.write,
 * but ONLY for writes originating from the provided asyncFn (and its children).
 *
 * This allows Ink's background re-renders (e.g. animated spinners) to continue
 * rendering to the real terminal while we capture the output of the CLI command.
 *
 * @param {() => Promise<any>} asyncFn - Async function whose output to capture
 * @returns {Promise<{ value: any, captured: string }>}
 */
export async function captureOutput(asyncFn) {
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  let captured = '';

  const capture = (chunk, encoding, callback) => {
    const store = captureStorage.getStore();
    if (store) {
      // Inside capture context — intercept
      store.captured += typeof chunk === 'string' ? chunk : chunk.toString(encoding || 'utf8');
      if (typeof callback === 'function') callback();
      return true;
    }
    // Outside capture context — pass through to real terminal
    return origStdoutWrite(chunk, encoding, callback);
  };

  const captureErr = (chunk, encoding, callback) => {
    const store = captureStorage.getStore();
    if (store) {
      store.captured += typeof chunk === 'string' ? chunk : chunk.toString(encoding || 'utf8');
      if (typeof callback === 'function') callback();
      return true;
    }
    return origStderrWrite(chunk, encoding, callback);
  };

  process.stdout.write = capture;
  process.stderr.write = captureErr;

  try {
    const store = { captured: '' };
    const value = await captureStorage.run(store, asyncFn);
    captured = store.captured;
    return { value, captured };
  } finally {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
  }
}
