import type { HomePeopleRow } from '@vozzify/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../../messages/en.json';
import { PeopleLayout } from './people-layout';

vi.mock('@/lib/i18n/navigation', async () => {
  const { createElement: create } = await import('react');
  return {
    Link: ({ href, children }: { href: string; children?: ReactNode }) =>
      create('a', { href }, children),
  };
});

const avatarUrl = 'https://lh3.googleusercontent.com/avatar/photo.jpg';
const row: HomePeopleRow = {
  id: 'people',
  layout: 'people',
  title: { key: 'home.rows.peopleWhoSingWhatYouSing', params: {} },
  items: [
    {
      id: 'person',
      username: 'person',
      name: 'Person',
      image: avatarUrl,
      commonTracks: 3,
    },
  ],
};

describe('PeopleLayout avatar images', () => {
  it('loads a preserved Google Avatar URL directly without the Next optimizer', () => {
    const markup = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: 'en',
        messages,
        // biome-ignore lint/correctness/noChildrenProp: provider built without JSX
        children: createElement(PeopleLayout, { row, priority: false }),
      }),
    );

    expect(markup).toContain(`src="${avatarUrl}"`);
    expect(markup).not.toContain('/_next/image?');
  });
});
