'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function TrialDisclosure({
  offered,
  days,
  visible,
}: {
  offered: number;
  days: number;
  visible: boolean;
}) {
  const t = useTranslations('plans');
  const format = useFormatter();
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => {
    setToday(Date.now());
  }, []);
  if (!offered || !visible) return null;
  const date = today === null ? null : new Date(today + days * 86400000);
  return (
    <div className="space-y-1 text-muted-foreground text-sm">
      <p>{t(days ? 'trialOffer' : 'trialUsed', { days })}</p>
      {days && date ? (
        <p>
          {t('trialFirstCharge', {
            date: format.dateTime(date, { dateStyle: 'medium' }),
          })}
        </p>
      ) : null}
    </div>
  );
}
