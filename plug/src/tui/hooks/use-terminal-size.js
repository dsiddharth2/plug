import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

/**
 * Returns the current terminal dimensions and triggers a re-render on resize.
 * Properly cleans up the resize listener on unmount (no dangling listeners).
 *
 * @returns {{ columns: number, rows: number }}
 */
export function useTerminalSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  });

  useEffect(() => {
    if (!stdout) return;

    function onResize() {
      setSize({ columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
    }

    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  return size;
}
