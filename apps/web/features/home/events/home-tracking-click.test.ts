// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHomeTracking } from './home-tracking';
import { HomeImpressionQueue } from './impression-queue';

vi.mock('@/lib/env/client', () => ({
  getClientEnv: () => ({ NEXT_PUBLIC_API_URL: 'https://api.test' }),
}));

class TestIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('home card navigation targets', () => {
  const visitorStorage = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    };
  };

  const storage = visitorStorage();

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    storage.clear();
  });

  it('updates normal, modified and middle-click link destinations', () => {
    let nextId = 0;
    vi.stubGlobal('crypto', {
      randomUUID: () => `click-${++nextId}`,
    });
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
    vi.stubGlobal('navigator', { sendBeacon: () => true });
    vi.stubGlobal('window', {
      localStorage: storage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      innerWidth: 1024,
      innerHeight: 768,
    });
    storage.setItem('notefinder:visitor-id', 'visitor-1');
    document.body.innerHTML =
      '<section data-home-row-id="row-0">' +
      '<a href="/en/tracks/song" data-home-item-id="song" ' +
      'data-home-item-position="0">song</a></section>';
    const link = document.querySelector('a') as HTMLAnchorElement;
    const stop = startHomeTracking(
      [
        {
          version: 'feed-1',
          algorithmVersion: 1,
          rows: [{ id: 'row-0', items: [{ id: 'song' }] }],
        },
      ],
      new HomeImpressionQueue(),
      new Set(),
    );

    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(link.href).toContain('clickId=click-1');

    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, ctrlKey: true }),
    );
    expect(link.href).toContain('clickId=click-2');

    link.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 1 }),
    );
    expect(link.href).toContain('clickId=click-3');
    stop();
  });
});
