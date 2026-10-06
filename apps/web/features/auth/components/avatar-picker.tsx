'use client';

import { CameraIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import {
  AVATAR_ACCEPT,
  AVATAR_MAX_MEGABYTES,
  type AvatarFileProblem,
  avatarFileProblem,
} from '../avatar-file';

export type AvatarPickerState = {
  /** The file Save will upload: the last one picked, if it was usable. */
  file: File | null;
  /** Where to show `file` until it is uploaded. */
  previewUrl: string | null;
  /** Why the last file was refused, before any upload. */
  problem: AvatarFileProblem | null;
  choose: (file: File | undefined) => void;
  /** Forgets the pick, once it has been saved. */
  clear: () => void;
};

/**
 * The Avatar the user picked but has not saved. A refused file leaves nothing
 * picked, so the preview always shows exactly what Save would upload.
 */
export function useAvatarPicker(): AvatarPickerState {
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<AvatarFileProblem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (picked: File | undefined) => {
    if (!picked) return;
    const found = avatarFileProblem(picked);
    setProblem(found);
    setFile(found ? null : picked);
  };
  const clear = () => {
    setFile(null);
    setProblem(null);
  };

  return { file, previewUrl, problem, choose, clear };
}

/** The button that opens the file dialog, with the rules and any refusal. */
export function AvatarPicker({ picker }: { picker: AvatarPickerState }) {
  const t = useTranslations('profile.edit.avatar');
  const format = useFormatter();
  const inputRef = useRef<HTMLInputElement>(null);
  const messageId = useId();
  const size = format.number(AVATAR_MAX_MEGABYTES, {
    style: 'unit',
    unit: 'megabyte',
  });

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    picker.choose(event.target.files?.[0]);
    // So the same file can be picked again after it was refused or saved.
    event.target.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-1.5 text-center sm:items-start sm:text-left">
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-describedby={messageId}
        onClick={() => inputRef.current?.click()}
      >
        <CameraIcon data-icon="inline-start" />
        {t('change')}
      </Button>
      {picker.problem ? (
        <p
          id={messageId}
          role="alert"
          className="font-medium text-destructive text-xs"
        >
          {t(`errors.${picker.problem}`, { size })}
        </p>
      ) : (
        <p id={messageId} className="font-medium text-muted-foreground text-xs">
          {t('hint', { size })}
        </p>
      )}
    </div>
  );
}
