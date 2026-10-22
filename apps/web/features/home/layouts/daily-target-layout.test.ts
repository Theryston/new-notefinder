import type { HomeDailyTargetRow } from '@notefinder/contracts';
import { NextIntlClientProvider } from 'next-intl';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
import { DailyTargetLayout } from './daily-target-layout';

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

const row = (streakDays: number): HomeDailyTargetRow => ({
  id: 'daily-target',
  layout: 'daily-target',
  title: { key: 'home.rows.dailyTarget', params: {} },
  secondsLeft: 720,
  targetSeconds: 900,
  streakDays,
  completedToday: false,
});

function renderDailyTarget(input: HomeDailyTargetRow): string {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: 'en',
      messages,
      // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the provider's children can only be a prop here
      children: createElement(DailyTargetLayout, {
        row: input,
        priority: false,
      }),
    }),
  );
}

describe('DailyTargetLayout', () => {
  it('shows just the streak count with the full wording for assistive tech', () => {
    const markup = renderDailyTarget(row(0));

    expect(markup).toContain('>0</span>');
    expect(markup).toContain('sr-only">No streak yet</span>');
  });

  it('keeps the count for a running streak', () => {
    const markup = renderDailyTarget(row(5));

    expect(markup).toContain('>5</span>');
    expect(markup).toContain('5 day streak');
  });
});
