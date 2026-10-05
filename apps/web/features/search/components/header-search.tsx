'use client';

import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type FormEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/lib/i18n/navigation';

import { isSearchHotkey } from '../search-hotkey';
import { searchHref } from '../search-href';
import { SearchHotkeyHint } from './search-hotkey-hint';

/** The pill search field, with the `⌘K` keycap from `md` up. */
function SearchField({
  inputRef,
  onSubmit,
  onEscape,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEscape: () => void;
}) {
  const t = useTranslations('header.search');

  return (
    <form onSubmit={onSubmit} className="flex-1">
      <Input
        ref={inputRef}
        type="search"
        name="q"
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
        end={<SearchHotkeyHint className="hidden md:inline-flex" />}
        className="pr-2 pl-3.5"
        inputClassName="[&::-webkit-search-cancel-button]:hidden"
      />
    </form>
  );
}

/**
 * The header search. A pill field from `md` up; below that, a button that
 * expands the field over the whole header bar. `⌘K`/`Ctrl K` focuses it.
 */
export function HeaderSearch() {
  const t = useTranslations('header.search');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Rendered before focusing: the collapsed field is `display: none` on
  // small screens, and mobile browsers only open the keyboard when the
  // focus happens in the same tap.
  const expandAndFocus = useCallback(() => {
    flushSync(() => setExpanded(true));
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchHotkey(event)) return;
      event.preventDefault();
      expandAndFocus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandAndFocus]);

  const collapse = () => setExpanded(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const href = searchHref(inputRef.current?.value ?? '');
    if (!href) return;
    inputRef.current?.blur();
    collapse();
    router.push(href);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('open')}
        className="ml-auto md:hidden"
        onClick={expandAndFocus}
      >
        <SearchIcon className="size-5" />
      </Button>
      <search
        data-expanded={expanded || undefined}
        className="absolute inset-0 z-10 hidden items-center gap-1 rounded-full bg-popover p-2 data-expanded:flex md:static md:flex md:max-w-105 md:flex-1 md:bg-transparent md:p-0"
      >
        <SearchField
          inputRef={inputRef}
          onSubmit={onSubmit}
          onEscape={collapse}
        />
        <Button
          type="button"
          variant="ghost"
          className="md:hidden"
          onClick={collapse}
        >
          {t('cancel')}
        </Button>
      </search>
    </>
  );
}
