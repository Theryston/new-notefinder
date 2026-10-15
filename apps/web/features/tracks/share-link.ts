/** The networks the share dialog offers shortcuts for. */
export const SHARE_NETWORKS = [
  'whatsapp',
  'telegram',
  'x',
  'facebook',
  'email',
] as const;

export type ShareNetwork = (typeof SHARE_NETWORKS)[number];

/**
 * The link to share: the Track page without its query string or fragment,
 * plus `?time=` (whole seconds) when a moment past the start is given, which
 * the page reads back to start there. Nothing played yet (0) is the page
 * itself, as the legacy app shared it.
 */
export function shareLink(pageUrl: string, seconds: number | null): string {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = '';
  const whole = seconds === null ? 0 : Math.floor(seconds);
  if (whole > 0) url.searchParams.set('time', String(whole));
  return url.toString();
}

/** What a shortcut sends: the localized text, and the email's subject. */
export type ShareMessage = { url: string; text: string; subject: string };

const encode = encodeURIComponent;

/** Where a network's share page (or the mail client) takes the message. */
export function shareHref(
  network: ShareNetwork,
  { url, text, subject }: ShareMessage,
): string {
  switch (network) {
    case 'whatsapp':
      return `https://wa.me/?text=${encode(`${text} ${url}`)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encode(url)}&text=${encode(text)}`;
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encode(text)}&url=${encode(url)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encode(url)}`;
    case 'email':
      return `mailto:?subject=${encode(subject)}&body=${encode(`${text}\n${url}`)}`;
  }
}
