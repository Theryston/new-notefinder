import { expect, test } from '@playwright/test';
import { adminUser } from './admin-users';
import { mockAuthApi } from './auth-api-mock';
import { mockBenefitsApi } from './benefits-api-mock';
import { messages } from './messages';

const copy = (name: string) => ({
  en: { name, description: `${name} description` },
  'pt-BR': { name, description: `${name} description PT` },
});

test('catalog changes preserve unsaved Plan selections and ordering and drop deleted Benefits from drafts', async ({
  page,
}) => {
  const t = messages.en.adminBenefits;
  await mockAuthApi(page, { user: adminUser });
  const api = await mockBenefitsApi(page);
  api.benefits = [
    { id: 'cloud', copy: copy('Cloud'), status: 'coming-soon' },
    { id: 'scoring', copy: copy('Scoring'), status: 'coming-soon' },
  ];
  await page.goto('/en/admin/benefits');
  const free = page.getByRole('region', { name: 'Free', exact: true });
  const pro = page.getByRole('region', { name: 'Pro', exact: true });
  for (const editor of [free, pro]) {
    await editor.getByRole('checkbox', { name: 'Cloud', exact: true }).check();
    await editor
      .getByRole('checkbox', { name: 'Scoring', exact: true })
      .check();
    await editor
      .getByRole('button', { name: t.moveUp.replace('{name}', 'Scoring') })
      .click();
  }
  await page.getByRole('button', { name: t.create }).click();
  const dialog = page.getByRole('dialog');
  for (const language of ['en', 'pt-BR']) {
    await dialog.locator(`#benefit-${language}-name`).fill('Practice');
    await dialog
      .locator(`#benefit-${language}-description`)
      .fill('Practice description');
  }
  await dialog.getByRole('button', { name: t.save, exact: true }).click();
  for (const editor of [free, pro]) {
    await expect(
      editor.getByRole('checkbox', { name: 'Cloud', exact: true }),
    ).toBeChecked();
    await expect(
      editor.getByRole('checkbox', { name: 'Scoring', exact: true }),
    ).toBeChecked();
    await expect(editor.getByRole('listitem').locator('span')).toHaveText([
      'Scoring',
      'Cloud',
    ]);
  }
  await free.getByRole('checkbox', { name: 'Practice', exact: true }).check();
  const practice = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Practice', exact: true }),
  });
  await practice.getByRole('button', { name: t.delete, exact: true }).click();
  await expect(dialog.getByText(t.unused)).toBeVisible();
  await dialog
    .getByRole('button', { name: t.confirmDelete, exact: true })
    .click();
  await expect(
    free.getByRole('checkbox', { name: 'Practice', exact: true }),
  ).toHaveCount(0);
  await expect(free.getByRole('listitem').locator('span')).toHaveText([
    'Scoring',
    'Cloud',
  ]);
  await free.getByRole('button', { name: t.saveLinks }).click();
  await expect
    .poll(() => api.plans.find((plan) => plan.id === 'free')?.benefitIds)
    .toEqual(['scoring', 'cloud']);
  await expect(
    pro.getByRole('checkbox', { name: 'Cloud', exact: true }),
  ).toBeChecked();
  await expect(pro.getByRole('listitem').locator('span')).toHaveText([
    'Scoring',
    'Cloud',
  ]);
});
