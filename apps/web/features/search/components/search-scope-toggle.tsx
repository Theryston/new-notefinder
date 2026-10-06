'use client';

import type { SearchScope } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import { useQueryState } from 'nuqs';

import { cn } from '@/lib/utils';

import { parseSearchScope } from '../search-params';

const SCOPES: readonly SearchScope[] = ['metadata', 'lyrics'];

function ScopeButtons({
  scope,
  onChange,
  disabled,
}: {
  scope: SearchScope;
  onChange?: (scope: SearchScope) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('search.scope');

  return (
    <fieldset className="inline-flex items-center gap-0.5 self-start rounded-full bg-muted p-0.75 md:self-auto">
      <legend className="sr-only">{t('label')}</legend>
      {SCOPES.map((option) => {
        const pressed = option === scope;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onChange?.(option)}
            className={cn(
              'h-7.5 rounded-full px-2.5 font-semibold text-[0.8125rem] outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50',
              pressed
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(option)}
          </button>
        );
      })}
    </fieldset>
  );
}

/** Lyrics lives only here: the header field never reads or writes it. */
export function SearchScopeToggle() {
  const [urlScope, setUrlScope] = useQueryState('scope');
  const scope = parseSearchScope(urlScope);

  const setScope = (next: SearchScope) => {
    void setUrlScope(next === 'metadata' ? null : next);
  };

  return <ScopeButtons scope={scope} onChange={setScope} />;
}

/** Same dimensions while the toggle streams in (no layout shift). */
export function SearchScopeToggleFallback() {
  return <ScopeButtons scope="metadata" disabled />;
}
