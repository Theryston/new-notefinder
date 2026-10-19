/** The networks the share dialogs offer shortcuts for. */
export const SHARE_NETWORKS = [
  'whatsapp',
  'telegram',
  'x',
  'facebook',
  'email',
] as const;

export type ShareNetwork = (typeof SHARE_NETWORKS)[number];

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
