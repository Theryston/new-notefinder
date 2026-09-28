'use client';

import { RotateCwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { AuthClient } from '@/lib/auth/client';

import { loadAuthClient } from '../auth-client';
import { type AuthErrorCode, authErrorCode, authRequest } from '../auth-error';
import {
  browserStorage,
  type CodePurpose,
  cooldownSecondsLeft,
  readCodeSentAt,
  rememberCodeSentAt,
} from '../resend-cooldown';

/**
 * When the last code for `email` was sent: from `localStorage`, so reloading
 * the page doesn't reset the countdown, or now when there's no record (the
 * code was sent elsewhere, e.g. another browser).
 */
function initialSentAt(email: string, purpose: CodePurpose): number {
  const storage = browserStorage();
  const stored = readCodeSentAt(storage, email, purpose);
  if (stored !== null) return stored;
  const now = Date.now();
  rememberCodeSentAt(storage, email, now, purpose);
  return now;
}

/** Asks the API to email a new `purpose` code to `email`. */
const sendCode = (client: AuthClient, email: string, purpose: CodePurpose) =>
  purpose === 'forget-password'
    ? client.emailOtp.requestPasswordReset({ email })
    : client.emailOtp.sendVerificationOtp({ email, type: purpose });

/**
 * Sends a new code (email verification by default, or password reset), at
 * most once a minute.
 */
export function ResendCodeButton({
  email,
  purpose = 'email-verification',
  onSent,
  onError,
}: {
  email: string;
  purpose?: CodePurpose;
  onSent: () => void;
  onError: (code: AuthErrorCode) => void;
}) {
  const t = useTranslations('auth');
  // Unknown until mounted: the server (and the hydration pass) can't read
  // `localStorage` or agree with the browser on the time.
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState(false);
  const secondsLeft = sentAt === null ? 0 : cooldownSecondsLeft(sentAt, now);
  const coolingDown = secondsLeft > 0;

  useEffect(() => {
    setSentAt(initialSentAt(email, purpose));
    setNow(Date.now());
  }, [email, purpose]);

  useEffect(() => {
    if (!coolingDown) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  const resend = async () => {
    setPending(true);
    const { error } = await authRequest(() =>
      loadAuthClient().then((client) => sendCode(client, email, purpose)),
    );
    setPending(false);
    if (error) {
      onError(authErrorCode(error));
      return;
    }
    const sent = Date.now();
    rememberCodeSentAt(browserStorage(), email, sent, purpose);
    setSentAt(sent);
    setNow(sent);
    onSent();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className="tabular-nums"
      disabled={sentAt === null || pending || coolingDown}
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
