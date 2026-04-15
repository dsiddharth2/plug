import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const INTERVAL_MS = 80;

/**
 * Animated spinner with optional label.
 *
 * @param {{ label?: string, color?: string }} props
 */
export default function Spinner({ label = '', color = 'cyan' }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Text color={color}>
      {FRAMES[frame]}{label ? ` ${label}` : ''}
    </Text>
  );
}
