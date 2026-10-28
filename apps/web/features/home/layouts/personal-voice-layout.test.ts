import type { HomeVocalRangeRow } from '@vozzify/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ptBR from '../../../messages/pt-BR.json';
import { VocalRangeLayout } from './vocal-range-layout';

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

const row: HomeVocalRangeRow = {
  id: 'within-your-voice',
  layout: 'vocal-range',
  title: { key: 'home.rows.withinYourVoice', params: {} },
  items: [
    {
      id: 'fits',
      title: 'Fits song',
      coverUrl: null,
      artistCredit: [{ name: 'Singer', joinPhrase: '' }],
      durationMs: 180_000,
      vocalRange: { lowest: 60, highest: 68 },
      fitsVoice: true,
    },
    {
      id: 'transpose',
      title: 'Transpose song',
      coverUrl: null,
      artistCredit: [{ name: 'Singer', joinPhrase: '' }],
      durationMs: 180_000,
      vocalRange: { lowest: 59, highest: 69 },
      fitsVoice: false,
    },
  ],
};

const render = (
  locale: 'en' | 'pt-BR',
  messages: typeof en | typeof ptBR,
): string =>
  renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages,
      timeZone: 'UTC',
      // biome-ignore lint/correctness/noChildrenProp: this test builds elements without JSX.
      children: createElement(VocalRangeLayout, {
        row,
        priority: false,
      }),
    }),
  );

describe('personal vocal-range card cues', () => {
  it('shows the fit and transpose cues in English', () => {
    const markup = render('en', en);

    expect(markup).toContain('>Fits your voice</span>');
    expect(markup).toContain('>Try transposing</span>');
  });

  it('shows the fit and transpose cues in Brazilian Portuguese', () => {
    const markup = render('pt-BR', ptBR);

    expect(markup).toContain('>Combina com sua voz</span>');
    expect(markup).toContain('>Transponha um pouco</span>');
  });
});
