import request from 'supertest';
import type { Express } from 'express';

import { createApp } from '../../createApp';
import { ResourceModel, type IResource } from '../../models/Resource.model';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

type ResourceSeed = Pick<IResource, 'tenantId' | 'name' | 'type' | 'location' | 'isAvailable'>;

const app: Express = createApp();

async function seedResource(overrides: Partial<ResourceSeed> = {}): Promise<string> {
  const resource = await ResourceModel.create({
    tenantId: TENANT_A,
    name: 'Study Room 101',
    type: 'ROOM',
    location: 'Snell Library',
    isAvailable: true,
    ...overrides,
  });
  return resource._id.toString();
}

describe('POST /api/v1/reservations', () => {
  it('returns 201 Created with the new reservation', async () => {
    const resourceId = await seedResource();

    const response = await request(app)
      .post('/api/v1/reservations')
      .set('X-Tenant-Id', TENANT_A)
      .send({
        resourceId,
        userId: 'user-1',
        startTime: '2026-12-01T10:00:00.000Z',
        endTime: '2026-12-01T11:00:00.000Z',
      });

    expect(response.status).toBe(201);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toMatchObject({
      tenantId: TENANT_A,
      resourceId,
      userId: 'user-1',
      startTime: '2026-12-01T10:00:00.000Z',
      endTime: '2026-12-01T11:00:00.000Z',
      status: 'PENDING',
    });
  });

  it('returns 409 Conflict when the booking overlaps an existing reservation', async () => {
    const resourceId = await seedResource();
    const first = await request(app)
      .post('/api/v1/reservations')
      .set('X-Tenant-Id', TENANT_A)
      .send({
        resourceId,
        userId: 'user-1',
        startTime: '2026-12-01T10:00:00.000Z',
        endTime: '2026-12-01T11:00:00.000Z',
      });
    expect(first.status).toBe(201);

    const response = await request(app)
      .post('/api/v1/reservations')
      .set('X-Tenant-Id', TENANT_A)
      .send({
        resourceId,
        userId: 'user-2',
        startTime: '2026-12-01T10:30:00.000Z',
        endTime: '2026-12-01T11:30:00.000Z',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: 'RESERVATION_CONFLICT',
      message: `Resource ${resourceId} is already reserved for the requested time window.`,
    });
  });

  it('returns 400 when the X-Tenant-Id header is missing', async () => {
    const response = await request(app).post('/api/v1/reservations').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'TENANT_ID_REQUIRED',
      message: 'X-Tenant-Id header is required.',
    });
  });

  it('returns 400 when startTime does not precede endTime', async () => {
    const resourceId = await seedResource();

    const response = await request(app)
      .post('/api/v1/reservations')
      .set('X-Tenant-Id', TENANT_A)
      .send({
        resourceId,
        userId: 'user-1',
        startTime: '2026-12-01T11:00:00.000Z',
        endTime: '2026-12-01T10:00:00.000Z',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_RESERVATION_REQUEST' });
  });

  it('returns 400 when the resource belongs to another tenant', async () => {
    const resourceId = await seedResource({ tenantId: TENANT_B });

    const response = await request(app)
      .post('/api/v1/reservations')
      .set('X-Tenant-Id', TENANT_A)
      .send({
        resourceId,
        userId: 'user-1',
        startTime: '2026-12-01T10:00:00.000Z',
        endTime: '2026-12-01T11:00:00.000Z',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GET /api/v1/resources', () => {
  beforeEach(async () => {
    await seedResource({ name: 'B Room', type: 'ROOM', isAvailable: true });
    await seedResource({ name: 'A Room', type: 'ROOM', isAvailable: false });
    await seedResource({ name: 'Chem Lab', type: 'LAB', isAvailable: true });
    await seedResource({ tenantId: TENANT_B, name: 'Other Tenant Room', type: 'ROOM' });
  });

  it('returns 200 OK with all of the tenant resources sorted by name', async () => {
    const response = await request(app).get('/api/v1/resources').set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ name: 'A Room', tenantId: TENANT_A }),
      expect.objectContaining({ name: 'B Room', tenantId: TENANT_A }),
      expect.objectContaining({ name: 'Chem Lab', tenantId: TENANT_A }),
    ]);
  });

  it('returns 200 OK filtered by type', async () => {
    const response = await request(app)
      .get('/api/v1/resources')
      .query({ type: 'ROOM' })
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ name: 'A Room', type: 'ROOM' }),
      expect.objectContaining({ name: 'B Room', type: 'ROOM' }),
    ]);
  });

  it('returns 200 OK filtered by isAvailable', async () => {
    const response = await request(app)
      .get('/api/v1/resources')
      .query({ isAvailable: 'false' })
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ name: 'A Room', isAvailable: false }),
    ]);
  });

  it('returns 200 OK filtered by both type and isAvailable', async () => {
    const response = await request(app)
      .get('/api/v1/resources')
      .query({ type: 'ROOM', isAvailable: 'true' })
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ name: 'B Room', type: 'ROOM', isAvailable: true }),
    ]);
  });

  it('returns 400 for an unknown type value', async () => {
    const response = await request(app)
      .get('/api/v1/resources')
      .query({ type: 'CLOSET' })
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'type must be one of ROOM, EQUIPMENT, LAB.',
    });
  });

  it('returns 400 for a non-boolean isAvailable value', async () => {
    const response = await request(app)
      .get('/api/v1/resources')
      .query({ isAvailable: 'yes' })
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns 400 for an empty type value', async () => {
    const response = await request(app)
      .get('/api/v1/resources')
      .query({ type: '' })
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'type must be a non-empty string when provided.',
    });
  });

  it('returns 400 when type is repeated', async () => {
    const response = await request(app)
      .get('/api/v1/resources?type=ROOM&type=LAB')
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('returns 400 when the X-Tenant-Id header is missing', async () => {
    const response = await request(app).get('/api/v1/resources');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'TENANT_ID_REQUIRED' });
  });
});

describe('reservation lifecycle endpoints', () => {
  let resourceId: string;
  let reservationId: string;

  beforeEach(async () => {
    resourceId = await seedResource();
    const created = await createReservationViaApi(resourceId);
    reservationId = created.id;
  });

  async function createReservationViaApi(forResourceId: string): Promise<{ id: string }> {
    const response = await request(app)
      .post('/api/v1/reservations')
      .set('X-Tenant-Id', TENANT_A)
      .send({
        resourceId: forResourceId,
        userId: 'user-1',
        startTime: '2026-12-01T10:00:00.000Z',
        endTime: '2026-12-01T11:00:00.000Z',
      });
    const body: unknown = response.body;
    if (
      response.status !== 201 ||
      typeof body !== 'object' ||
      body === null ||
      !('id' in body) ||
      typeof body.id !== 'string'
    ) {
      throw new Error(`Expected a created reservation, got ${response.status}.`);
    }
    return { id: body.id };
  }

  it('GET /user/:userId returns 200 with the user reservations', async () => {
    const response = await request(app)
      .get('/api/v1/reservations/user/user-1')
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([expect.objectContaining({ id: reservationId, resourceId })]);
  });

  it('PATCH /:id/cancel returns 200 with the cancelled reservation', async () => {
    const response = await request(app)
      .patch(`/api/v1/reservations/${reservationId}/cancel`)
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: reservationId, status: 'CANCELLED' });
  });

  it('PATCH /:id/cancel returns 404 for another tenant', async () => {
    const response = await request(app)
      .patch(`/api/v1/reservations/${reservationId}/cancel`)
      .set('X-Tenant-Id', TENANT_B);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 'RESERVATION_NOT_FOUND',
      message: `Reservation ${reservationId} was not found for this tenant.`,
    });
  });

  it('PATCH /:id/status returns 200 when confirming', async () => {
    const response = await request(app)
      .patch(`/api/v1/reservations/${reservationId}/status`)
      .set('X-Tenant-Id', TENANT_A)
      .send({ status: 'CONFIRMED' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: reservationId, status: 'CONFIRMED' });
  });

  it('PATCH /:id/status returns 400 for a status outside CONFIRMED and CANCELLED', async () => {
    const response = await request(app)
      .patch(`/api/v1/reservations/${reservationId}/status`)
      .set('X-Tenant-Id', TENANT_A)
      .send({ status: 'PENDING' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_STATUS_UPDATE_REQUEST' });
  });

  it('PATCH /:id/status returns 400 when the body is missing', async () => {
    const response = await request(app)
      .patch(`/api/v1/reservations/${reservationId}/status`)
      .set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_STATUS_UPDATE_REQUEST' });
  });

  it('POST returns 400 when the body is missing', async () => {
    const response = await request(app).post('/api/v1/reservations').set('X-Tenant-Id', TENANT_A);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'INVALID_RESERVATION_REQUEST' });
  });
});

describe('centralized error handling', () => {
  it('returns a generic 500 without leaking internal error details', async () => {
    const resourceId = await seedResource();
    const findSpy = jest.spyOn(ResourceModel, 'exists').mockImplementationOnce(() => {
      throw new Error('connection string mongodb://secret@db leaked');
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const response = await request(app)
        .post('/api/v1/reservations')
        .set('X-Tenant-Id', TENANT_A)
        .send({
          resourceId,
          userId: 'user-1',
          startTime: '2026-12-01T10:00:00.000Z',
          endTime: '2026-12-01T11:00:00.000Z',
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      });
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      findSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });
});
