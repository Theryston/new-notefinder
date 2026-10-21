import type { HomeRow } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TERMS_ADVERTISING_FRAGMENT } from '../../../lib/terms-fragments';
import messages from '../../../messages/en.json';
import type { SponsoredPlacement } from '../components/sponsored-notice';
import { homeLayoutRegistry, isRegisteredLayout } from './layout-registry';

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

/**
 * Renders every registered layout, sponsored or not. The placement each layout
 * must use is written out here, so a registry entry that moves its notice
 * fails. A layout added to the registry must be listed below as well.
 */

const expectedPlacement: Record<HomeRow['layout'], SponsoredPlacement> = {
  hero: 'caption',
  standard: 'line',
};

// The text each placement shows, from the locale file (hero caption vs row line).
const noticeTextOf: Record<SponsoredPlacement, string> = {
  caption: messages.home.sponsored.hero,
  line: messages.home.sponsored.row,
};

const track = {
  id: 'track-queen-1',
  title: 'Bohemian Rhapsody',
  coverUrl: null,
  artistCredit: [{ name: 'Queen', joinPhrase: '' }],
  durationMs: null,
  vocalRange: null,
};

const plainRows = {
  hero: { id: 'hero', layout: 'hero', track },
  standard: {
    id: 'trending-today',
    layout: 'standard',
    title: { key: 'home.rows.trendingToday', params: {} },
    items: [track],
  },
} satisfies Record<HomeRow['layout'], HomeRow>;

const sponsoredRows = {
  hero: { ...plainRows.hero, sponsored: true },
  standard: { ...plainRows.standard, sponsored: true },
} satisfies Record<HomeRow['layout'], HomeRow>;

function renderLayout(node: ReactNode): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages,
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: node,
    }),
  );
}

const layouts = Object.keys(expectedPlacement) as HomeRow['layout'][];

describe('home layout registry', () => {
  it('registers exactly the layouts this test lists', () => {
    expect(Object.keys(homeLayoutRegistry).sort()).toEqual([...layouts].sort());
  });

  it('recognizes the layouts it renders and skips any other', () => {
    expect(isRegisteredLayout('hero')).toBe(true);
    expect(isRegisteredLayout('standard')).toBe(true);
    expect(isRegisteredLayout('ranked-top-10')).toBe(false);
  });

  it('renders nothing for a row whose title key the web does not know', () => {
    const markup = renderLayout(
      homeLayoutRegistry.standard.render(
        {
          ...plainRows.standard,
          title: { key: 'home.rows.notYetShipped', params: {} },
        },
        false,
      ),
    );

    expect(markup).toBe('');
  });

  for (const layout of layouts) {
    const placement = expectedPlacement[layout];
    const noticeText = noticeTextOf[placement];

    it(`${layout} places its notice as a ${placement}`, () => {
      expect(homeLayoutRegistry[layout].placement).toBe(placement);
    });

    it(`${layout} shows the sponsored notice as an exact link to the advertising terms`, () => {
      const markup = renderLayout(
        homeLayoutRegistry[layout].render(sponsoredRows[layout], false),
      );

      expect(markup).toContain(`>${noticeText}</span>`);
      expect(markup).toContain(
        `href="/en/terms#${TERMS_ADVERTISING_FRAGMENT}"`,
      );
    });

    it(`${layout} draws the ${placement} notice with its own style`, () => {
      const markup = renderLayout(
        homeLayoutRegistry[layout].render(sponsoredRows[layout], false),
      );

      // The caption is the only placement on the orange backing.
      expect(markup.includes('bg-hero-scrim')).toBe(placement === 'caption');
    });

    it(`${layout} shows no notice when the row is not sponsored`, () => {
      const markup = renderLayout(
        homeLayoutRegistry[layout].render(plainRows[layout], false),
      );

      expect(markup).not.toContain(`>${noticeText}</span>`);
      expect(markup).not.toContain(`/terms#${TERMS_ADVERTISING_FRAGMENT}`);
    });
  }
});
