import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../src/utils/frontmatter.js';

describe('parseFrontmatter', () => {
  it('parses a standard frontmatter block', () => {
    const content = '---\nname: my-skill\nversion: 1.0\n---\n\nBody here.';
    expect(parseFrontmatter(content)).toEqual({ name: 'my-skill', version: '1.0' });
  });

  it('returns {} when there is no frontmatter', () => {
    const content = 'Just some plain content with no frontmatter.';
    expect(parseFrontmatter(content)).toEqual({});
  });

  it('returns {} when frontmatter has no closing ---', () => {
    const content = '---\nname: my-skill\nversion: 1.0\n';
    expect(parseFrontmatter(content)).toEqual({});
  });

  it('handles CRLF line endings', () => {
    const content = '---\r\nname: my-skill\r\nhook: settings\r\n---\r\n\r\nBody.';
    expect(parseFrontmatter(content)).toEqual({ name: 'my-skill', hook: 'settings' });
  });

  it('parses the hook field correctly', () => {
    const content = '---\nname: hook-skill\nhook: pre-tool-use\n---\n';
    const fm = parseFrontmatter(content);
    expect(fm.hook).toBe('pre-tool-use');
  });
});
