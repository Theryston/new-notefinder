'use client';
import { useTranslations } from 'next-intl';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { saveSingingAids, useSingingAids } from '../stores/singing-aids-store';

export function SingingAidsSettings({
  onCalibrate,
}: {
  onCalibrate: () => void;
}) {
  const t = useTranslations('practice.aids');
  const countIn = useSingingAids((state) => state.countIn);
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        checked={countIn}
        onCheckedChange={(value) => saveSingingAids({ countIn: value })}
      >
        {t('countIn')}
      </DropdownMenuCheckboxItem>
      <DropdownMenuItem onClick={onCalibrate}>
        {t('calibrate')}
      </DropdownMenuItem>
    </>
  );
}
