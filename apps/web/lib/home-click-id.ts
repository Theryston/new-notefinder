/** Adds the click id to a card's existing Track link without losing its query. */
export function withClickId(href: string, clickId: string): string {
  const url = new URL(href, 'https://vozzify.invalid');
  url.searchParams.set('clickId', clickId);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Reads the click id and returns the same URL with that tracking value removed. */
export function consumeClickId(href: string): {
  clickId: string | undefined;
  cleanHref: string;
} {
  const url = new URL(href, 'https://vozzify.invalid');
  const clickId = url.searchParams.get('clickId') ?? undefined;
  url.searchParams.delete('clickId');
  return {
    clickId,
    cleanHref: `${url.pathname}${url.search}${url.hash}`,
  };
}
