'use client';

import type { EditorialPinKind, EditorialPinLayout } from '@vozzify/contracts';
import { useTranslations } from 'next-intl';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/features/auth/components/form-field';
import { Link } from '@/lib/i18n/navigation';
import { TERMS_ADVERTISING_FRAGMENT } from '@/lib/terms-fragments';
import { cn } from '@/lib/utils';

import type { PinFormCatalog, PinFormField, PinFormValues } from '../pin-form';
import { pinFormErrorKey } from '../pin-form';

const selectClassName = (invalid: boolean) =>
  cn(
    'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring',
    invalid && 'border-destructive',
  );

/**
 * Translated validation message for `field`, with the catalog's limits
 * filled in. Zod's own sentences never render.
 */
export function useFieldError(
  errors: FieldErrors<PinFormValues>,
  catalog: PinFormCatalog,
) {
  const tForm = useTranslations('adminHomePins.form');
  return (field: PinFormField) => {
    const error = errors[field];
    if (!error?.type) return undefined;
    const key = pinFormErrorKey(field, error.type);
    if (key === 'errors.tooLong')
      return tForm(key, { max: catalog.maxTitleLength });
    if (key === 'errors.tooMany') return tForm(key, { max: catalog.maxTracks });
    return tForm(key);
  };
}

/** Hero or row: a hero always takes the hero layout and slot. */
export function KindField({
  kind,
  onSelect,
  error,
}: {
  kind: EditorialPinKind;
  onSelect: (kind: EditorialPinKind) => void;
  error?: string;
}) {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <FormField
      id="pin-kind"
      label={tForm('kind.label')}
      hint={tForm('kind.hint')}
      error={error}
    >
      <div
        role="radiogroup"
        aria-label={tForm('kind.label')}
        className="flex gap-2"
      >
        {(['hero', 'row'] as const).map((option) => (
          <label
            key={option}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center rounded-full border px-4 py-2 font-semibold text-sm transition-colors',
              kind === option
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input text-muted-foreground',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              checked={kind === option}
              onChange={() => onSelect(option)}
            />
            {tForm(`kind.${option}`)}
          </label>
        ))}
      </div>
    </FormField>
  );
}

/** The visual layout: locked to the hero for a hero pin. */
export function LayoutField({
  disabled,
  layouts,
  register,
  error,
}: {
  disabled: boolean;
  layouts: readonly EditorialPinLayout[];
  register: UseFormRegister<PinFormValues>;
  error?: string;
}) {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <FormField id="pin-layout" label={tForm('layout.label')} error={error}>
      <select
        id="pin-layout"
        className={selectClassName(Boolean(error))}
        disabled={disabled}
        {...register('layout')}
      >
        {layouts.map((layout) => (
          <option key={layout} value={layout}>
            {tForm(`layout.${layout}`)}
          </option>
        ))}
      </select>
    </FormField>
  );
}

/** A pin built from a source this panel cannot reorder keeps its Tracks. */
export function UnsupportedSourceNote() {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <p className="rounded-xl bg-muted/50 px-4 py-3 text-muted-foreground text-sm">
      {tForm('unsupportedSource')}
    </p>
  );
}

/** Position in the feed and priority against competing pins. */
export function PlacementFields({
  disabledPosition,
  register,
  catalog,
  positionError,
  priorityError,
}: {
  disabledPosition: boolean;
  register: UseFormRegister<PinFormValues>;
  catalog: PinFormCatalog;
  positionError?: string;
  priorityError?: string;
}) {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        id="pin-position"
        label={tForm('position.label')}
        hint={tForm('position.hint')}
        error={positionError}
      >
        <Input
          id="pin-position"
          type="number"
          min={0}
          max={catalog.maxPosition}
          disabled={disabledPosition}
          {...register('position', { valueAsNumber: true })}
        />
      </FormField>
      <FormField
        id="pin-priority"
        label={tForm('priority.label')}
        hint={tForm('priority.hint')}
        error={priorityError}
      >
        <Input
          id="pin-priority"
          type="number"
          min={0}
          max={catalog.maxPriority}
          {...register('priority', { valueAsNumber: true })}
        />
      </FormField>
    </div>
  );
}

/** Who sees the pin, and in which locale. */
export function TargetingFields({
  register,
  catalog,
  audienceError,
  localeError,
}: {
  register: UseFormRegister<PinFormValues>;
  catalog: PinFormCatalog;
  audienceError?: string;
  localeError?: string;
}) {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        id="pin-audience"
        label={tForm('audience.label')}
        error={audienceError}
      >
        <select
          id="pin-audience"
          className={selectClassName(Boolean(audienceError))}
          {...register('audience')}
        >
          {catalog.audiences.map((audience) => (
            <option key={audience} value={audience}>
              {tForm(`audience.${audience}`)}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        id="pin-locale"
        label={tForm('locale.label')}
        error={localeError}
      >
        <select
          id="pin-locale"
          className={selectClassName(Boolean(localeError))}
          {...register('locale')}
        >
          <option value="">{tForm('locale.all')}</option>
          {catalog.locales.map((option) => (
            <option key={option} value={option}>
              {tForm(`locale.names.${option}`)}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}

/** The live window: empty on either side means open-ended. */
export function ScheduleFields({
  register,
  startsError,
  endsError,
}: {
  register: UseFormRegister<PinFormValues>;
  startsError?: string;
  endsError?: string;
}) {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        id="pin-starts-at"
        label={tForm('startsAt.label')}
        hint={tForm('startsAt.hint')}
        error={startsError}
      >
        <Input
          id="pin-starts-at"
          type="datetime-local"
          {...register('startsAt')}
        />
      </FormField>
      <FormField
        id="pin-ends-at"
        label={tForm('endsAt.label')}
        hint={tForm('endsAt.hint')}
        error={endsError}
      >
        <Input id="pin-ends-at" type="datetime-local" {...register('endsAt')} />
      </FormField>
    </div>
  );
}

/** One title per served locale; only the served ones are required. */
export function TitlesFields({
  register,
  catalog,
  requiredLocales,
  titleEnError,
  titlePtError,
}: {
  register: UseFormRegister<PinFormValues>;
  catalog: PinFormCatalog;
  requiredLocales: readonly string[];
  titleEnError?: string;
  titlePtError?: string;
}) {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <>
      <FormField
        id="pin-title-en"
        label={`${tForm('titleEn.label')}${requiredLocales.includes('en') ? ' *' : ''}`}
        error={titleEnError}
      >
        <Input
          id="pin-title-en"
          maxLength={catalog.maxTitleLength}
          {...register('titleEn')}
        />
      </FormField>
      <FormField
        id="pin-title-pt"
        label={`${tForm('titlePt.label')}${requiredLocales.includes('pt-BR') ? ' *' : ''}`}
        error={titlePtError}
      >
        <Input
          id="pin-title-pt"
          maxLength={catalog.maxTitleLength}
          {...register('titlePt')}
        />
      </FormField>
    </>
  );
}

/** Off by default: marks the hero or row as containing sponsored content. */
export function SponsoredField({
  control,
}: {
  control: Control<PinFormValues>;
}) {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <Controller
      name="sponsored"
      control={control}
      render={({ field }) => (
        <div className="flex items-start gap-3 rounded-2xl border px-4 py-3">
          <Switch
            id="pin-sponsored"
            checked={field.value}
            onCheckedChange={field.onChange}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="pin-sponsored">{tForm('sponsored.label')}</Label>
            <p className="text-muted-foreground text-xs">
              {tForm('sponsored.help')}{' '}
              <Link
                href={`/terms#${TERMS_ADVERTISING_FRAGMENT}`}
                className="underline underline-offset-2"
              >
                {tForm('sponsored.termsLink')}
              </Link>
            </p>
          </div>
        </div>
      )}
    />
  );
}
