'use client';

import { LoaderCircle, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FocusEvent, FormEvent, RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { SearchHotkeyHint } from './search-hotkey-hint';

/** The pill search field, with the `⌘K` keycap from `md` up. */
function SearchField({
  inputRef,
  value,
  onChange,
  onSubmit,
  onEscape,
  onFocus,
  onBlur,
  loading,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEscape: () => void;
  onFocus: () => void;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  loading: boolean;
}) {
  const t = useTranslations('header.search');

  return (
    <form onSubmit={onSubmit} className="flex-1">
      <Input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        enterKeyHint="search"
        autoComplete="off"
        aria-label={t('label')}
        aria-keyshortcuts="Meta+K Control+K"
        placeholder={t('placeholder')}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.currentTarget.blur();
          onEscape();
        }}
        start={<SearchIcon aria-hidden="true" className="size-5" />}
        end={
          loading ? (
            <span role="status" aria-label={t('loading')}>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            </span>
          ) : (
            <SearchHotkeyHint className="hidden md:inline-flex" />
          )
        }
        className="pr-2 pl-3.5"
        inputClassName="[&::-webkit-search-cancel-button]:hidden"
      />
    </form>
  );
}

export type HeaderSearchBarProps = {
  expanded: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEscape: () => void;
  onOpen: () => void;
  onCancel: () => void;
  onFieldFocus: () => void;
  onFieldBlur: (event: FocusEvent<HTMLInputElement>) => void;
  loading: boolean;
};

/** The expandable bar: open button on small screens plus the live field. */
export function HeaderSearchBar({
  expanded,
  inputRef,
  inputValue,
  onInputChange,
  onSubmit,
  onEscape,
  onOpen,
  onCancel,
  onFieldFocus,
  onFieldBlur,
  loading,
}: HeaderSearchBarProps) {
  const t = useTranslations('header.search');

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('open')}
        className="ml-auto md:hidden"
        onClick={onOpen}
      >
        <SearchIcon className="size-5" />
      </Button>
      <search
        data-expanded={expanded || undefined}
        className="absolute inset-0 z-10 hidden items-center gap-1 rounded-full bg-popover p-2 data-expanded:flex md:static md:flex md:max-w-105 md:flex-1 md:bg-transparent md:p-0"
      >
        <SearchField
          inputRef={inputRef}
          value={inputValue}
          onChange={onInputChange}
          onSubmit={onSubmit}
          onEscape={onEscape}
          onFocus={onFieldFocus}
          onBlur={onFieldBlur}
          loading={loading}
        />
        <Button
          type="button"
          variant="ghost"
          className="md:hidden"
          onClick={onCancel}
        >
          {t('cancel')}
        </Button>
      </search>
    </>
  );
}

/** Static stand-in while the live field streams in (same dimensions). */
export function HeaderSearchFallback() {
  return (
    <>
      <div aria-hidden="true" className="ml-auto size-10 md:hidden" />
      <div
        aria-hidden="true"
        className="hidden h-10 flex-1 rounded-full bg-muted md:block md:max-w-105"
      />
    </>
  );
}
