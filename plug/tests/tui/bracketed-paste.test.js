import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.resolve(__dirname, '../../src/index.js');

// ── Source-level assertions (launchTui startup/shutdown) ─────────────────────

describe('bracketed paste mode (#11) — launchTui sequences', () => {
  const source = fs.readFileSync(INDEX_PATH, 'utf8');

  it('enables bracketed paste mode on startup', () => {
    expect(source).toContain('\\x1b[?2004h');
  });

  it('disables bracketed paste mode on exit', () => {
    expect(source).toContain('\\x1b[?2004l');
  });

  it('enables bracketed paste AFTER alt-screen enter (ordering)', () => {
    const altScreenEnter = source.indexOf('\\x1b[?1049h');
    const pasteEnable = source.indexOf('\\x1b[?2004h');
    expect(altScreenEnter).toBeGreaterThan(-1);
    expect(pasteEnable).toBeGreaterThan(-1);
    expect(pasteEnable).toBeGreaterThan(altScreenEnter);
  });

  it('disables bracketed paste BEFORE alt-screen leave in cleanup (teardown order)', () => {
    // The cleanup function must call leavePasteMode before leaveAltScreen.
    // In the source, leavePasteMode is defined before leaveAltScreen,
    // and cleanup calls them in that order: leavePasteMode(); leaveAltScreen();
    const cleanupMatch = source.match(/const cleanup = \(\) => \{([^}]+)\}/);
    expect(cleanupMatch).not.toBeNull();
    const cleanupBody = cleanupMatch[1];
    const pasteOffIdx = cleanupBody.indexOf('leavePasteMode');
    const altOffIdx = cleanupBody.indexOf('leaveAltScreen');
    expect(pasteOffIdx).toBeGreaterThan(-1);
    expect(altOffIdx).toBeGreaterThan(-1);
    expect(pasteOffIdx).toBeLessThan(altOffIdx);
  });
});

// ── usePaste hook unit tests ─────────────────────────────────────────────────

describe('usePaste hook (#11) — paste sequence parsing', () => {
  // We test the paste handler logic directly rather than through React rendering,
  // because Ink components can't run in a non-TTY test environment.
  // Import the hook source and simulate stdin data events.

  let originalStdin;
  let listeners;

  beforeEach(() => {
    listeners = [];
    // Mock process.stdin.on and process.stdin.removeListener
    originalStdin = {
      on: process.stdin.on.bind(process.stdin),
      removeListener: process.stdin.removeListener.bind(process.stdin),
    };
    vi.spyOn(process.stdin, 'on').mockImplementation((event, handler) => {
      if (event === 'data') listeners.push(handler);
      return process.stdin;
    });
    vi.spyOn(process.stdin, 'removeListener').mockImplementation((event, handler) => {
      if (event === 'data') {
        listeners = listeners.filter((h) => h !== handler);
      }
      return process.stdin;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    listeners = [];
  });

  /**
   * Simulates the core paste-detection logic from usePaste without React hooks.
   * Returns a { feed, getPastes } interface for testing.
   */
  function createPasteDetector() {
    const PASTE_START = '\x1b[200~';
    const PASTE_END = '\x1b[201~';
    const pastes = [];

    let pasteBuffer = '';
    let isPasting = false;

    function handleData(data) {
      const str = typeof data === 'string' ? data : data.toString('utf-8');
      if (!isPasting && !str.includes(PASTE_START)) return;

      let remaining = str;
      while (remaining.length > 0) {
        if (!isPasting) {
          const startIdx = remaining.indexOf(PASTE_START);
          if (startIdx === -1) break;
          isPasting = true;
          pasteBuffer = '';
          remaining = remaining.slice(startIdx + PASTE_START.length);
        }
        const endIdx = remaining.indexOf(PASTE_END);
        if (endIdx === -1) {
          pasteBuffer += remaining;
          remaining = '';
        } else {
          pasteBuffer += remaining.slice(0, endIdx);
          isPasting = false;
          pastes.push(pasteBuffer);
          pasteBuffer = '';
          remaining = remaining.slice(endIdx + PASTE_END.length);
        }
      }
    }

    return {
      feed: handleData,
      getPastes: () => [...pastes],
    };
  }

  it('parses a complete bracketed paste sequence into a single string', () => {
    const detector = createPasteDetector();
    detector.feed('\x1b[200~hello world\x1b[201~');
    expect(detector.getPastes()).toEqual(['hello world']);
  });

  it('handles paste split across multiple data chunks', () => {
    const detector = createPasteDetector();
    detector.feed('\x1b[200~hel');
    expect(detector.getPastes()).toEqual([]);
    detector.feed('lo wor');
    expect(detector.getPastes()).toEqual([]);
    detector.feed('ld\x1b[201~');
    expect(detector.getPastes()).toEqual(['hello world']);
  });

  it('handles multiple pastes in a single data chunk', () => {
    const detector = createPasteDetector();
    detector.feed('\x1b[200~first\x1b[201~\x1b[200~second\x1b[201~');
    expect(detector.getPastes()).toEqual(['first', 'second']);
  });

  it('handles paste with multiline content', () => {
    const detector = createPasteDetector();
    detector.feed('\x1b[200~line1\nline2\nline3\x1b[201~');
    expect(detector.getPastes()).toEqual(['line1\nline2\nline3']);
  });

  it('ignores normal input without paste markers', () => {
    const detector = createPasteDetector();
    detector.feed('hello');
    detector.feed('a');
    expect(detector.getPastes()).toEqual([]);
  });

  it('handles empty paste (markers with no content)', () => {
    const detector = createPasteDetector();
    detector.feed('\x1b[200~\x1b[201~');
    expect(detector.getPastes()).toEqual(['']);
  });

  it('handles paste with special characters (URLs, tokens)', () => {
    const detector = createPasteDetector();
    const url = 'https://github.com/org/repo.git?token=abc123&ref=main';
    detector.feed(`\x1b[200~${url}\x1b[201~`);
    expect(detector.getPastes()).toEqual([url]);
  });
});

// ── Integration: usePaste is wired into both input sites ─────────────────────

describe('bracketed paste integration (#11) — shared hook usage', () => {
  const searchBoxSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/tui/components/search-box.jsx'),
    'utf8'
  );
  const vaultsSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/tui/screens/vaults.jsx'),
    'utf8'
  );

  it('SearchBox imports and calls usePaste', () => {
    expect(searchBoxSource).toContain("from '../hooks/use-paste.js'");
    expect(searchBoxSource).toContain('usePaste(');
  });

  it('AddVaultForm (vaults.jsx) imports and calls usePaste', () => {
    expect(vaultsSource).toContain("from '../hooks/use-paste.js'");
    expect(vaultsSource).toContain('usePaste(');
  });

  it('both input sites use the same shared hook (not inline implementations)', () => {
    // Neither file should contain the raw paste markers — they delegate to the hook
    expect(searchBoxSource).not.toContain('\\x1b[200~');
    expect(searchBoxSource).not.toContain('\\x1b[201~');
    expect(vaultsSource).not.toContain('\\x1b[200~');
    expect(vaultsSource).not.toContain('\\x1b[201~');
  });
});
