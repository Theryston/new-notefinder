'use client';

import type { EditorialPin } from '@notefinder/contracts';
import { useQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FormAlert } from '@/features/auth/components/form-alert';

import { isApiError } from '@/lib/api/api-error';

import { adminPinHistoryQueryOptions } from '../admin-pins-query';

const KNOWN_FIELDS = [
  'kind',
  'layout',
  'source',
  'position',
  'priority',
  'audience',
  'locale',
  'startsAt',
  'endsAt',
  'titles',
  'sponsored',
] as const;

type KnownField = (typeof KNOWN_FIELDS)[number];

const isKnownField = (field: string): field is KnownField =>
  (KNOWN_FIELDS as readonly string[]).includes(field);

/** Every change of a pin: what changed, who changed it and when. */
export function PinHistoryDialog({
  pin,
  open,
  onClose,
}: {
  pin: EditorialPin;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('adminHomePins');
  const tHistory = useTranslations('adminHomePins.historyDialog');
  const tErrors = useTranslations('errors');
  const history = useQuery({
    ...adminPinHistoryQueryOptions(pin.id),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={t('form.cancel')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{tHistory('title')}</DialogTitle>
        </DialogHeader>
        {history.isPending ? (
          <div
            className="flex flex-col gap-3"
            role="status"
            aria-label="Loading"
          >
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : history.isError ? (
          <FormAlert>
            {tErrors(
              isApiError(history.error) ? history.error.code : 'INTERNAL_ERROR',
            )}
          </FormAlert>
        ) : history.data.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tHistory('empty')}</p>
        ) : (
          <ul className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto">
            {history.data.items.map((entry) => (
              <HistoryEntry
                key={entry.id}
                action={tHistory(`actions.${entry.action}`)}
                actor={entry.actor?.name ?? tHistory('unknownActor')}
                at={entry.createdAt}
                fields={entry.changedFields.filter(isKnownField)}
              />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HistoryEntry({
  action,
  actor,
  at,
  fields,
}: {
  action: string;
  actor: string;
  at: string;
  fields: readonly KnownField[];
}) {
  const tHistory = useTranslations('adminHomePins.historyDialog');
  const format = useFormatter();
  return (
    <li className="flex flex-col gap-1 rounded-2xl border px-4 py-3 text-sm">
      <p className="font-semibold">
        {action} · {actor}
      </p>
      <p className="text-muted-foreground text-xs">
        {format.dateTime(new Date(at), {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </p>
      {fields.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {fields.map((field) => tHistory(`fields.${field}`)).join(' · ')}
        </p>
      )}
    </li>
  );
}
