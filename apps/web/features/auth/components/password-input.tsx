'use client';

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Password field with a show/hide toggle instead of a confirmation field. */
export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const t = useTranslations('auth.fields.password');
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOffIcon : EyeIcon;

  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      end={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={visible ? t('hide') : t('show')}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="-mr-3 text-muted-foreground hover:text-foreground"
        >
          <Icon />
        </Button>
      }
    />
  );
}
