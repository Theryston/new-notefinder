'use client';

import { useTranslations } from 'next-intl';
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  saveScoringSettings,
  useScoringSettings,
} from '../stores/scoring-settings';

export function ScoringSettings() {
  const t = useTranslations('practice.scoring');
  const difficulty = useScoringSettings((state) => state.difficulty);
  const octaveMode = useScoringSettings((state) => state.octaveMode);
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t('difficulty')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={difficulty}
          onValueChange={(value) => {
            if (value === 'EASY' || value === 'NORMAL' || value === 'HARD')
              saveScoringSettings({ difficulty: value });
          }}
        >
          {(['EASY', 'NORMAL', 'HARD'] as const).map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuGroup>
        <DropdownMenuLabel>{t('octaveMode')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={octaveMode}
          onValueChange={(value) => {
            if (value === 'ANY' || value === 'EXACT')
              saveScoringSettings({ octaveMode: value });
          }}
        >
          {(['ANY', 'EXACT'] as const).map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </>
  );
}
