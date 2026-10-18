import { encodeSitemapCursor } from './sitemap-cursor.js';
import { listSitemapPage, type SitemapRow } from './sitemap-page.js';

const UPDATED = new Date('2026-10-14T12:00:00.000Z');

const row = (id: string): SitemapRow => ({ id, updatedAt: UPDATED });

describe('listSitemapPage', () => {
  it('asks for one row more than the limit and lists the limit', async () => {
    const fetchAfter = vi
      .fn()
      .mockResolvedValue([row('a'), row('b'), row('c')]);

    const page = await listSitemapPage({ limit: 2 }, fetchAfter);

    expect(fetchAfter).toHaveBeenCalledWith(undefined, 3);
    expect(page.items).toEqual([
      { id: 'a', updatedAt: '2026-10-14T12:00:00.000Z' },
      { id: 'b', updatedAt: '2026-10-14T12:00:00.000Z' },
    ]);
  });

  it('ends the page with a cursor on its last ID when another page follows', async () => {
    const page = await listSitemapPage({ limit: 2 }, async () => [
      row('a'),
      row('b'),
      row('c'),
    ]);

    expect(page.nextCursor).toBe(encodeSitemapCursor('b'));
  });

  it('has no cursor on the last page', async () => {
    const page = await listSitemapPage({ limit: 2 }, async () => [
      row('a'),
      row('b'),
    ]);

    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('answers an empty last page with no items and no cursor', async () => {
    const page = await listSitemapPage({ limit: 2 }, async () => []);

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('resumes after the ID its cursor holds', async () => {
    const fetchAfter = vi.fn().mockResolvedValue([]);

    await listSitemapPage(
      { limit: 2, cursor: encodeSitemapCursor('b') },
      fetchAfter,
    );

    expect(fetchAfter).toHaveBeenCalledWith('b', 3);
  });

  it('refuses a cursor it did not issue without reading the table', async () => {
    const fetchAfter = vi.fn();

    await expect(
      listSitemapPage({ limit: 2, cursor: 'b' }, fetchAfter),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(fetchAfter).not.toHaveBeenCalled();
  });
});
