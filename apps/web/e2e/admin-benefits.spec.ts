import { expect, test } from '@playwright/test';
import { adminLocales, adminUser, regularUser } from './admin-users';
import { mockAuthApi } from './auth-api-mock';
import { mockBenefitsApi } from './benefits-api-mock';

for (const { locale, copy } of adminLocales) {
  const t = copy.adminBenefits;
  test(`${locale}: admin creates, edits, links, orders, changes global state and deletes shared benefits`, async ({
    page,
  }) => {
    if (locale === 'pt-BR') {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.emulateMedia({ colorScheme: 'dark' });
    }
    await mockAuthApi(page, { user: adminUser });
    const api = await mockBenefitsApi(page);
    await page.goto(`/${locale}/admin`);
    await page.getByRole('link', { name: new RegExp(t.title) }).click();
    await expect(
      page.getByRole('heading', { name: t.title, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(t.empty)).toBeVisible();
    for (const name of ['Cloud', 'Scoring']) {
      await page.getByRole('button', { name: t.create }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: t.save, exact: true }).click();
      await expect(dialog.getByText(t.invalidCopy).first()).toBeVisible();
      for (const language of ['en', 'pt-BR']) {
        await dialog
          .locator(`#benefit-${language}-name`)
          .fill(`${name} ${language}`);
        await dialog
          .locator(`#benefit-${language}-description`)
          .fill(`${name} description ${language}`);
      }
      await dialog.getByRole('button', { name: t.save, exact: true }).click();
      await expect(dialog).toHaveCount(0);
    }
    for (const plan of ['Free', 'Pro']) {
      const editor = page.getByRole('region', { name: plan, exact: true });
      await editor
        .getByRole('checkbox', { name: `Cloud ${locale}`, exact: true })
        .check();
      await editor
        .getByRole('checkbox', { name: `Scoring ${locale}`, exact: true })
        .check();
      await editor
        .getByRole('button', {
          name: t.moveUp.replace('{name}', `Scoring ${locale}`),
        })
        .click();
      await editor.getByRole('button', { name: t.saveLinks }).click();
      await expect
        .poll(
          () =>
            api.plans.find((entry) => entry.copy.en.name === plan)?.benefitIds,
        )
        .toEqual(['benefit-2', 'benefit-1']);
    }
    const cloud = page.getByRole('listitem').filter({
      has: page.getByRole('heading', {
        name: `Cloud ${locale}`,
        exact: true,
      }),
    });
    await cloud.getByRole('button', { name: t.edit, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#benefit-en-name').fill('Recordings en');
    await dialog.locator('#benefit-pt-BR-name').fill('Recordings pt-BR');
    await dialog.getByLabel(t.status).selectOption('available');
    await dialog.getByRole('button', { name: t.save, exact: true }).click();
    const updated = page.getByRole('listitem').filter({
      has: page.getByRole('heading', {
        name: `Recordings ${locale}`,
        exact: true,
      }),
    });
    await expect(
      updated.getByText(t.statuses.available, { exact: true }),
    ).toBeVisible();
    await updated.getByRole('button', { name: t.edit, exact: true }).click();
    await dialog.getByLabel(t.status).selectOption('hidden');
    await dialog.getByRole('button', { name: t.save, exact: true }).click();
    await expect(
      updated.getByText(t.statuses.hidden, { exact: true }),
    ).toBeVisible();
    await updated.getByRole('button', { name: t.delete, exact: true }).click();
    await expect(dialog.getByText('Free', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Pro', { exact: true })).toBeVisible();
    await dialog
      .getByRole('button', { name: t.confirmDelete, exact: true })
      .click();
    await expect(updated).toHaveCount(0);
    expect(
      api.plans.every((plan) => plan.benefitIds.join(',') === 'benefit-2'),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  });

  test(`${locale}: visitors and ordinary Users cannot read the benefit catalog`, async ({
    page,
  }) => {
    await mockAuthApi(page);
    const api = await mockBenefitsApi(page);
    await page.goto(`/${locale}/admin/benefits`);
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/sign-in\\?redirectTo=%2Fadmin%2Fbenefits$`),
    );
    await mockAuthApi(page, { user: regularUser });
    await page.goto(`/${locale}/admin/benefits`);
    await expect(
      page.getByRole('heading', { name: `404 ${copy.notFound.title}` }),
    ).toBeVisible();
    expect(api.calls).toEqual([]);
  });

  test(`${locale}: localized load errors retry and failed writes preserve the open form`, async ({
    page,
  }) => {
    await mockAuthApi(page, { user: adminUser });
    const api = await mockBenefitsApi(page);
    api.failReads = true;
    await page.goto(`/${locale}/admin/benefits`);
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      t.loadError,
    );
    api.failReads = false;
    await page.getByRole('button', { name: t.retry }).click();
    await expect(page.getByText(t.empty)).toBeVisible();
    await page.getByRole('button', { name: t.create }).click();
    const dialog = page.getByRole('dialog');
    for (const language of ['en', 'pt-BR']) {
      await dialog
        .locator(`#benefit-${language}-name`)
        .fill(`Cloud ${language}`);
      await dialog
        .locator(`#benefit-${language}-description`)
        .fill(`Cloud description ${language}`);
    }
    api.failWrites = true;
    await dialog.getByRole('button', { name: t.save, exact: true }).click();
    await expect(
      page.getByText(copy.errors.INTERNAL_ERROR, { exact: true }),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(api.benefits).toHaveLength(0);
  });
}
