import { useEffect, useRef } from 'react';

/**
 * Bracketed-paste constants.
 * Terminals that support bracketed paste wrap pasted text between these markers.
 */
const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

/**
 * Hook that detects bracketed-paste sequences on stdin and delivers them
 * as a single string to the provided callback.
 *
 * Must be used alongside the bracketed-paste mode enable/disable in launchTui()
 * (which writes \x1b[?2004h on startup and \x1b[?2004l on exit).
 *
 * @param {(text: string) => void} onPaste - Called with the pasted text (markers stripped).
 * @param {{ isActive?: boolean }} [options] - Set isActive=false to suspend listening.
 */
export function usePaste(onPaste, { isActive = true } = {}) {
  const callbackRef = useRef(onPaste);
  callbackRef.current = onPaste;

  useEffect(() => {
    if (!isActive) return;

    let pasteBuffer = '';
    let isPasting = false;

    function handleData(data) {
      const str = typeof data === 'string' ? data : data.toString('utf-8');

      // Fast path: no paste markers and not mid-paste — skip entirely
      if (!isPasting && !str.includes(PASTE_START)) return;

      // Process the chunk, which may contain start/end markers
      let remaining = str;

      while (remaining.length > 0) {
        if (!isPasting) {
          const startIdx = remaining.indexOf(PASTE_START);
          if (startIdx === -1) break; // no more paste starts
          isPasting = true;
          pasteBuffer = '';
          remaining = remaining.slice(startIdx + PASTE_START.length);
        }

        // We're inside a paste sequence — look for the end marker
        const endIdx = remaining.indexOf(PASTE_END);
        if (endIdx === -1) {
          // End marker not in this chunk; buffer the rest and wait
          pasteBuffer += remaining;
          remaining = '';
        } else {
          // End marker found — complete the paste
          pasteBuffer += remaining.slice(0, endIdx);
          isPasting = false;
          const text = pasteBuffer;
          pasteBuffer = '';
          callbackRef.current(text);
          remaining = remaining.slice(endIdx + PASTE_END.length);
        }
      }
    }

    process.stdin.on('data', handleData);
    return () => {
      process.stdin.removeListener('data', handleData);
    };
  }, [isActive]);
}
