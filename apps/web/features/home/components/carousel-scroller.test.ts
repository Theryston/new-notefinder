// @vitest-environment happy-dom

import { NextIntlClientProvider } from 'next-intl';
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../messages/en.json';
import { CarouselScroller } from './carousel-scroller';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let hoverMatches = true;
let reduceMatches = false;

beforeEach(() => {
  hoverMatches = true;
  reduceMatches = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('hover') ? hoverMatches : reduceMatches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

function Providers({ children }: { children: ReactNode }) {
  return createElement(NextIntlClientProvider, {
    locale: 'en',
    messages,
    children,
  });
}

const header = createElement('h2', null, 'Row title');
const items = [0, 1, 2].map((index) =>
  createElement('li', { key: index }, `Item ${index}`),
);

async function renderScroller() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        Providers,
        null,
        createElement(CarouselScroller, {
          header,
          // biome-ignore lint/correctness/noChildrenProp: this file builds elements without JSX, so the scroller's children can only be a prop here
          children: items,
        }),
      ),
    );
  });
  const track = container.querySelector('ul') as HTMLUListElement | null;
  if (!track) throw new Error('The track did not render');
  Object.defineProperties(track, {
    scrollWidth: { value: 1200, configurable: true },
    clientWidth: { value: 400, configurable: true },
  });
  const scrollBy = vi.fn();
  track.scrollBy = scrollBy as typeof track.scrollBy;
  const buttons = () =>
    [...container.querySelectorAll('button')].map((button) => ({
      label: button.getAttribute('aria-label') ?? '',
      disabled: button.hasAttribute('disabled'),
    }));
  const scrollTo = async (left: number) => {
    track.scrollLeft = left;
    await act(async () => {
      track.dispatchEvent(new Event('scroll'));
    });
  };
  const click = async (index: number) => {
    const button = [...container.querySelectorAll('button')][index];
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  };
  return {
    container,
    track,
    scrollBy,
    buttons,
    scrollTo,
    click,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('CarouselScroller', () => {
  it('disables the left arrow at the start and pages right on click', async () => {
    const harness = await renderScroller();
    try {
      await harness.scrollTo(0);

      expect(harness.buttons()).toEqual([
        { label: 'Scroll row left', disabled: true },
        { label: 'Scroll row right', disabled: false },
      ]);

      await harness.click(1);
      expect(harness.scrollBy).toHaveBeenCalledWith({
        left: 400,
        behavior: 'smooth',
      });
    } finally {
      await harness.unmount();
    }
  });

  it('enables both arrows in the middle and pages left on click', async () => {
    const harness = await renderScroller();
    try {
      await harness.scrollTo(500);

      expect(harness.buttons()).toEqual([
        { label: 'Scroll row left', disabled: false },
        { label: 'Scroll row right', disabled: false },
      ]);

      await harness.click(0);
      expect(harness.scrollBy).toHaveBeenCalledWith({
        left: -400,
        behavior: 'smooth',
      });
    } finally {
      await harness.unmount();
    }
  });

  it('disables the right arrow once the end is reached', async () => {
    const harness = await renderScroller();
    try {
      await harness.scrollTo(800);

      expect(harness.buttons()).toEqual([
        { label: 'Scroll row left', disabled: false },
        { label: 'Scroll row right', disabled: true },
      ]);
    } finally {
      await harness.unmount();
    }
  });

  it('shows no arrows when every item fits', async () => {
    const harness = await renderScroller();
    try {
      Object.defineProperty(harness.track, 'scrollWidth', { value: 300 });
      await harness.scrollTo(0);

      expect(harness.buttons()).toEqual([]);
    } finally {
      await harness.unmount();
    }
  });

  it('shows no arrows on coarse pointers', async () => {
    hoverMatches = false;
    const harness = await renderScroller();
    try {
      await harness.scrollTo(500);

      expect(harness.buttons()).toEqual([]);
    } finally {
      await harness.unmount();
    }
  });

  it('scrolls instantly with reduced motion', async () => {
    reduceMatches = true;
    const harness = await renderScroller();
    try {
      await harness.scrollTo(0);

      await harness.click(1);
      expect(harness.scrollBy).toHaveBeenCalledWith({
        left: 400,
        behavior: 'auto',
      });
    } finally {
      await harness.unmount();
    }
  });
});
