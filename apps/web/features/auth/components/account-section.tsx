import { LockIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { EditSection } from './edit-section';
import type { ProfileUser } from './profile-avatar';
import { TextLink } from './text-link';

/**
 * One line of the card: the label, the value or action and, when it helps, a
 * caption under both. A `value` row (long text, like an email) stacks the
 * value under the label on a phone; an `action` row (a short link) stays on
 * one line. A `dl` keeps the pairs readable for screen readers while the
 * text stays selectable.
 */
function AccountRow({
  label,
  caption,
  layout = 'value',
  children,
}: {
  label: ReactNode;
  caption?: ReactNode;
  layout?: 'value' | 'action';
  children: ReactNode;
}) {
  const stacks = layout === 'value';

  return (
    <div
      className={cn(
        'grid min-h-14 content-center items-center gap-x-4 gap-y-1 px-4 py-3',
        stacks
          ? 'grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]'
          : 'grid-cols-[auto_minmax(0,1fr)]',
      )}
    >
      <dt className="font-semibold text-[0.8125rem]">{label}</dt>
      <dd
        className={cn(
          'flex min-w-0 items-center gap-1.5 text-sm',
          stacks ? 'sm:justify-end sm:text-right' : 'justify-end text-right',
        )}
      >
        {children}
      </dd>
      {caption && (
        <dd
          className={cn(
            'font-medium text-muted-foreground text-xs',
            stacks ? 'sm:col-span-2' : 'col-span-2',
          )}
        >
          {caption}
        </dd>
      )}
    </div>
  );
}

/**
 * What the user can see but not change here: Username and email are fixed,
 * and the password goes through the recovery flow. A list, not form fields,
 * so nothing in it looks editable.
 */
export function AccountSection({ user }: { user: ProfileUser }) {
  const t = useTranslations('profile.edit');
  const tFields = useTranslations('auth.fields');

  return (
    <EditSection title={t('sections.account')}>
      <dl className="divide-y divide-border rounded-2xl bg-card shadow-sm">
        <AccountRow
          label={tFields('username.label')}
          caption={t('usernameHint')}
        >
          <span className="min-w-0 break-all">@{user.username}</span>
          <LockIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        </AccountRow>
        <AccountRow label={tFields('email.label')}>
          <span className="min-w-0 break-all">{user.email}</span>
        </AccountRow>
        <AccountRow
          layout="action"
          label={tFields('password.label')}
          caption={t('passwordHint')}
        >
          <TextLink
            href="/forgot-password"
            className="-mx-2 -my-2 px-2 py-2 text-sm"
          >
            {t('changePassword')}
          </TextLink>
        </AccountRow>
      </dl>
    </EditSection>
  );
}
