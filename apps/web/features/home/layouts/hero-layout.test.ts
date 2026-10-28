import type { HomeHero } from '@vozzify/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
import { HeroLayout } from './hero-layout';

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

const track = (
  artistCredit: {
    name: string;
    joinPhrase: string;
    artistId?: string | null;
  }[],
) => ({
  id: 'track-1',
  title: 'Boat',
  coverUrl: null,
  artistCredit,
  durationMs: 354000,
  vocalRange: { lowest: 40, highest: 69 },
});

const row = (
  artistCredit: {
    name: string;
    joinPhrase: string;
    artistId?: string | null;
  }[],
): HomeHero => ({
  id: 'hero',
  layout: 'hero',
  track: track(artistCredit),
});

function renderHero(input: HomeHero): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages,
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: createElement(HeroLayout, { row: input, priority: true }),
    }),
  );
}

describe('HeroLayout', () => {
  it('links the artist name to its Artist page when known', () => {
    const markup = renderHero(
      row([{ name: 'Ed Sheeran', joinPhrase: '', artistId: 'artist-1' }]),
    );

    expect(markup).toContain('href="/en/artists/artist-1"');
    expect(markup).toContain('>Ed Sheeran</a>');
  });

  it('renders the artist name unlinked when it has no Artist', () => {
    const markup = renderHero(row([{ name: 'Ed Sheeran', joinPhrase: '' }]));

    expect(markup).toContain('Ed Sheeran');
    expect(markup).not.toContain('/artists/');
  });

  it('tilts the cover and rings the block like the album banner', () => {
    const markup = renderHero(row([{ name: 'Ed Sheeran', joinPhrase: '' }]));

    expect(markup).toContain('sm:rotate-3');
    expect(markup).toContain('before:rounded-full');
  });
});
