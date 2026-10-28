import {
  type TrackContributorsPage,
  trackContributorsPageSchema,
} from '@vozzify/contracts';
import request from 'supertest';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import {
  createCredentialAccount,
  createUser,
  createUserFollow,
  DEFAULT_PASSWORD,
  type User,
} from './utils/factories.js';
import {
  createCompletedTrack,
  createTrackContributor,
} from './utils/track-processing-factories.js';

// The Contributors endpoint carries each Contributor's User ID, and for a
// signed-in viewer whether they follow that User. Anonymous viewers get no
// follow flag at all.
describe('Track contributors follow state (e2e)', () => {
  const spec = useAuthSpec();

  const pageOf = async (
    trackId: string,
    query = '',
  ): Promise<TrackContributorsPage> => {
    const response = await request(spec.testApp.app.getHttpServer())
      .get(`/v1/tracks/${trackId}/contributors${query}`)
      .expect(200);
    return trackContributorsPageSchema.parse(response.body);
  };

  const signInAs = async (user: User) => {
    await createCredentialAccount(spec.testApp.db, user);
    await signIn(spec.client, {
      email: user.email,
      password: DEFAULT_PASSWORD,
    }).expect(200);
  };

  it('gives each Contributor its User ID and no follow flag to an anonymous viewer', async () => {
    const track = await createCompletedTrack(spec.testApp.db);
    const ada = await createUser(spec.testApp.db, { username: 'ada' });
    const adaContributor = await createTrackContributor(
      spec.testApp.db,
      track.id,
      ada.id,
    );

    const page = await pageOf(track.id);

    expect(page.items).toEqual([
      {
        id: adaContributor.id,
        userId: ada.id,
        username: 'ada',
        name: ada.name,
        image: null,
      },
    ]);
    expect(page.items[0]).not.toHaveProperty('isFollowing');
  });

  it('says for a signed-in viewer which Contributors they follow', async () => {
    const track = await createCompletedTrack(spec.testApp.db);
    const viewer = await createUser(spec.testApp.db, { username: 'viewer' });
    const ada = await createUser(spec.testApp.db, { username: 'ada' });
    const grace = await createUser(spec.testApp.db, { username: 'grace' });
    for (const user of [viewer, ada, grace]) {
      await createTrackContributor(spec.testApp.db, track.id, user.id);
    }
    await createUserFollow(spec.testApp.db, viewer.id, ada.id);
    // Being followed by a Contributor is not the viewer following them.
    await createUserFollow(spec.testApp.db, ada.id, viewer.id);
    await signInAs(viewer);

    const response = await spec.client
      .get(`/v1/tracks/${track.id}/contributors`)
      .expect(200);

    expect(
      trackContributorsPageSchema.parse(response.body).items.map((item) => ({
        userId: item.userId,
        isFollowing: item.isFollowing,
      })),
    ).toEqual([
      { userId: viewer.id, isFollowing: false },
      { userId: ada.id, isFollowing: true },
      { userId: grace.id, isFollowing: false },
    ]);
  });

  it('keeps the follow flag on a search page', async () => {
    const track = await createCompletedTrack(spec.testApp.db);
    const viewer = await createUser(spec.testApp.db, { username: 'viewer' });
    const ada = await createUser(spec.testApp.db, { username: 'ada' });
    await createTrackContributor(spec.testApp.db, track.id, ada.id);
    await createUserFollow(spec.testApp.db, viewer.id, ada.id);
    await signInAs(viewer);

    const response = await spec.client
      .get(`/v1/tracks/${track.id}/contributors?q=ada`)
      .expect(200);

    expect(response.body.items).toEqual([
      expect.objectContaining({ userId: ada.id, isFollowing: true }),
    ]);
  });

  it('keeps the User ID out of the Processing state', async () => {
    const track = await createCompletedTrack(spec.testApp.db);
    const ada = await createUser(spec.testApp.db, { username: 'ada' });
    await createTrackContributor(spec.testApp.db, track.id, ada.id);

    const response = await request(spec.testApp.app.getHttpServer())
      .get(`/v1/tracks/${track.id}/processing`)
      .expect(200);

    expect(response.body.contributors[0]).not.toHaveProperty('userId');
  });
});
