'use client';

import { RotateCwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { loadAuthClient } from '../auth-client';
import { type AuthErrorCode, authErrorCode, authRequest } from '../auth-error';
import {
  browserStorage,
  cooldownSecondsLeft,
  readCodeSentAt,
  rememberCodeSentAt,
} from '../resend-cooldown';

/**
 * When the last code for `email` was sent: from `localStorage`, so reloading
 * the page doesn't reset the countdown, or now when there's no record (the
 * code was sent elsewhere, e.g. another browser).
 */
function initialSentAt(email: string): number {
  const storage = browserStorage();
  const stored = readCodeSentAt(storage, email);
  if (stored !== null) return stored;
  const now = Date.now();
  rememberCodeSentAt(storage, email, now);
  return now;
}

/** Sends a new verification code, at most once a minute. */
export function ResendCodeButton({
  email,
  onSent,
  onError,
}: {
  email: string;
  onSent: () => void;
  onError: (code: AuthErrorCode) => void;
}) {
  const t = useTranslations('auth');
  const [sentAt, setSentAt] = useState(() => initialSentAt(email));
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const secondsLeft = cooldownSecondsLeft(sentAt, now);
  const coolingDown = secondsLeft > 0;

  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  const resend = async () => {
    setPending(true);
    const { error } = await authRequest(() =>
      loadAuthClient().then((client) =>
        client.emailOtp.sendVerificationOtp({
          email,
          type: 'email-verification',
        }),
      ),
    );
    setPending(false);
    if (error) {
      onError(authErrorCode(error));
      return;
    }
    const sent = Date.now();
    rememberCodeSentAt(browserStorage(), email, sent);
    setSentAt(sent);
    setNow(sent);
    onSent();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className="tabular-nums"
      disabled={pending || coolingDown}
      aria-busy={pending}
      onClick={resend}
    >
      {pending ? <Spinner aria-label={t('loading')} /> : <RotateCwIcon />}
      {coolingDown
        ? t('verifyEmail.resendIn', { seconds: secondsLeft })
        : t('verifyEmail.resend')}
    </Button>
  );
}
