import { getTranslations } from 'next-intl/server';

/** Unknown artist ID: a real 404 with a translated explanation. */
export default async function ArtistNotFound() {
  const t = await getTranslations('artists');

  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <h1 className="font-bold text-2xl tracking-tight">
        {t('notFound.title')}
      </h1>
      <p className="max-w-prose text-muted-foreground text-sm">
        {t('notFound.description')}
      </p>
    </div>
  );
}
