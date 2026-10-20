import { type HomeRow, type Locale } from '@notefinder/contracts';
import request from 'supertest';
import { trackViews } from '../src/database/schema/track-views.js';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { HomeFeedService } from '../src/modules/home/home-feed.service.js';
import { MIN_LOCALE_VIEWS_FOR_TRENDING } from '../src/modules/tracks/track-locale-trending.js';
import { createTestApp, type TestApp } from './utils/create-test-app.js';
import { resetDatabase } from './utils/database.js';
import { createCompletedTrack } from './utils/track-processing-factories.js';

const getHome = (testApp: TestApp, locale?: string) =>
  request(testApp.app.getHttpServer()).get(
    locale === undefined ? '/v1/home' : `/v1/home?locale=${locale}`,
  );

/** The title of the hero, the first row of every feed. */
const heroTitleOf = (body: { rows: unknown }): string | undefined => {
  const [hero] = body.rows as HomeRow[];
  return hero?.layout === 'hero' ? hero.track.title : undefined;
};

/** Views of one Track in one locale, recorded now. */
const recordViews = async (
  testApp: TestApp,
  trackId: string,
  locale: Locale,
  count: number,
): Promise<void> => {
  await testApp.db
    .insert(trackViews)
    .values(
      Array.from({ length: count }, () => ({ trackId, locale, userId: null })),
    );
};

describe('Home feed by locale (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  it('ranks each locale by the views of its own locale', async () => {
    const english = await createCompletedTrack(testApp.db, {
      title: 'English favorite',
      coverUrl: 'https://cdn.example/english.webp',
    });
    const portuguese = await createCompletedTrack(testApp.db, {
      title: 'Favorita brasileira',
      coverUrl: 'https://cdn.example/portuguese.webp',
    });
    await recordViews(testApp, english.id, 'en', MIN_LOCALE_VIEWS_FOR_TRENDING);
    await recordViews(
      testApp,
      portuguese.id,
      'pt-BR',
      MIN_LOCALE_VIEWS_FOR_TRENDING,
    );

    const en = await getHome(testApp, 'en').expect(200);
    const ptBr = await getHome(testApp, 'pt-BR').expect(200);

    expect(heroTitleOf(en.body)).toBe('English favorite');
    expect(heroTitleOf(ptBr.body)).toBe('Favorita brasileira');
  });

  it('serves the English feed when no locale is named', async () => {
    const english = await createCompletedTrack(testApp.db, {
      title: 'English favorite',
      coverUrl: 'https://cdn.example/english.webp',
    });
    await recordViews(testApp, english.id, 'en', MIN_LOCALE_VIEWS_FOR_TRENDING);

    const response = await getHome(testApp).expect(200);

    expect(heroTitleOf(response.body)).toBe('English favorite');
  });

  it('falls back to the global figures when a locale has too few views', async () => {
    const global = await createCompletedTrack(testApp.db, {
      title: 'Global hot',
      coverUrl: 'https://cdn.example/global.webp',
      trendingScore: 500,
    });
    const english = await createCompletedTrack(testApp.db, {
      title: 'English favorite',
      coverUrl: 'https://cdn.example/english.webp',
    });
    await recordViews(testApp, english.id, 'en', MIN_LOCALE_VIEWS_FOR_TRENDING);
    await recordViews(
      testApp,
      global.id,
      'pt-BR',
      MIN_LOCALE_VIEWS_FOR_TRENDING - 1,
    );

    const ptBr = await getHome(testApp, 'pt-BR').expect(200);

    expect(heroTitleOf(ptBr.body)).toBe('Global hot');
  });

  it('falls back to the global figures for a locale with no views at all', async () => {
    await createCompletedTrack(testApp.db, {
      title: 'Global hot',
      coverUrl: 'https://cdn.example/global.webp',
      trendingScore: 500,
    });

    const ptBr = await getHome(testApp, 'pt-BR').expect(200);

    expect(heroTitleOf(ptBr.body)).toBe('Global hot');
  });

  it('refuses an unsupported locale with a validation error', async () => {
    const response = await getHome(testApp, 'fr').expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('revalidates each locale on its own tag', async () => {
    const feeds = testApp.app.get(HomeFeedService);
    const queue = testApp.queues[WEB_REVALIDATION_QUEUE];
    // The app is shared by the tests of this file: start from an empty queue.
    if (queue) {
      queue.added.length = 0;
    }
    const revalidations = () => queue?.added ?? [];

    await feeds.refreshPublic('en');
    await feeds.refreshPublic('pt-BR');

    expect(revalidations()).toEqual([
      { name: 'revalidate', data: { tags: ['home:en'] } },
      { name: 'revalidate', data: { tags: ['home:pt-BR'] } },
    ]);
  });
});
