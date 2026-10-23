import type { HomeRowTitle } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../messages/en.json';
import ptBr from '../../messages/pt-BR.json';
import { RowCarouselShell } from './layouts/row-carousel-shell';

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

const renderTitle = (
  title: HomeRowTitle,
  locale: 'en' | 'pt-BR',
  messages: typeof en | typeof ptBr,
): string =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages,
      timeZone: 'UTC',
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: createElement(RowCarouselShell, {
        rowId: 'personal-row',
        title,
        sponsored: undefined,
        // biome-ignore lint/correctness/noChildrenProp: the title shell has no track cards in this focused render
        children: null,
      }),
    }),
  );

describe('personal home row titles', () => {
  it.each([
    [
      'home.rows.becauseYouSang',
      { trackTitle: 'Bohemian Rhapsody' },
      'Because you sang Bohemian Rhapsody',
    ],
    ['home.rows.moreOfYourGenres', {}, 'More of your genres'],
    ['home.rows.yourMostSungArtists', {}, 'Your most sung artists'],
    ['home.rows.explore', {}, 'Explore something new'],
  ])('renders the known English title %s', (key, params, expected) => {
    const markup = renderTitle({ key, params }, 'en', en);

    expect(markup).toContain(`<h2`);
    expect(markup).toContain(`>${expected}</h2>`);
  });

  it('renders the source Track parameter in Portuguese', () => {
    const markup = renderTitle(
      {
        key: 'home.rows.becauseYouSang',
        params: { trackTitle: 'Bohemian Rhapsody' },
      },
      'pt-BR',
      ptBr,
    );

    expect(markup).toContain('>Porque você cantou Bohemian Rhapsody</h2>');
  });
});
