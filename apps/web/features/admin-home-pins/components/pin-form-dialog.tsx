'use client';

import type {
  EditorialPin,
  HomePinPreviewRequest,
} from '@notefinder/contracts';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { isLocale } from '@/lib/i18n/routing';
import { serverValidationFieldErrors } from '../admin-pin-server-error';
import { useAdminPinMutations } from '../hooks/use-admin-pin-mutations';
import {
  emptyPinForm,
  formValuesToBody,
  type PinFormCatalog,
  type PinFormValues,
  pinToFormValues,
  servedLocales,
} from '../pin-form';
import { pinFormResolver, preloadPinFormSchema } from '../pin-form-resolver';
import { FormActions } from './pin-form-actions';
import {
  KindField,
  LayoutField,
  PlacementFields,
  ScheduleFields,
  SponsoredField,
  TargetingFields,
  TitlesFields,
  UnsupportedSourceNote,
  useFieldError,
} from './pin-form-fields';
import { TrackPickerField } from './track-picker-field';

const PinPreviewDialog = dynamic(
  () =>
    import('./pin-preview-dialog').then((module) => module.PinPreviewDialog),
  { ssr: false },
);

type PinFormDialogProps = {
  mode: 'create' | 'edit';
  catalog: PinFormCatalog;
  pin?: EditorialPin;
  open: boolean;
  onClose: () => void;
};

/**
 * Creates or edits a pin. The kind drives the form: a hero always takes the
 * hero layout and slot (both locked), while a row picks any row layout and a
 * position. Only the titles the pin serves are required; the sponsored
 * checkbox stays off unless the admin turns it on.
 */
export function PinFormDialog({
  mode,
  catalog,
  pin,
  open,
  onClose,
}: PinFormDialogProps) {
  const t = useTranslations('adminHomePins');
  const pageLocale = useLocale();
  const form = useForm<PinFormValues>({
    resolver: pinFormResolver,
    defaultValues: pin ? pinToFormValues(pin) : emptyPinForm(),
  });
  const [previewRequest, setPreviewRequest] = useState<HomePinPreviewRequest>();
  // Load validation now, so it is ready on the first submit.
  useEffect(() => {
    preloadPinFormSchema().catch(() => {});
  }, []);
  const { onSubmit, saving } = usePinSubmit({
    form,
    mode,
    pin,
    catalog,
    onClose,
  });
  const preview = form.handleSubmit((values) => {
    const fixed: PinFormValues =
      values.kind === 'hero'
        ? { ...values, layout: 'hero', position: catalog.heroPosition }
        : values;
    const body = formValuesToBody(fixed);
    const source =
      pin && pin.source.type !== 'tracks' ? pin.source : body.source;
    setPreviewRequest({
      pin: { ...body, source },
      locale: isLocale(pageLocale) ? pageLocale : 'en',
      audience: 'visitor',
      ...(pin ? { pinId: pin.id } : {}),
    });
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={t('form.cancel')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t(mode === 'create' ? 'form.titleCreate' : 'form.titleEdit')}
          </DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void onSubmit(event)}
          className="flex flex-col gap-4"
        >
          <PinFormSections form={form} catalog={catalog} pin={pin} />
          <FormActions
            mode={mode}
            saving={saving}
            onPreview={() => void preview()}
            onCancel={onClose}
          />
        </form>
      </DialogContent>
      {previewRequest && (
        <PinPreviewDialog
          request={previewRequest}
          open
          onClose={() => setPreviewRequest(undefined)}
        />
      )}
    </Dialog>
  );
}

/** A hero always takes the hero layout and slot: keep them in sync. */
function useHeroPinSync(
  form: UseFormReturn<PinFormValues>,
  catalog: PinFormCatalog,
  isHero: boolean,
) {
  useEffect(() => {
    if (isHero) {
      form.setValue('layout', 'hero', { shouldValidate: true });
      form.setValue('position', catalog.heroPosition, {
        shouldValidate: true,
      });
    }
  }, [isHero, form, catalog.heroPosition]);
}

/** The Tracks of a tracks-sourced pin: picked by name in the picker. */
function SourceTracksFields({
  form,
  catalog,
}: {
  form: UseFormReturn<PinFormValues>;
  catalog: PinFormCatalog;
}) {
  return <TrackPickerField form={form} catalog={catalog} />;
}

/** Every field of the form, driven by the kind, locale and source. */
function PinFormSections({
  form,
  catalog,
  pin,
}: {
  form: UseFormReturn<PinFormValues>;
  catalog: PinFormCatalog;
  pin?: EditorialPin;
}) {
  const kind = form.watch('kind');
  const locale = form.watch('locale');
  const isHero = kind === 'hero';
  useHeroPinSync(form, catalog, isHero);
  const errorOf = useFieldError(form.formState.errors, catalog);
  const layouts = isHero
    ? (['hero'] as const)
    : catalog.layouts.filter((layout) => layout !== 'hero');
  const requiredLocales = servedLocales(catalog.locales, locale);
  const sourceEditable = !pin || pin.source.type === 'tracks';

  return (
    <>
      <KindField
        kind={kind}
        onSelect={(next) =>
          form.setValue('kind', next, { shouldValidate: true })
        }
        error={errorOf('kind')}
      />
      <LayoutField
        disabled={isHero}
        layouts={layouts}
        register={form.register}
        error={errorOf('layout')}
      />
      {sourceEditable ? (
        <SourceTracksFields form={form} catalog={catalog} />
      ) : (
        <UnsupportedSourceNote />
      )}
      <PlacementFields
        disabledPosition={isHero}
        register={form.register}
        catalog={catalog}
        positionError={errorOf('position')}
        priorityError={errorOf('priority')}
      />
      <TargetingFields
        register={form.register}
        catalog={catalog}
        audienceError={errorOf('audience')}
        localeError={errorOf('locale')}
      />
      <ScheduleFields
        register={form.register}
        startsError={errorOf('startsAt')}
        endsError={errorOf('endsAt')}
      />
      <TitlesFields
        register={form.register}
        catalog={catalog}
        requiredLocales={requiredLocales}
        titleEnError={errorOf('titleEn')}
        titlePtError={errorOf('titlePt')}
      />
      <SponsoredField control={form.control} />
    </>
  );
}

/** Saves the form through the admin endpoints, with a translated toast. */
function usePinSubmit({
  form,
  mode,
  pin,
  catalog,
  onClose,
}: {
  form: UseFormReturn<PinFormValues>;
  mode: 'create' | 'edit';
  pin?: EditorialPin;
  catalog: PinFormCatalog;
  onClose: () => void;
}) {
  const t = useTranslations('adminHomePins');
  const { createPin, updatePin } = useAdminPinMutations(catalog);
  const sourceEditable = !pin || pin.source.type === 'tracks';

  const onSubmit = form.handleSubmit(async (values) => {
    const fixed: PinFormValues =
      values.kind === 'hero'
        ? { ...values, layout: 'hero', position: catalog.heroPosition }
        : values;
    try {
      if (mode === 'create') {
        await createPin.mutateAsync(formValuesToBody(fixed));
        toast.success(t('form.created'));
      } else if (pin) {
        const body = formValuesToBody(fixed);
        // A source from a newer admin (genre, artist, album) is left alone:
        // only the settings change.
        const { source: _kept, ...settings } = body;
        await updatePin.mutateAsync({
          pinId: pin.id,
          body: sourceEditable ? body : settings,
        });
        toast.success(t('form.updated'));
      }
    } catch (error) {
      // The mutation already toasted the specific reason; mirror the
      // backend's field errors inline so the form names the field too.
      for (const { field, type } of serverValidationFieldErrors(error)) {
        form.setError(field, { type });
      }
      return;
    }
    onClose();
  });

  return { onSubmit, saving: createPin.isPending || updatePin.isPending };
}
