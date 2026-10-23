// @vitest-environment happy-dom
import type { HomeRankedRow } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../../messages/en.json';
import { clickTargetOf } from '../events/home-click';
import type { HomeRowMeta } from '../events/tracked-rows';
import { RankedLayout } from './ranked-layout';

vi.mock('@/lib/i18n/navigation', async () => {
  const { createElement: create } = await import('react');
  const localize = (path: string) =>
    new URL(path, 'https://notefinder.test').pathname;
  return {
    Link: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: ReactNode;
    }) => create('a', { ...props, href: `/en${localize(href)}` }, children),
  };
});

const row: HomeRankedRow = {
  id: 'top-10-week',
  layout: 'ranked',
  title: { key: 'home.rows.top10Week', params: {} },
  items: [
    {
      id: 'track-1',
      title: 'First song',
      coverUrl: null,
      artistCredit: [{ name: 'Queen', joinPhrase: '' }],
      durationMs: 354000,
      vocalRange: null,
    },
  ],
};

describe('RankedLayout home click attribution', () => {
  it('renders ranked Track anchors with item ids and zero-based positions', () => {
    const markup = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: 'en',
        messages,
        // biome-ignore lint/correctness/noChildrenProp: this provider is composed without JSX.
        children: createElement(RankedLayout, { row, priority: false }),
      }),
    );
    document.body.innerHTML = `<div data-home-row-id="top-10-week">${markup}</div>`;
    const link = document.querySelector('a[href]');
    const meta = new Map<string, HomeRowMeta>([
      ['top-10-week', { feedVersion: 'feed-1', algorithmVersion: 1 }],
    ]);

    expect(link?.getAttribute('href')).toBe('/en/tracks/track-1');
    expect(clickTargetOf(link, meta)).toEqual({
      feedVersion: 'feed-1',
      algorithmVersion: 1,
      rowId: 'top-10-week',
      itemId: 'track-1',
      position: 0,
    });
  });
});
