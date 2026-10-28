import type { HomeVocalRangeRow } from '@vozzify/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
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
  id: 'by-voice-easy-start',
  layout: 'vocal-range',
  title: { key: 'home.rows.easyToStart', params: {} },
  items: [
    {
      id: 'track-1',
      title: 'Easy song',
      coverUrl: null,
      artistCredit: [{ name: 'Queen', joinPhrase: '' }],
      durationMs: null,
      vocalRange: { lowest: 50, highest: 69 },
    },
  ],
};

function renderVocalRangeRow(current: HomeVocalRangeRow): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages,
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: createElement(VocalRangeLayout, {
        row: current,
        priority: false,
      }),
    }),
  );
}

describe('VocalRangeLayout', () => {
  it('renders the translated row title', () => {
    const markup = renderVocalRangeRow(row);

    expect(markup).toContain('<h2');
    expect(markup).toContain('>Easy to start</h2>');
  });

  it('links each card to its Track page', () => {
    const markup = renderVocalRangeRow(row);

    expect(markup).toContain('href="/en/tracks/track-1"');
  });

  it('names the Track range as text next to the bar', () => {
    const markup = renderVocalRangeRow(row);

    expect(markup).toContain('>D3–A4</span>');
  });

  it('draws the range bar at the range position', () => {
    const markup = renderVocalRangeRow(row);

    expect(markup).toContain('margin-left:33.33333333333333%');
    expect(markup).toContain('width:21.839080459770116%');
  });

  it('hides the bar from assistive tech, since the chip names the range', () => {
    const markup = renderVocalRangeRow(row);

    expect(markup).toContain('aria-hidden="true"');
  });

  it('shows the sponsored line when the row is sponsored', () => {
    const markup = renderVocalRangeRow({ ...row, sponsored: true });

    expect(markup).toContain('>this row contains sponsored content</span>');
  });

  it('shows no notice when the row is not sponsored', () => {
    const markup = renderVocalRangeRow(row);

    expect(markup).not.toContain('sponsored content</span>');
  });

  it('renders nothing for a title key the web does not know', () => {
    const markup = renderVocalRangeRow({
      ...row,
      title: { key: 'home.rows.notYetShipped', params: {} },
    });

    expect(markup).toBe('');
  });
});
