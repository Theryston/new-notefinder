import { describe, expect, it } from 'vitest';

import { userSitemapXml } from './user-sitemap-xml';

const origin = 'https://vozzify.com';
const updatedAt = '2026-10-14T12:00:00.000Z';

const locs = (xml: string): string[] =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');

describe('userSitemapXml', () => {
  it('lists each Profile in each locale by its unchanged Username, in the order given', () => {
    const xml = userSitemapXml(
      [
        { id: 'user-2', username: 'grace', updatedAt },
        { id: 'user-1', username: 'ada_l', updatedAt },
      ],
      origin,
    );

    expect(locs(xml)).toEqual([
      `${origin}/en/users/grace`,
      `${origin}/pt-BR/users/grace`,
      `${origin}/en/users/ada_l`,
      `${origin}/pt-BR/users/ada_l`,
    ]);
    expect(xml).toContain(`<lastmod>${updatedAt}</lastmod>`);
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="pt-BR" href="${origin}/pt-BR/users/grace"/>`,
    );
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/users/grace"/>`,
    );
  });

  it('gives each Profile its changefreq and priority', () => {
    const xml = userSitemapXml(
      [{ id: 'user-1', username: 'grace', updatedAt }],
      origin,
    );

    expect(xml).toContain(
      '<changefreq>weekly</changefreq><priority>0.6</priority>',
    );
  });

  it('is a valid empty sitemap with no Profiles', () => {
    expect(userSitemapXml([], origin)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"></urlset>',
    );
  });

  it('encodes the Username as one path segment, so no character can change the path', () => {
    const xml = userSitemapXml(
      [{ id: 'user-1', username: 'a?b#c', updatedAt }],
      origin,
    );

    expect(locs(xml)).toContain(`${origin}/en/users/a%3Fb%23c`);
    expect(xml).not.toContain('a?b');
  });
});
