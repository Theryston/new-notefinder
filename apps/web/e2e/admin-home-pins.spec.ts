import {
  expect,
  type Locator,
  type Page,
  type Request,
  test,
} from '@playwright/test';
import { mockAdminPinsApi, mockPin } from './admin-pins-api-mock';
import { type MockUser, mockAuthApi } from './auth-api-mock';
import { messages } from './messages';

const admin: MockUser = {
  id: 'usr_admin',
  name: 'Admin',
  email: 'admin@example.com',
  emailVerified: true,
  username: 'admin',
  image: null,
  createdAt: '2026-09-28T12:00:00.000Z',
  updatedAt: '2026-09-28T12:00:00.000Z',
  role: 'ADMIN',
};

const regular: MockUser = {
  id: 'usr_ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  emailVerified: true,
  username: 'ada',
  image: null,
  createdAt: '2026-09-28T12:00:00.000Z',
  updatedAt: '2026-09-28T12:00:00.000Z',
};

const locales = [
  { locale: 'en', copy: messages.en },
  { locale: 'pt-BR', copy: messages['pt-BR'] },
] as const;

test.describe('admin home pins', () => {
  /** Fills the titles, submits the dialog and waits for the pin to show. */
  async function submitPinTitles(
    dialog: Locator,
    page: Page,
    form: (typeof messages.en)['adminHomePins']['form'],
  ) {
    await dialog.getByLabel(form.titleEn.label).fill('Summer picks');
    await dialog.getByLabel(form.titlePt.label).fill('Escolhas de verão');
    await dialog.getByRole('button', { name: form.submitCreate }).click();
    await expect(page.getByText('Summer picks')).toBeVisible();
  }

  /** The last pin body the panel posted. */
  function lastPostedPin(calls: Request[]) {
    return calls
      .map((call) => call.postDataJSON())
      .find(
        (body): body is Record<string, unknown> =>
          !!body && typeof body === 'object' && 'sponsored' in body,
      );
  }

  for (const { locale, copy } of locales) {
    const pins = copy.adminHomePins;

    test(`${locale}: an admin creates a sponsored row pin and sees the badge`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: admin });
      const api = await mockAdminPinsApi(page);

      await page.goto(`/${locale}/admin/home-pins`);
      await expect(
        page.getByRole('heading', { level: 1, name: pins.title }),
      ).toBeVisible();
      await expect(page.getByText(pins.empty)).toBeVisible();

      await page.getByRole('button', { name: pins.create }).click();
      const dialog = page.getByRole('dialog');
      await dialog
        .getByLabel(pins.form.trackIds.label)
        .fill('trk_summer_a\ntrk_summer_b');
      await dialog.getByRole('switch').click();
      await expect(dialog.getByRole('switch')).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await submitPinTitles(dialog, page, pins.form);

      await expect(page.getByText(pins.sponsoredBadge)).toBeVisible();

      const posted = lastPostedPin(api.calls);
      expect(posted?.sponsored).toBe(true);
      expect(api.pins()).toHaveLength(1);
      expect(api.pins()[0]?.sponsored).toBe(true);
    });

    test(`${locale}: an admin picks tracks by name instead of pasting ids`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: admin });
      const api = await mockAdminPinsApi(page, {
        tracks: [
          {
            id: 'trk_summer_a',
            title: 'Summer Song',
            artistCredit: [{ name: 'Sun Singers', joinPhrase: '' }],
            coverUrl: 'https://cdn.example/summer.webp',
          },
          {
            id: 'trk_winter_b',
            title: 'Winter Ballad',
            artistCredit: [{ name: 'Snow Choir', joinPhrase: '' }],
            coverUrl: null,
          },
        ],
      });

      await page.goto(`/${locale}/admin/home-pins`);
      await page.getByRole('button', { name: pins.create }).click();
      const dialog = page.getByRole('dialog');
      const search = dialog.getByLabel(pins.form.trackPicker.searchLabel);
      await search.fill('summer');

      const result = dialog.getByRole('button', { name: /Summer Song/ });
      await expect(result).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: /Winter Ballad/ }),
      ).toHaveCount(0);

      await result.click();
      const trackIds = dialog.getByLabel(pins.form.trackIds.label);
      await expect(trackIds).toHaveValue('trk_summer_a');
      const removeName = pins.form.trackPicker.remove.replace(
        '{title}',
        'Summer Song',
      );
      await expect(
        dialog.getByRole('button', { name: removeName, exact: true }),
      ).toBeVisible();

      await dialog
        .getByRole('button', { name: removeName, exact: true })
        .click();
      await expect(trackIds).toHaveValue('');

      await dialog.getByRole('button', { name: /Summer Song/ }).click();
      await submitPinTitles(dialog, page, pins.form);

      const posted = lastPostedPin(api.calls);
      expect(posted?.source).toMatchObject({ trackIds: ['trk_summer_a'] });
    });

    test(`${locale}: the form validates required titles and the window order`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: admin });
      await mockAdminPinsApi(page);

      await page.goto(`/${locale}/admin/home-pins`);
      await page.getByRole('button', { name: pins.create }).click();
      const dialog = page.getByRole('dialog');

      await dialog
        .getByRole('button', { name: pins.form.submitCreate })
        .click();
      await expect(
        page.getByText(pins.form.errors.required).first(),
      ).toBeVisible();

      await dialog.getByLabel(pins.form.trackIds.label).fill('trk_summer_a');
      await dialog.getByLabel(pins.form.titleEn.label).fill('Summer picks');
      await dialog
        .getByLabel(pins.form.titlePt.label)
        .fill('Escolhas de verão');
      await dialog
        .getByLabel(pins.form.startsAt.label)
        .fill('2026-11-02T10:00');
      await dialog.getByLabel(pins.form.endsAt.label).fill('2026-11-01T10:00');
      await dialog
        .getByRole('button', { name: pins.form.submitCreate })
        .click();

      await expect(
        page.getByText(pins.form.errors.endsBeforeStart),
      ).toBeVisible();
    });

    test(`${locale}: a regular user is refused with the not-found page`, async ({
      page,
    }) => {
      await mockAuthApi(page, { user: regular });
      const api = await mockAdminPinsApi(page);

      await page.goto(`/${locale}/admin/home-pins`);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: `404 ${copy.notFound.title}`,
        }),
      ).toBeVisible();
      expect(api.calls.some((call) => call.method() === 'GET')).toBe(false);
    });

    test(`${locale}: an anonymous visitor goes to sign in and back`, async ({
      page,
    }) => {
      await mockAuthApi(page);
      await mockAdminPinsApi(page);

      await page.goto(`/${locale}/admin/home-pins`);
      await expect(page).toHaveURL(
        new RegExp(
          `/${locale === 'pt-BR' ? 'pt-BR' : 'en'}/sign-in\\?redirectTo=%2Fadmin%2Fhome-pins$`,
        ),
      );
    });
  }

  test('the history shows who changed the sponsored flag', async ({ page }) => {
    const pins = messages.en.adminHomePins;
    await mockAuthApi(page, { user: admin });
    const pin = mockPin({ id: 'pin_9', sponsored: true });
    await mockAdminPinsApi(page, {
      pins: [pin],
      history: {
        pin_9: [
          {
            id: 'hist_1',
            pinId: 'pin_9',
            action: 'UPDATED',
            changedFields: ['titles', 'sponsored'],
            actor: { id: 'usr_admin', name: 'Admin' },
            state: {
              kind: pin.kind,
              layout: pin.layout,
              source: pin.source,
              position: pin.position,
              priority: pin.priority,
              audience: pin.audience,
              locale: pin.locale,
              startsAt: pin.startsAt,
              endsAt: pin.endsAt,
              titles: pin.titles,
              sponsored: true,
            },
            createdAt: '2026-10-21T13:00:00.000Z',
          },
        ],
      },
    });

    await page.goto('/en/admin/home-pins');
    await page.getByRole('button', { name: pins.history }).click();

    const dialog = page.getByRole('dialog');
    await expect(
      dialog.getByText(pins.historyDialog.actions.UPDATED),
    ).toBeVisible();
    await expect(dialog.getByText('Admin')).toBeVisible();
    await expect(
      dialog.getByText(pins.historyDialog.fields.sponsored),
    ).toBeVisible();
  });
});
