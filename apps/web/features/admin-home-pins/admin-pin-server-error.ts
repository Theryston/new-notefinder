import type { PinTrackIssueReason } from '@notefinder/contracts';

import { isApiError } from '@/lib/api/api-error';

import {
  type PinFormField,
  pinFormErrorKey,
  pinFormFieldForPath,
} from './pin-form';

export type ServerFieldError = {
  field: PinFormField;
  /** The Zod issue code, as the form's resolver stores it in `type`. */
  type: string;
};

type ServerIssue = {
  code?: unknown;
  path?: unknown;
  trackId?: unknown;
  reason?: unknown;
};

function isServerIssue(issue: unknown): issue is ServerIssue {
  return typeof issue === 'object' && issue !== null;
}

function issuePathOf(raw: ServerIssue): (string | number)[] {
  return Array.isArray(raw.path)
    ? raw.path.filter(
        (segment): segment is string | number =>
          typeof segment === 'string' || typeof segment === 'number',
      )
    : [];
}

const ELIGIBILITY_REASONS: readonly string[] = [
  'TRACK_NOT_COMPLETED',
  'TRACK_NO_COVER',
  'SOURCE_NOT_FOUND',
  'SOURCE_INSUFFICIENT',
] satisfies readonly PinTrackIssueReason[];

/**
 * Whether the issue is a source-eligibility refusal (a Track or source that
 * cannot appear) rather than a shape violation. Eligibility issues carry a
 * machine-readable `reason`; the duplicate-Tracks check does not.
 */
function isEligibilityIssue(raw: ServerIssue): boolean {
  return (
    typeof raw.reason === 'string' && ELIGIBILITY_REASONS.includes(raw.reason)
  );
}

function validationIssuesOf(error: unknown): ServerIssue[] {
  if (!isApiError(error) || error.code !== 'VALIDATION_FAILED') return [];
  const details = error.details as { issues?: unknown } | undefined;
  return Array.isArray(details?.issues)
    ? details.issues.filter(isServerIssue)
    : [];
}

/**
 * The backend's `VALIDATION_FAILED` details as field errors the pin form
 * shows inline. The API answers `{ details: { issues } }` with Zod issues,
 * so the same path → field and code → message maps the client validation
 * uses apply here; unmapped issues are skipped. Eligibility refusals are
 * skipped: they name Tracks, not fields, so the toast carries them instead.
 */
export function serverValidationFieldErrors(
  error: unknown,
): ServerFieldError[] {
  const mapped: ServerFieldError[] = [];
  for (const raw of validationIssuesOf(error)) {
    if (isEligibilityIssue(raw)) continue;
    const field = pinFormFieldForPath(issuePathOf(raw));
    if (!field || mapped.some((entry) => entry.field === field)) continue;
    mapped.push({
      field,
      type: typeof raw.code === 'string' ? raw.code : 'custom',
    });
  }
  return mapped;
}

/** One translated eligibility refusal: what cannot be pinned, and which Tracks. */
export type ServerEligibilityError = {
  kind: 'tracks-not-ready' | 'hero-needs-cover' | 'source';
  trackIds: string[];
};

function trackIdOf(raw: ServerIssue): string | undefined {
  return typeof raw.trackId === 'string' && raw.trackId.length > 0
    ? raw.trackId
    : undefined;
}

/**
 * The eligibility refusals of a `VALIDATION_FAILED`, grouped by kind with
 * the refusing Track IDs. The toast translates these instead of showing the
 * backend's English developer message, so the toast is never half-translated.
 */
export function serverEligibilityErrors(
  error: unknown,
): ServerEligibilityError[] {
  const kinds = new Map<ServerEligibilityError['kind'], string[]>();
  const push = (
    kind: ServerEligibilityError['kind'],
    trackId: string | undefined,
  ) => {
    const ids = kinds.get(kind) ?? [];
    if (trackId && !ids.includes(trackId)) ids.push(trackId);
    kinds.set(kind, ids);
  };
  for (const raw of validationIssuesOf(error)) {
    const reason = raw.reason;
    if (reason === 'TRACK_NOT_COMPLETED')
      push('tracks-not-ready', trackIdOf(raw));
    else if (reason === 'TRACK_NO_COVER')
      push('hero-needs-cover', trackIdOf(raw));
    else if (
      reason === 'SOURCE_NOT_FOUND' ||
      reason === 'SOURCE_INSUFFICIENT'
    ) {
      push('source', undefined);
    }
  }
  return [...kinds].map(([kind, trackIds]) => ({ kind, trackIds }));
}

/** The label under `adminHomePins.form` naming `field` in a toast. */
export function pinFormFieldLabelKey(
  field: PinFormField,
):
  | 'trackIds.label'
  | 'titleEn.label'
  | 'titlePt.label'
  | 'kind.label'
  | 'layout.label'
  | 'position.label'
  | 'priority.label'
  | 'audience.label'
  | 'locale.label'
  | 'startsAt.label'
  | 'endsAt.label'
  | 'sponsored.label' {
  switch (field) {
    case 'trackIdsText':
      return 'trackIds.label';
    case 'titleEn':
      return 'titleEn.label';
    case 'titlePt':
      return 'titlePt.label';
    case 'kind':
      return 'kind.label';
    case 'layout':
      return 'layout.label';
    case 'position':
      return 'position.label';
    case 'priority':
      return 'priority.label';
    case 'audience':
      return 'audience.label';
    case 'locale':
      return 'locale.label';
    case 'startsAt':
      return 'startsAt.label';
    case 'endsAt':
      return 'endsAt.label';
    case 'sponsored':
      return 'sponsored.label';
  }
}

export { pinFormErrorKey };
