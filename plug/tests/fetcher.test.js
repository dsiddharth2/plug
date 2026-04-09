import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('../src/utils/auth.js', () => ({
  getAuthHeaders: async () => ({}),
}));

const { downloadFile } = await import('../src/utils/fetcher.js');

const sampleVault = { name: 'official', owner: 'plugvault', repo: 'plugvault', branch: 'main' };

describe('fetcher utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads file content as text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '# Code Review\nThis is the content.',
    });
    const content = await downloadFile(sampleVault, 'registry/code-review/code-review.md');
    expect(content).toBe('# Code Review\nThis is the content.');
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('throws AUTH_FAILED on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(downloadFile(sampleVault, 'file.md')).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('throws AUTH_FAILED on 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(downloadFile(sampleVault, 'file.md')).rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('throws NOT_FOUND on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(downloadFile(sampleVault, 'file.md')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws NETWORK_ERROR on ENOTFOUND', async () => {
    global.fetch = vi.fn().mockRejectedValue(
      Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    );
    await expect(downloadFile(sampleVault, 'file.md')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('uses correct GitHub raw URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'content',
    });
    await downloadFile(sampleVault, 'registry/file.md');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/plugvault/plugvault/main/registry/file.md',
      expect.any(Object)
    );
  });
});
