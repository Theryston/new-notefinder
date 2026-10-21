'use client';

import type { EditorialPin } from '@notefinder/contracts';
import dynamic from 'next/dynamic';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { Spinner } from '@/components/ui/spinner';
import { FormAlert } from '@/features/auth/components/form-alert';
import { isApiError } from '@/lib/api/api-error';
import { useAdminPinMutations } from '../hooks/use-admin-pin-mutations';
import { useAdminPins } from '../hooks/use-admin-pins';
import type { PinFormCatalog } from '../pin-form';
import { pinStatus } from '../pin-status';
import { AdminHomePinsSkeleton } from './admin-home-pins-skeleton';

// The form dialog brings react-hook-form and the field catalog along, and the
// history dialog brings its own query: both open on an admin's click only, so
// they load after the page to keep it inside the bundle budget.
const PinFormDialog = dynamic(
  () => import('./pin-form-dialog').then((module) => module.PinFormDialog),
  { ssr: false },
);
const PinHistoryDialog = dynamic(
  () =>
    import('./pin-history-dialog').then((module) => module.PinHistoryDialog),
  { ssr: false },
);

/**
 * The pins and what an admin does with them: a card per pin with its state,
 * audience, locale, position and sponsored marker, and the create, edit,
 * history and delete dialogs. Cards (not a table) so the panel works on a
 * phone.
 */
export function PinsPanel({ catalog }: { catalog: PinFormCatalog }) {
  const t = useTranslations('adminHomePins');
  const pins = useAdminPins();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditorialPin | null>(null);
  const [historyOf, setHistoryOf] = useState<EditorialPin | null>(null);
  const [deleting, setDeleting] = useState<EditorialPin | null>(null);

  if (pins.isPending) return <AdminHomePinsSkeleton />;
  if (pins.isError) return <PinsLoadError error={pins.error} />;

  return (
    <div className="flex flex-col gap-4 py-2">
      <Toaster />
      <div className="flex items-center justify-end">
        <Button type="button" onClick={() => setCreating(true)}>
          {t('create')}
        </Button>
      </div>
      {pins.data.items.length === 0 ? (
        <p className="rounded-2xl bg-muted/50 px-5 py-8 text-center text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pins.data.items.map((pin) => (
            <PinCard
              key={pin.id}
              pin={pin}
              onEdit={() => setEditing(pin)}
              onHistory={() => setHistoryOf(pin)}
              onDelete={() => setDeleting(pin)}
            />
          ))}
        </ul>
      )}
      {creating && (
        <PinFormDialog
          mode="create"
          catalog={catalog}
          open={creating}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <PinFormDialog
          key={editing.id}
          mode="edit"
          catalog={catalog}
          pin={editing}
          open
          onClose={() => setEditing(null)}
        />
      )}
      {historyOf && (
        <PinHistoryDialog
          pin={historyOf}
          open
          onClose={() => setHistoryOf(null)}
        />
      )}
      {deleting && (
        <DeletePinDialog pin={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

/** The translated API error when the pin list refuses to load. */
function PinsLoadError({ error }: { error: unknown }) {
  const tErrors = useTranslations('errors');
  return (
    <div className="py-10">
      <FormAlert>
        {tErrors(isApiError(error) ? error.code : 'INTERNAL_ERROR')}
      </FormAlert>
    </div>
  );
}

/** Asks once before a pin leaves the home for good. */
function DeletePinDialog({
  pin,
  onClose,
}: {
  pin: EditorialPin;
  onClose: () => void;
}) {
  const t = useTranslations('adminHomePins');
  const { deletePin } = useAdminPinMutations();

  const confirm = async () => {
    await deletePin.mutateAsync(pin.id);
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent closeLabel={t('confirmDelete.cancel')}>
        <DialogHeader>
          <DialogTitle>{t('confirmDelete.title')}</DialogTitle>
          <DialogDescription>
            {t('confirmDelete.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('confirmDelete.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deletePin.isPending}
            onClick={() => void confirm()}
          >
            {deletePin.isPending && <Spinner />}
            {t('confirmDelete.confirm')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PinCard({
  pin,
  onEdit,
  onHistory,
  onDelete,
}: {
  pin: EditorialPin;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('adminHomePins');
  const format = useFormatter();
  const status = pinStatus(pin);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  const schedule = pin.startsAt
    ? pin.endsAt
      ? t('card.scheduleRange', {
          start: date(pin.startsAt),
          end: date(pin.endsAt),
        })
      : t('card.scheduleFrom', { start: date(pin.startsAt) })
    : pin.endsAt
      ? t('card.scheduleUntil', { end: date(pin.endsAt) })
      : t('card.alwaysLive');
  const title = pin.titles.en ?? pin.titles['pt-BR'] ?? pin.id;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary text-xs">
          {t(`status.${status}`)}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
          {t(`kind.${pin.kind}`)}
        </span>
        {pin.sponsored && (
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
            {t('sponsoredBadge')}
          </span>
        )}
      </div>
      <p className="font-bold text-lg tracking-tight">{title}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-xs">
            {t('card.position')}
          </dt>
          <dd className="font-medium">{pin.position}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">
            {t('card.audience')}
          </dt>
          <dd className="font-medium">{t(`audience.${pin.audience}`)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{t('card.locale')}</dt>
          <dd className="font-medium">{pin.locale ?? t('card.allLocales')}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">
            {t('card.schedule')}
          </dt>
          <dd className="font-medium">{schedule}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {t('edit')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onHistory}>
          {t('history')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDelete}>
          {t('delete')}
        </Button>
      </div>
    </li>
  );
}
