import { describe, it, expect } from 'vitest';
import { createSpinner } from '../src/utils/ui.js';

describe('createSpinner', () => {
  it('returns a no-op spinner in non-TTY environments', () => {
    // In test/CI environments process.stdout.isTTY is falsy
    const spinner = createSpinner('Loading...');
    expect(typeof spinner.start).toBe('function');
    expect(typeof spinner.stop).toBe('function');
    expect(typeof spinner.succeed).toBe('function');
    expect(typeof spinner.fail).toBe('function');
    expect(typeof spinner.warn).toBe('function');
    expect(typeof spinner.info).toBe('function');
  });

  it('no-op spinner methods are chainable and silent', () => {
    const spinner = createSpinner('Loading...');
    // All methods should return the spinner for chaining without error
    expect(spinner.start()).toBe(spinner);
    expect(spinner.stop()).toBe(spinner);
    expect(spinner.succeed()).toBe(spinner);
    expect(spinner.fail()).toBe(spinner);
    expect(spinner.warn()).toBe(spinner);
    expect(spinner.info()).toBe(spinner);
  });

  it('text setter does not throw', () => {
    const spinner = createSpinner('Initial text');
    expect(() => { spinner.text = 'Updated text'; }).not.toThrow();
  });
});
