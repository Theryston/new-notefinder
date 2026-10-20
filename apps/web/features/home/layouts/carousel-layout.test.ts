import type { HomeCarouselRow } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
import { CarouselLayout } from './carousel-layout';

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

const track = {
  id: 'track-1',
  title: 'Bohemian Rhapsody',
  coverUrl: null,
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: null,
  vocalRange: null,
};

function renderCarousel(row: HomeCarouselRow): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages,
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: createElement(CarouselLayout, { row, priority: false }),
    }),
  );
}

describe('CarouselLayout titles', () => {
  it('renders a pinned row with the title it carries as a parameter', () => {
    const markup = renderCarousel({
      id: 'pinned-1',
      layout: 'standard',
      title: { key: 'home.rows.pinned', params: { title: 'Summer hits' } },
      items: [track],
    });

    expect(markup).toContain('<h2');
    expect(markup).toContain('>Summer hits</h2>');
  });
});
