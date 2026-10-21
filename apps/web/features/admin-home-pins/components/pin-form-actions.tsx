'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/** Cancel or save, with the pending state while the pin saves. */
export function FormActions({
  mode,
  saving,
  onCancel,
}: {
  mode: 'create' | 'edit';
  saving: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations('adminHomePins');
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t('form.cancel')}
      </Button>
      <Button type="submit" disabled={saving}>
        {saving && <Spinner />}
        {t(mode === 'create' ? 'form.submitCreate' : 'form.submitSave')}
      </Button>
    </div>
  );
}
