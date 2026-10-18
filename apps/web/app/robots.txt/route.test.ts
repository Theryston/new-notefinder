import { describe, expect, it } from 'vitest';

import { GET } from './route';

describe('GET /robots.txt', () => {
  it('references the index of the requested host as plain text', async () => {
    const response = await GET(
      new Request('http://localhost:3000/robots.txt', {
        headers: { host: 'localhost:3000' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toContain(
      'Sitemap: http://localhost:3000/sitemap.xml',
    );
  });
});
