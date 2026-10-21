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
  message?: unknown;
  trackId?: unknown;
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

/**
 * Whether a `trackIdsText` custom issue is a source-eligibility refusal
 * (a Track that cannot appear) rather than the duplicate-Tracks rule the
 * form's `custom` message describes. Eligibility issues carry the refusing
 * `trackId`; the duplicate check does not.
 */
function isEligibilityIssue(raw: ServerIssue): boolean {
  return typeof raw.trackId === 'string' && raw.trackId.length > 0;
}

/**
 * The backend's `VALIDATION_FAILED` details as field errors the pin form
 * shows inline. The API answers `{ details: { issues } }` with Zod issues,
 * so the same path → field and code → message maps the client validation
 * uses apply here; unmapped issues are skipped. Eligibility refusals (a
 * Track that cannot appear) are skipped: the form's `custom` message for
 * the Tracks field describes duplicates, so showing it would mislead and
 * the toast carries the backend's reason instead.
 */
export function serverValidationFieldErrors(
  error: unknown,
): ServerFieldError[] {
  if (!isApiError(error) || error.code !== 'VALIDATION_FAILED') return [];
  const details = error.details as { issues?: unknown } | undefined;
  const issues = Array.isArray(details?.issues) ? details.issues : [];
  const mapped: ServerFieldError[] = [];
  for (const raw of issues) {
    if (!isServerIssue(raw)) continue;
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

/**
 * The backend's own reason for a `VALIDATION_FAILED`, when it carries one
 * the translated field message cannot express: an ineligible Track (with
 * its ID) or a dynamic source the panel cannot edit. Shown in the toast
 * alongside the translated message, so an admin sees what the backend
 * refused instead of a generic "some fields are invalid".
 */
export function serverValidationBackendReason(error: unknown): string | null {
  if (!isApiError(error) || error.code !== 'VALIDATION_FAILED') return null;
  const details = error.details as { issues?: unknown } | undefined;
  const issues = Array.isArray(details?.issues)
    ? details.issues.filter(isServerIssue)
    : [];
  const trackIds = issues
    .map((issue) => issue.trackId)
    .filter(
      (trackId): trackId is string =>
        typeof trackId === 'string' && trackId.length > 0,
    );
  const messages = issues
    .map((issue) => issue.message)
    .filter(
      (message): message is string =>
        typeof message === 'string' && message.length > 0,
    );
  if (trackIds.length > 0) {
    const reason = messages[0] ?? 'Some Tracks cannot appear in this pin';
    const unique = [...new Set(trackIds)];
    return `${reason}: ${unique.join(', ')}`;
  }
  const sourceIssue = issues.find((issue) => {
    const path = issuePathOf(issue);
    return path[0] === 'source' && typeof issue.message === 'string';
  });
  if (sourceIssue && typeof sourceIssue.message === 'string') {
    return sourceIssue.message;
  }
  return typeof error.message === 'string' && error.message.length > 0
    ? error.message
    : null;
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
