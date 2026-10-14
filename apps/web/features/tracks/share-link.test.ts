import { describe, expect, it } from 'vitest';

import { SHARE_NETWORKS, shareHref, shareLink } from './share-link';

const PAGE = 'https://notefinder.com.br/en/tracks/clx1';

describe('shareLink', () => {
  it('is the page itself without a moment', () => {
    expect(shareLink(PAGE, null)).toBe(PAGE);
  });

  it('adds the moment in whole seconds as ?time=', () => {
    expect(shareLink(PAGE, 83.9)).toBe(`${PAGE}?time=83`);
  });

  it('shares the start of the Track as time=0', () => {
    expect(shareLink(PAGE, 0)).toBe(`${PAGE}?time=0`);
  });

  it('never goes before the start', () => {
    expect(shareLink(PAGE, -3)).toBe(`${PAGE}?time=0`);
  });

  it('drops the query string and the fragment of the page it is on', () => {
    expect(
      shareLink(`${PAGE}?time=5&timeline-focus=true&utm=x#lyrics`, 12),
    ).toBe(`${PAGE}?time=12`);
    expect(shareLink(`${PAGE}?time=5#lyrics`, null)).toBe(PAGE);
  });
});

describe('shareHref', () => {
  const message = {
    url: `${PAGE}?time=83`,
    text: 'Sing "Under Pressure" & more',
    subject: 'Under Pressure on NoteFinder',
  };

  it('has a shortcut for every network', () => {
    expect(SHARE_NETWORKS).toEqual([
      'whatsapp',
      'telegram',
      'x',
      'facebook',
      'email',
    ]);
  });

  it.each([
    [
      'whatsapp',
      'https://wa.me/?text=Sing%20%22Under%20Pressure%22%20%26%20more%20https%3A%2F%2Fnotefinder.com.br%2Fen%2Ftracks%2Fclx1%3Ftime%3D83',
    ],
    [
      'telegram',
      'https://t.me/share/url?url=https%3A%2F%2Fnotefinder.com.br%2Fen%2Ftracks%2Fclx1%3Ftime%3D83&text=Sing%20%22Under%20Pressure%22%20%26%20more',
    ],
    [
      'x',
      'https://twitter.com/intent/tweet?text=Sing%20%22Under%20Pressure%22%20%26%20more&url=https%3A%2F%2Fnotefinder.com.br%2Fen%2Ftracks%2Fclx1%3Ftime%3D83',
    ],
    [
      'facebook',
      'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fnotefinder.com.br%2Fen%2Ftracks%2Fclx1%3Ftime%3D83',
    ],
    [
      'email',
      'mailto:?subject=Under%20Pressure%20on%20NoteFinder&body=Sing%20%22Under%20Pressure%22%20%26%20more%0Ahttps%3A%2F%2Fnotefinder.com.br%2Fen%2Ftracks%2Fclx1%3Ftime%3D83',
    ],
  ] as const)(
    'writes the %s shortcut with the text and link encoded',
    (network, href) => {
      expect(shareHref(network, message)).toBe(href);
    },
  );
});
