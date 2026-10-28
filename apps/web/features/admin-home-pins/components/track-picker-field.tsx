'use client';

import type { PinTrackSummary } from '@vozzify/contracts';
import { CheckIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/components/form-field';
import { TrackCoverArt } from '@/features/tracks/components/track-cover-art';
import { creditText } from '@/lib/track-credit';
import {
  usePinTrackSearch,
  usePinTrackSummaries,
} from '../hooks/use-pin-track-search';
import {
  type PinFormCatalog,
  type PinFormValues,
  parseTrackIds,
} from '../pin-form';

/** The thumb of a picked Track, fixed at 48px. */
function TrackThumb({ track }: { track: PinTrackSummary }) {
  return (
    <span className="relative block size-12 shrink-0 overflow-hidden rounded-md bg-muted">
      <TrackCoverArt
        coverArtUrl={track.coverUrl}
        placeholderSeed={track.id}
        sizes="48px"
      />
    </span>
  );
}

/** The picked IDs in the form, with helpers to change them. */
function usePickedIds(form: UseFormReturn<PinFormValues>, maxTracks: number) {
  const trackIdsText = form.watch('trackIdsText') ?? '';
  const ids = useMemo(() => parseTrackIds(trackIdsText), [trackIdsText]);
  const selected = useMemo(() => new Set(ids), [ids]);
  const setIds = (next: string[]) => {
    form.setValue('trackIdsText', next.join('\n'), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };
  return {
    ids,
    canAddMore: ids.length < maxTracks,
    add: (id: string) => {
      if (!selected.has(id) && ids.length < maxTracks) {
        setIds([...ids, id]);
      }
    },
    remove: (id: string) => {
      setIds(ids.filter((candidate) => candidate !== id));
    },
  };
}

/** One search match, picked with a click unless already picked or full. */
function SearchResultRow({
  item,
  added,
  disabled,
  onAdd,
}: {
  item: PinTrackSummary;
  added: boolean;
  disabled: boolean;
  onAdd: (id: string) => void;
}) {
  const tForm = useTranslations('adminHomePins.form');
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd(item.id)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
      >
        <TrackThumb track={item} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-sm">{item.title}</span>
          <span className="truncate text-muted-foreground text-xs">
            {creditText(item.artistCredit)}
          </span>
        </span>
        {added ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground text-xs">
            <CheckIcon
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.75}
            />
            {tForm('trackPicker.added')}
          </span>
        ) : (
          <PlusIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
          />
        )}
      </button>
    </li>
  );
}

/** The search matches to pick from. */
function SearchResults({
  items,
  selected,
  canAddMore,
  onAdd,
}: {
  items: PinTrackSummary[];
  selected: ReadonlySet<string>;
  canAddMore: boolean;
  onAdd: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  return (
    <ul
      ref={listRef}
      className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-input bg-background p-1"
    >
      {items.map((item) => {
        const added = selected.has(item.id);
        return (
          <SearchResultRow
            key={item.id}
            item={item}
            added={added}
            disabled={added || !canAddMore}
            onAdd={onAdd}
          />
        );
      })}
    </ul>
  );
}

/** One picked Track, with its remove button. */
function SelectedRow({
  id,
  item,
  pending,
  needsCover,
  onRemove,
}: {
  id: string;
  item: PinTrackSummary | undefined;
  pending: boolean;
  needsCover: boolean;
  onRemove: (id: string) => void;
}) {
  const tForm = useTranslations('adminHomePins.form');
  const title = item?.title ?? id;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-input bg-background px-2 py-1.5">
      {item ? (
        <TrackThumb track={item} />
      ) : (
        <span
          aria-hidden="true"
          className="block size-12 shrink-0 rounded-md bg-muted"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-sm">{title}</span>
        <span className="truncate text-muted-foreground text-xs">
          {item ? (
            creditText(item.artistCredit)
          ) : pending ? (
            <>&nbsp;</>
          ) : (
            tForm('trackPicker.unavailable', { id })
          )}
        </span>
        {needsCover ? (
          <span className="truncate font-medium text-amber-600 text-xs dark:text-amber-500">
            {tForm('trackPicker.needsCover')}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        aria-label={tForm('trackPicker.remove', { title })}
        onClick={() => onRemove(id)}
        className="rounded-full p-2 text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <XIcon aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </button>
    </li>
  );
}

/** The picked Tracks by name, with a remove button each. */
function SelectedList({
  ids,
  kind,
  onRemove,
}: {
  ids: string[];
  kind: 'hero' | 'row';
  onRemove: (id: string) => void;
}) {
  const summaries = usePinTrackSummaries(ids);
  const byId = useMemo(
    () => new Map((summaries.data?.items ?? []).map((item) => [item.id, item])),
    [summaries.data],
  );
  return (
    <ul className="flex flex-col gap-1.5">
      {ids.map((id) => {
        const item = byId.get(id);
        return (
          <SelectedRow
            key={id}
            id={id}
            item={item}
            pending={summaries.isPending}
            needsCover={kind === 'hero' && !!item && !item.coverUrl}
            onRemove={onRemove}
          />
        );
      })}
    </ul>
  );
}

/**
 * Picks the pin's Tracks by name instead of pasting IDs: the admin types,
 * the eligible Tracks show up, and each pick lands in the form. Everything
 * picked stays visible by name, and every pick can be removed again.
 */
export function TrackPickerField({
  form,
  catalog,
}: {
  form: UseFormReturn<PinFormValues>;
  catalog: PinFormCatalog;
}) {
  const tForm = useTranslations('adminHomePins.form');
  const kind = form.watch('kind');
  const { ids, canAddMore, add, remove } = usePickedIds(
    form,
    catalog.maxTracks,
  );
  const [query, setQuery] = useState('');
  const search = usePinTrackSearch(query, kind);
  const selected = useMemo(() => new Set(ids), [ids]);

  return (
    <div className="flex flex-col gap-3">
      <FormField id="pin-track-search" label={tForm('trackPicker.searchLabel')}>
        <div className="relative">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <Input
            id="pin-track-search"
            className="pl-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder={tForm('trackPicker.searchPlaceholder')}
            autoComplete="off"
          />
        </div>
        {search.searchedQuery !== '' && search.isPending ? (
          <p className="text-muted-foreground text-sm" role="status">
            {tForm('trackPicker.loading')}
          </p>
        ) : null}
        {search.searchedQuery !== '' && search.isError ? (
          <p className="text-destructive text-sm" role="alert">
            {tForm('trackPicker.error')}
          </p>
        ) : null}
        {search.searchedQuery !== '' &&
        search.isSuccess &&
        search.data.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tForm('trackPicker.empty')}
          </p>
        ) : null}
        {search.data && search.data.items.length > 0 ? (
          <SearchResults
            items={search.data.items}
            selected={selected}
            canAddMore={canAddMore}
            onAdd={add}
          />
        ) : null}
        {!canAddMore ? (
          <p className="text-muted-foreground text-sm">
            {tForm('trackPicker.limitHint', { max: catalog.maxTracks })}
          </p>
        ) : null}
      </FormField>
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-sm">
          {tForm('trackPicker.selected', { count: ids.length })}
        </h3>
        {ids.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {tForm('trackPicker.selectedEmpty')}
          </p>
        ) : (
          <SelectedList ids={ids} kind={kind} onRemove={remove} />
        )}
      </div>
    </div>
  );
}
