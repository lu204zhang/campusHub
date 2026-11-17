import request from 'supertest';

import { createApp } from '../../createApp';

describe('GET /api/v1/health', () => {
  it('returns 200 OK with status ok and an ISO timestamp', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    const body: unknown = response.body;
    const timestamp =
      typeof body === 'object' && body !== null && 'timestamp' in body ? body.timestamp : undefined;
    expect(typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp))).toBe(true);
  });
});
