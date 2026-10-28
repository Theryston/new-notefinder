'use client';
import type { BillingCycle, SaveAdminPlanBody } from '@notefinder/contracts';
import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PlanPriceFields({
  form,
}: {
  form: UseFormReturn<SaveAdminPlanBody>;
}) {
  const t = useTranslations('adminPlans');
  const cycles = form.watch('enabledCycles');
  const prices = form.watch('prices');
  function toggle(cycle: BillingCycle, checked: boolean) {
    form.setValue(
      'enabledCycles',
      checked ? [...cycles, cycle] : cycles.filter((item) => item !== cycle),
    );
  }
  function amount(cycle: BillingCycle, currency: 'BRL' | 'USD', value: string) {
    const rest = prices.filter(
      (price) => price.cycle !== cycle || price.currency !== currency,
    );
    form.setValue(
      'prices',
      value === ''
        ? rest
        : [...rest, { cycle, currency, amount: Number(value) }],
    );
  }
  return (
    <fieldset className="space-y-4">
      <legend className="font-semibold">{t('cycles')}</legend>
      <p className="text-muted-foreground text-sm">{t('minorUnits')}</p>
      {(['monthly', 'annual'] as const).map((cycle) => (
        <div key={cycle} className="space-y-3 rounded-2xl border p-4">
          <Label className="flex min-h-10 items-center gap-2">
            <input
              type="checkbox"
              checked={cycles.includes(cycle)}
              onChange={(event) => toggle(cycle, event.target.checked)}
            />
            {t(cycle)}
          </Label>
          {cycles.includes(cycle) ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {(['BRL', 'USD'] as const).map((currency) => (
                <div key={currency} className="space-y-2">
                  <Label htmlFor={`${cycle}-${currency}`}>
                    {t('price', { currency, cycle: t(cycle) })}
                  </Label>
                  <Input
                    id={`${cycle}-${currency}`}
                    type="number"
                    min={1}
                    step={1}
                    value={
                      prices.find(
                        (price) =>
                          price.cycle === cycle && price.currency === currency,
                      )?.amount ?? ''
                    }
                    onChange={(event) =>
                      amount(cycle, currency, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </fieldset>
  );
}
