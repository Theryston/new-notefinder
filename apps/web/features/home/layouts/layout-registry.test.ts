import type { HomeRow } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TERMS_ADVERTISING_FRAGMENT } from '../../../lib/terms-fragments';
import messages from '../../../messages/en.json';
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
 * Renders every registered layout, sponsored or not. A layout added to the
 * registry is covered here automatically: it must show the notice (and its
 * link to the advertising terms) whenever its row is sponsored, and nothing
 * when it is not.
 */

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

const layouts = Object.keys(homeLayoutRegistry) as HomeRow['layout'][];

describe('home layout registry', () => {
  it('registers at least one layout', () => {
    expect(layouts.length).toBeGreaterThan(0);
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
    const { placement, render } = homeLayoutRegistry[layout];
    const noticeText =
      placement === 'caption'
        ? messages.home.sponsored.hero
        : messages.home.sponsored.row;

    it(`${layout} shows the sponsored notice as a link to the advertising terms`, () => {
      const markup = renderLayout(render(sponsoredRows[layout], false));

      expect(markup).toContain(noticeText);
      expect(markup).toContain(
        `href="/en/terms#${TERMS_ADVERTISING_FRAGMENT}"`,
      );
    });

    it(`${layout} shows no notice when the row is not sponsored`, () => {
      const markup = renderLayout(render(plainRows[layout], false));

      expect(markup).not.toContain(noticeText);
      expect(markup).not.toContain(`/terms#${TERMS_ADVERTISING_FRAGMENT}`);
    });
  }
});
