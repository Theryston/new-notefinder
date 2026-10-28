import type { HomeRankedRow } from '@vozzify/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
import { RankedLayout } from './ranked-layout';

vi.mock('@/lib/i18n/navigation', async () => {
  const { createElement: create } = await import('react');
  return {
    Link: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: ReactNode;
    }) => create('a', { ...props, href: `/en${href}` }, children),
  };
});

const item = (id: string, title: string, vocalRange = true) => ({
  id,
  title,
  coverUrl: null,
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 354000,
  vocalRange: vocalRange ? { lowest: 40, highest: 69 } : null,
});

const row = (overrides: Partial<HomeRankedRow> = {}): HomeRankedRow => ({
  id: 'top-10-week',
  layout: 'ranked',
  title: { key: 'home.rows.top10Week', params: {} },
  items: [item('track-1', 'First song'), item('track-2', 'Second song')],
  ...overrides,
});

function renderRanked(input: HomeRankedRow): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages,
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: createElement(RankedLayout, { row: input, priority: false }),
    }),
  );
}

describe('RankedLayout', () => {
  it('numbers the Tracks in order inside an ordered list', () => {
    const markup = renderRanked(row());

    expect(markup).toContain('<ol');
    const first = markup.indexOf('>1</span>');
    const second = markup.indexOf('>2</span>');
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it('links every row to its Track page', () => {
    const markup = renderRanked(row());

    expect(markup).toContain('href="/en/tracks/track-1"');
    expect(markup).toContain('href="/en/tracks/track-2"');
    expect(markup).toContain('>First song</span>');
  });

  it('shows the vocal range beside the artist', () => {
    const markup = renderRanked(row());

    expect(markup).toContain('E2–A4');
  });

  it('hides a row whose title key the web does not know', () => {
    const markup = renderRanked(
      row({ title: { key: 'home.rows.notYetShipped', params: {} } }),
    );

    expect(markup).toBe('');
  });
});
