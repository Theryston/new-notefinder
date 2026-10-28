import { planCatalogSchema } from '@notefinder/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { planPrices, plans } from '../src/database/schema/plans.js';
import { WEB_REVALIDATION_QUEUE } from '../src/integrations/web-revalidation/web-revalidation.job.js';
import { signIn } from './utils/auth.js';
import { useAuthSpec } from './utils/auth-spec.js';
import { signInPinsAdmin } from './utils/editorial-pin-factories.js';
import {
  createCredentialAccount,
  createUser,
  DEFAULT_PASSWORD,
} from './utils/factories.js';

const body = {
  copy: {
    en: { name: 'Cloud recordings', description: 'Keep recordings online.' },
    'pt-BR': { name: 'Cloud recordings PT', description: 'Localized copy.' },
  },
  status: 'coming-soon',
};

describe('Admin shared plan benefits (e2e)', () => {
  const spec = useAuthSpec();

  it('maintains one localized catalog and orders benefits independently in every plan', async () => {
    await signInPinsAdmin(spec.testApp.db, spec.client);
    await spec.testApp.db.insert(plans).values([
      { id: 'free', kind: 'free', copy: body.copy, published: true },
      { id: 'future', kind: 'paid', copy: body.copy, published: true },
    ]);
    const created = await spec.client
      .post('/v1/admin/benefits')
      .send(body)
      .expect(201);
    const id: string = created.body.id;
    await spec.client
      .put('/v1/admin/plan-benefits/free')
      .send({ benefitIds: [id] })
      .expect(200);
    await spec.client
      .put('/v1/admin/plan-benefits/future')
      .send({ benefitIds: [id] })
      .expect(200);
    const catalog = await spec.client.get('/v1/plans?locale=pt-BR').expect(200);
    expect(
      planCatalogSchema
        .parse(catalog.body)
        .plans.every(
          (plan) => plan.benefits[0]?.name === 'Cloud recordings PT',
        ),
    ).toBe(true);
    const changed = await spec.client
      .patch(`/v1/admin/benefits/${id}`)
      .send({ ...body, status: 'available' })
      .expect(200);
    expect(changed.body.plans.map((plan: { id: string }) => plan.id)).toEqual([
      'free',
      'future',
    ]);
    const visible = await spec.client.get('/v1/plans').expect(200);
    expect(
      planCatalogSchema
        .parse(visible.body)
        .plans.every((plan) => plan.benefits[0]?.status === 'available'),
    ).toBe(true);
    const tags = spec.testApp.queues[WEB_REVALIDATION_QUEUE]?.added.flatMap(
      (job) => (job.data as { tags: string[] }).tags,
    );
    expect(tags).toEqual(
      expect.arrayContaining(['plans', 'plans:en', 'plans:pt-BR']),
    );
  });
  it.each(['visitor', 'user'] as const)(
    'rejects a %s on every administration operation',
    async (actor) => {
      const client =
        actor === 'visitor'
          ? request(spec.testApp.app.getHttpServer())
          : spec.client;
      if (actor === 'user') {
        const user = await createUser(spec.testApp.db, {
          email: 'plain@example.com',
          username: 'plain',
        });
        await createCredentialAccount(spec.testApp.db, user);
        await signIn(spec.client, {
          email: user.email,
          password: DEFAULT_PASSWORD,
        }).expect(200);
      }
      const code = actor === 'visitor' ? 401 : 403;
      await client.get('/v1/admin/benefits').expect(code);
      await client.get('/v1/admin/benefits/missing').expect(code);
      await client.post('/v1/admin/benefits').send(body).expect(code);
      await client.patch('/v1/admin/benefits/missing').send(body).expect(code);
      await client.delete('/v1/admin/benefits/missing').expect(code);
      await client.get('/v1/admin/plan-benefits').expect(code);
      await client
        .put('/v1/admin/plan-benefits/missing')
        .send({ benefitIds: [] })
        .expect(code);
    },
  );

  it('validates both locales, refuses arbitrary permissions and does not erase valid links on an invalid replacement', async () => {
    await signInPinsAdmin(spec.testApp.db, spec.client);
    await spec.testApp.db
      .insert(plans)
      .values({ id: 'free', kind: 'free', copy: body.copy, published: true });
    for (const invalid of [
      { ...body, copy: { en: body.copy.en } },
      { ...body, copy: { ...body.copy, en: { name: ' ', description: ' ' } } },
      {
        ...body,
        copy: {
          ...body.copy,
          'pt-BR': { name: 'x'.repeat(121), description: 'x'.repeat(1001) },
        },
      },
      { ...body, status: 'enabled' },
      { ...body, permission: 'ADMIN' },
    ]) {
      const response = await spec.client
        .post('/v1/admin/benefits')
        .send(invalid)
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
    }
    const created = await spec.client
      .post('/v1/admin/benefits')
      .send(body)
      .expect(201);
    const id: string = created.body.id;
    await spec.client
      .put('/v1/admin/plan-benefits/free')
      .send({ benefitIds: [id] })
      .expect(200);
    for (const benefitIds of [[id, id], ['missing'], [id, 'missing']]) {
      await spec.client
        .put('/v1/admin/plan-benefits/free')
        .send({ benefitIds })
        .expect(400);
    }
    const result = await spec.client.get('/v1/admin/plan-benefits').expect(200);
    expect(result.body).toMatchObject([{ id: 'free', benefitIds: [id] }]);
    await spec.client.get('/v1/admin/benefits/missing').expect(404);
    await spec.client
      .patch('/v1/admin/benefits/missing')
      .send(body)
      .expect(404);
    await spec.client.delete('/v1/admin/benefits/missing').expect(404);
    await spec.client
      .put('/v1/admin/plan-benefits/missing')
      .send({ benefitIds: [] })
      .expect(404);
    const rejected = await spec.client
      .patch(`/v1/admin/benefits/${id}`)
      .send({ ...body, copy: {} })
      .expect(400);
    expect(rejected.body.code).toBe('VALIDATION_FAILED');
  });

  it('keeps ordered membership plan-specific, allows unlinking all and propagates hidden globally', async () => {
    await signInPinsAdmin(spec.testApp.db, spec.client);
    await spec.testApp.db.insert(plans).values([
      { id: 'a', kind: 'free', copy: body.copy, published: true },
      { id: 'b', kind: 'paid', copy: body.copy, published: true },
    ]);
    const first = await spec.client
      .post('/v1/admin/benefits')
      .send(body)
      .expect(201);
    const second = await spec.client
      .post('/v1/admin/benefits')
      .send({
        ...body,
        copy: {
          ...body.copy,
          en: { name: 'Second', description: 'Second benefit' },
        },
      })
      .expect(201);
    const firstId: string = first.body.id;
    const secondId: string = second.body.id;
    await spec.client
      .put('/v1/admin/plan-benefits/a')
      .send({ benefitIds: [secondId, firstId] })
      .expect(200);
    await spec.client
      .put('/v1/admin/plan-benefits/b')
      .send({ benefitIds: [firstId] })
      .expect(200);
    const catalog = await spec.client.get('/v1/plans').expect(200);
    expect(
      planCatalogSchema
        .parse(catalog.body)
        .plans[0]?.benefits.map((benefit) => benefit.id),
    ).toEqual([secondId, firstId]);
    const edited = await spec.client
      .patch(`/v1/admin/benefits/${firstId}`)
      .send({
        ...body,
        status: 'hidden',
        copy: {
          ...body.copy,
          en: { name: 'Renamed', description: 'Updated description' },
        },
      })
      .expect(200);
    expect(edited.body.copy.en.name).toBe('Renamed');
    const hidden = await spec.client.get('/v1/plans').expect(200);
    expect(
      planCatalogSchema
        .parse(hidden.body)
        .plans.map((plan) => plan.benefits.map((benefit) => benefit.id)),
    ).toEqual([[secondId], []]);
    const admin = await spec.client.get('/v1/admin/benefits').expect(200);
    expect(admin.body).toHaveLength(2);
    await spec.client
      .put('/v1/admin/plan-benefits/a')
      .send({ benefitIds: [] })
      .expect(200);
    expect(
      (await spec.client.get(`/v1/admin/benefits/${secondId}`).expect(200)).body
        .plans,
    ).toEqual([]);
  });

  it('shows affected plans before deletion and atomically removes all links while preserving plans and prices', async () => {
    await signInPinsAdmin(spec.testApp.db, spec.client);
    await spec.testApp.db.insert(plans).values([
      { id: 'a', kind: 'free', copy: body.copy, published: true },
      { id: 'b', kind: 'paid', copy: body.copy, published: true },
    ]);
    await spec.testApp.db.insert(planPrices).values({
      id: 'historic',
      planId: 'b',
      cycle: 'monthly',
      currency: 'USD',
      amount: 350,
      current: false,
    });
    const created = await spec.client
      .post('/v1/admin/benefits')
      .send(body)
      .expect(201);
    const id: string = created.body.id;
    for (const planId of ['a', 'b'])
      await spec.client
        .put(`/v1/admin/plan-benefits/${planId}`)
        .send({ benefitIds: [id] })
        .expect(200);
    const affected = await spec.client
      .get(`/v1/admin/benefits/${id}`)
      .expect(200);
    expect(affected.body.plans.map((plan: { id: string }) => plan.id)).toEqual([
      'a',
      'b',
    ]);
    await spec.testApp.db.execute(
      sql`CREATE FUNCTION reject_benefit_link_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Deletion failure'; END $$`,
    );
    await spec.testApp.db.execute(
      sql`CREATE TRIGGER reject_benefit_link_delete BEFORE DELETE ON plan_benefits FOR EACH ROW EXECUTE FUNCTION reject_benefit_link_delete()`,
    );
    try {
      await spec.client.delete(`/v1/admin/benefits/${id}`).expect(500);
      const unchanged = await spec.client
        .get(`/v1/admin/benefits/${id}`)
        .expect(200);
      expect(unchanged.body.plans).toHaveLength(2);
    } finally {
      await spec.testApp.db.execute(
        sql`DROP TRIGGER reject_benefit_link_delete ON plan_benefits`,
      );
      await spec.testApp.db.execute(
        sql`DROP FUNCTION reject_benefit_link_delete()`,
      );
    }
    await spec.client.delete(`/v1/admin/benefits/${id}`).expect(204);
    expect(
      (await spec.client.get('/v1/admin/benefits').expect(200)).body,
    ).toEqual([]);
    const remaining = await spec.client
      .get('/v1/admin/plan-benefits')
      .expect(200);
    expect(
      remaining.body.map((plan: { benefitIds: string[] }) => plan.benefitIds),
    ).toEqual([[], []]);
    expect(
      await spec.testApp.db
        .select({
          id: planPrices.id,
          amount: planPrices.amount,
          current: planPrices.current,
        })
        .from(planPrices),
    ).toEqual([{ id: 'historic', amount: 350, current: false }]);
  });
});
