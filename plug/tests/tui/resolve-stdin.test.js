import { describe, it, expect, vi } from 'vitest';
import { resolveStdin } from '../../src/tui/utils/resolve-stdin.js';

describe('resolveStdin', () => {
  it('returns process.stdin when isTTY is true', () => {
    const result = resolveStdin({ isTTY: true });
    expect(result).toBe(process.stdin);
  });

  it('returns a new ReadStream when isTTY is false and /dev/tty opens', () => {
    const fakeFd = 99;
    const fakeStream = { isTTY: true };
    const openSync = vi.fn().mockReturnValueOnce(fakeFd);
    const ReadStream = vi.fn().mockReturnValue(fakeStream);
    const result = resolveStdin({ isTTY: false, openSync, ReadStream });
    // Should have called openSync with /dev/tty first
    expect(openSync).toHaveBeenCalledWith('/dev/tty', 'r');
    expect(ReadStream).toHaveBeenCalledWith(fakeFd);
    expect(result).toBe(fakeStream);
  });

  it('falls back to CONIN$ when /dev/tty fails and CONIN$ succeeds', () => {
    const fakeFd = 100;
    const fakeStream = { isTTY: true };
    const openSync = vi.fn()
      .mockImplementationOnce(() => { throw new Error('no /dev/tty'); })
      .mockReturnValueOnce(fakeFd);
    const ReadStream = vi.fn().mockReturnValue(fakeStream);

    const result = resolveStdin({ isTTY: false, openSync, ReadStream });
    expect(openSync).toHaveBeenNthCalledWith(1, '/dev/tty', 'r');
    expect(openSync).toHaveBeenNthCalledWith(2, '\\\\.\\CONIN$', 'r');
    expect(ReadStream).toHaveBeenCalledWith(fakeFd);
    expect(result).toBe(fakeStream);
  });

  it('throws with a helpful message when both terminal paths fail', () => {
    const openSync = vi.fn().mockImplementation(() => { throw new Error('no tty'); });

    expect(() => resolveStdin({ isTTY: false, openSync })).toThrow(
      'PlugVault TUI requires an interactive terminal.'
    );
  });

  it('thrown error includes usage hints', () => {
    const openSync = vi.fn().mockImplementation(() => { throw new Error('no tty'); });

    let thrown;
    try {
      resolveStdin({ isTTY: false, openSync });
    } catch (err) {
      thrown = err;
    }

    expect(thrown.message).toContain('! plug');
    expect(thrown.message).toContain('plug install');
  });
});
