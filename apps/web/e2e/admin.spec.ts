import { expect, test } from '@playwright/test';
import { adminLocales, adminUser, regularUser } from './admin-users';
import { mockAuthApi } from './auth-api-mock';

test.describe('admin index', () => {
  for (const { locale, copy } of adminLocales) {
    const adminCopy = copy.admin;

    test(`${locale}: an admin sees the home pins card and opens it`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: adminUser });

      await page.goto(`/${locale}/admin`);
      await expect(
        page.getByRole('heading', { level: 1, name: adminCopy.title }),
      ).toBeVisible();

      const card = page.getByRole('link', {
        name: new RegExp(adminCopy.cards.homePins.title),
      });
      await expect(card).toHaveAttribute('href', `/${locale}/admin/home-pins`);
      await card.click();
      await expect(page).toHaveURL(`/${locale}/admin/home-pins`);
    });

    test(`${locale}: a regular user is refused with the not-found page`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: regularUser });

      await page.goto(`/${locale}/admin`);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: `404 ${copy.notFound.title}`,
        }),
      ).toBeVisible();
    });

    test(`${locale}: an anonymous visitor goes to sign in and back`, async ({
      page,
    }) => {
      await mockAuthApi(page);

      await page.goto(`/${locale}/admin`);
      await expect(page).toHaveURL(
        new RegExp(
          `/${locale === 'pt-BR' ? 'pt-BR' : 'en'}/sign-in\\?redirectTo=%2Fadmin$`,
        ),
      );
    });
  }
});
