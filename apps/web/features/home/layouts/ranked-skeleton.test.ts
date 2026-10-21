import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
import { RankedRowSkeleton } from '../components/home-feed-skeleton';
import {
  RANKED_HEADER_CLASS,
  RANKED_ITEM_CLASS,
  RANKED_LIST_CLASS,
  RANKED_RANK_CLASS,
} from '../layout-dimensions';
import { RankedLayout } from './ranked-layout';

// The locale-aware Link needs the Next router, which this markup-only test
// doesn't run. A plain anchor under the same locale prefix renders the same
// href, and the real Link is covered by the Playwright home suite.
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

function renderSkeleton(): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages,
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: createElement(RankedRowSkeleton),
    }),
  );
}

const item = (id: string) => ({
  id,
  title: `Song ${id}`,
  coverUrl: null,
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: 354000,
  vocalRange: { lowest: 40, highest: 69 },
});

function renderRanked(): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages,
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: createElement(RankedLayout, {
        row: {
          id: 'top-10-week',
          layout: 'ranked',
          title: { key: 'home.rows.top10Week', params: {} },
          items: [item('a'), item('b')],
        },
        priority: false,
      }),
    }),
  );
}

describe('RankedRowSkeleton', () => {
  it('reserves the ranked layout’s own blocks, so the rows land without a shift', () => {
    const skeleton = renderSkeleton();
    const layout = renderRanked();

    for (const shared of [
      RANKED_HEADER_CLASS,
      RANKED_LIST_CLASS,
      RANKED_ITEM_CLASS,
      RANKED_RANK_CLASS,
    ]) {
      expect(skeleton).toContain(shared);
      expect(layout).toContain(shared);
    }
  });
});
