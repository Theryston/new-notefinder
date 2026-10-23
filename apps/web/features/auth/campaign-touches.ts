import type { CampaignTouch } from '@notefinder/contracts';

export const CAMPAIGN_TOUCHES_KEY = 'notefinder:campaign-touches';

const PARAMETER_FIELDS = [
  ['utm_source', 'utmSource'],
  ['utm_medium', 'utmMedium'],
  ['utm_campaign', 'utmCampaign'],
  ['utm_term', 'utmTerm'],
  ['utm_content', 'utmContent'],
  ['gclid', 'gclid'],
  ['fbclid', 'fbclid'],
  ['ttclid', 'ttclid'],
  ['msclkid', 'msclkid'],
] as const;

const TOUCH_FIELDS = [
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmTerm',
  'utmContent',
  'gclid',
  'fbclid',
  'ttclid',
  'msclkid',
  'referrer',
  'landingPath',
] as const;

export type CampaignTouches = {
  firstTouch: CampaignTouch | null;
  lastTouch: CampaignTouch | null;
};

type TouchStorage = Pick<Storage, 'getItem' | 'setItem'> &
  Partial<Pick<Storage, 'removeItem'>>;

const MAX_LENGTH: Record<(typeof TOUCH_FIELDS)[number], number> = {
  utmSource: 500,
  utmMedium: 500,
  utmCampaign: 500,
  utmTerm: 500,
  utmContent: 500,
  gclid: 500,
  fbclid: 500,
  ttclid: 500,
  msclkid: 500,
  referrer: 2048,
  landingPath: 2048,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function cleanTouch(value: unknown): CampaignTouch | null {
  if (!isRecord(value)) return null;
  const touch: Record<string, string> = {};
  for (const field of TOUCH_FIELDS) {
    const fieldValue = value[field];
    if (
      typeof fieldValue === 'string' &&
      fieldValue.length <= MAX_LENGTH[field]
    ) {
      touch[field] = fieldValue;
    }
  }
  return Object.keys(touch).length > 0 ? (touch as CampaignTouch) : null;
}

export function readCampaignTouches(storage: TouchStorage): CampaignTouches {
  try {
    const raw = storage.getItem(CAMPAIGN_TOUCHES_KEY);
    if (!raw) return { firstTouch: null, lastTouch: null };
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return { firstTouch: null, lastTouch: null };
    return {
      firstTouch: cleanTouch(value.firstTouch),
      lastTouch: cleanTouch(value.lastTouch),
    };
  } catch {
    return { firstTouch: null, lastTouch: null };
  }
}

/** Stores only campaign arrivals, preserving the first and replacing the last. */
export function captureCampaignTouch(
  storage: TouchStorage,
  href: string,
  referrer: string,
): CampaignTouches {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return readCampaignTouches(storage);
  }

  const touch: Record<string, string> = {};
  for (const [parameter, field] of PARAMETER_FIELDS) {
    const value = url.searchParams.get(parameter);
    if (value) touch[field] = value.slice(0, 500);
  }
  if (Object.keys(touch).length === 0) return readCampaignTouches(storage);
  if (referrer) touch.referrer = referrer.slice(0, 2048);
  touch.landingPath = url.pathname.slice(0, 2048);

  const current = readCampaignTouches(storage);
  const next: CampaignTouches = {
    firstTouch: current.firstTouch ?? (touch as CampaignTouch),
    lastTouch: touch as CampaignTouch,
  };
  try {
    storage.setItem(CAMPAIGN_TOUCHES_KEY, JSON.stringify(next));
  } catch {
    return current;
  }
  return next;
}

export function clearCampaignTouches(storage: TouchStorage): void {
  try {
    if (storage.removeItem) storage.removeItem(CAMPAIGN_TOUCHES_KEY);
    else storage.setItem(CAMPAIGN_TOUCHES_KEY, '');
  } catch {
    // A storage failure must not break auth navigation.
  }
}
