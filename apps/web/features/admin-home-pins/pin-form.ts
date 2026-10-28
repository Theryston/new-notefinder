import type {
  CreateEditorialPinBody,
  EditorialPin,
  EditorialPinAudience,
  EditorialPinKind,
  EditorialPinLayout,
  Locale,
} from '@vozzify/contracts';

/**
 * The pin facts the form needs at runtime. Built by the server page from the
 * contracts (never redeclared here), so the layout catalog and the limits
 * stay single-sourced while Zod stays out of the client's first-load JavaScript.
 */
export type PinFormCatalog = {
  layouts: readonly EditorialPinLayout[];
  audiences: readonly EditorialPinAudience[];
  locales: readonly Locale[];
  /** The hero slot: a hero pin always takes it. */
  heroPosition: number;
  maxTracks: number;
  maxPosition: number;
  maxPriority: number;
  maxTitleLength: number;
};

/** The form's own shape: strings for the inputs, mapped to a body on submit. */
export type PinFormValues = {
  kind: EditorialPinKind;
  layout: EditorialPinLayout;
  /** One Track ID per line, in the row's order. */
  trackIdsText: string;
  position: number;
  priority: number;
  audience: EditorialPinAudience;
  /** `''` pins the hero or row in every locale. */
  locale: '' | Locale;
  /** `datetime-local` values, `''` when open-ended. */
  startsAt: string;
  endsAt: string;
  titleEn: string;
  titlePt: string;
  sponsored: boolean;
};

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * An ISO instant as a `datetime-local` value in the visitor's time zone, so
 * the schedule reads in local time. Trims seconds: the input has none.
 */
export function toInputDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A `datetime-local` value back to an ISO instant, or `null` when empty. */
export function fromInputDateTime(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

/** The textarea into Track IDs: split on lines or commas, trimmed, in order. */
export function parseTrackIds(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/** The locales a title is required in: the pin's own, or every locale. */
export function servedLocales(
  locales: readonly Locale[],
  locale: '' | Locale,
): readonly Locale[] {
  return locale ? [locale] : locales;
}

export function emptyPinForm(): PinFormValues {
  return {
    kind: 'row',
    layout: 'standard',
    trackIdsText: '',
    position: 1,
    priority: 0,
    audience: 'everyone',
    locale: '',
    startsAt: '',
    endsAt: '',
    titleEn: '',
    titlePt: '',
    sponsored: false,
  };
}

/** An existing pin as form values, for the edit dialog. */
export function pinToFormValues(pin: EditorialPin): PinFormValues {
  return {
    kind: pin.kind,
    layout: pin.layout,
    trackIdsText:
      pin.source.type === 'tracks' ? pin.source.trackIds.join('\n') : '',
    position: pin.position,
    priority: pin.priority,
    audience: pin.audience,
    locale: pin.locale ?? '',
    startsAt: pin.startsAt ? toInputDateTime(pin.startsAt) : '',
    endsAt: pin.endsAt ? toInputDateTime(pin.endsAt) : '',
    titleEn: pin.titles.en ?? '',
    titlePt: pin.titles['pt-BR'] ?? '',
    sponsored: pin.sponsored,
  };
}

/** Form values as the body the admin endpoint validates. */
export function formValuesToBody(
  values: PinFormValues,
): CreateEditorialPinBody {
  const titles: CreateEditorialPinBody['titles'] = {};
  if (values.titleEn.trim()) titles.en = values.titleEn.trim();
  if (values.titlePt.trim()) titles['pt-BR'] = values.titlePt.trim();
  return {
    kind: values.kind,
    layout: values.layout,
    source: { type: 'tracks', trackIds: parseTrackIds(values.trackIdsText) },
    position: values.position,
    priority: values.priority,
    audience: values.audience,
    locale: values.locale === '' ? null : values.locale,
    startsAt: fromInputDateTime(values.startsAt),
    endsAt: fromInputDateTime(values.endsAt),
    titles,
    sponsored: values.sponsored,
  };
}

/** Every field the form can blame, for translated validation messages. */
export type PinFormField =
  | 'kind'
  | 'layout'
  | 'trackIdsText'
  | 'position'
  | 'priority'
  | 'audience'
  | 'locale'
  | 'startsAt'
  | 'endsAt'
  | 'titleEn'
  | 'titlePt'
  | 'sponsored';

/**
 * A contracts issue path to the form field that shows it. Cross-field rules
 * land on the body (`titles.en`, `source.trackIds`); the form keeps one
 * field per locale and a single Track list.
 */
export function pinFormFieldForPath(
  path: readonly (string | number)[],
): PinFormField | null {
  const [first, second] = path;
  if (first === 'titles' && (second === 'en' || second === 'pt-BR')) {
    return second === 'en' ? 'titleEn' : 'titlePt';
  }
  if (first === 'source') return 'trackIdsText';
  if (
    first === 'kind' ||
    first === 'layout' ||
    first === 'position' ||
    first === 'priority' ||
    first === 'audience' ||
    first === 'locale' ||
    first === 'startsAt' ||
    first === 'endsAt' ||
    first === 'sponsored'
  ) {
    return first;
  }
  return null;
}

/** Every validation message the pin form can show, under `form.errors`. */
type PinFormErrorLeaf =
  | 'invalid'
  | 'required'
  | 'tooLong'
  | 'tooMany'
  | 'duplicateTracks'
  | 'outOfRange'
  | 'kindLayoutMismatch'
  | 'heroPositionFixed'
  | 'endsBeforeStart';

export type PinFormErrorKey = `errors.${PinFormErrorLeaf}`;

/** Message key for a Zod issue code, falling back to `errors.invalid`. */
const ERROR_KEY_BY_CODE: Partial<Record<string, PinFormErrorKey>> = {
  too_small: 'errors.outOfRange',
  too_big: 'errors.outOfRange',
};

const TRACK_IDS_ERROR_KEY_BY_CODE: Partial<Record<string, PinFormErrorKey>> = {
  too_small: 'errors.required',
  too_big: 'errors.tooMany',
  custom: 'errors.duplicateTracks',
};

const TITLE_ERROR_KEY_BY_CODE: Partial<Record<string, PinFormErrorKey>> = {
  too_small: 'errors.required',
  custom: 'errors.required',
  too_big: 'errors.tooLong',
};

/**
 * Message key (under `adminHomePins.form`) for a validation failure of
 * `field`: the Zod issue code picks the specific message, every field falls
 * back to `errors.invalid`, so the form never shows a schema sentence.
 */
export function pinFormErrorKey(
  field: PinFormField,
  type: string | undefined,
): PinFormErrorKey {
  if (type === undefined) return 'errors.invalid';
  switch (field) {
    case 'layout':
      return type === 'custom' ? 'errors.kindLayoutMismatch' : 'errors.invalid';
    case 'trackIdsText':
      return TRACK_IDS_ERROR_KEY_BY_CODE[type] ?? 'errors.invalid';
    case 'titleEn':
    case 'titlePt':
      return TITLE_ERROR_KEY_BY_CODE[type] ?? 'errors.invalid';
    case 'position':
      if (type === 'custom') return 'errors.heroPositionFixed';
      return ERROR_KEY_BY_CODE[type] ?? 'errors.invalid';
    case 'priority':
      return ERROR_KEY_BY_CODE[type] ?? 'errors.invalid';
    case 'endsAt':
      return type === 'custom' ? 'errors.endsBeforeStart' : 'errors.invalid';
    default:
      return 'errors.invalid';
  }
}
