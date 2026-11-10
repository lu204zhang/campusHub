import { Types } from 'mongoose';

import { ReservationModel } from '../../models/Reservation.model';
import { ResourceModel, type ResourceType } from '../../models/Resource.model';
import type { ReservationRequest } from '../../types/reservation';
import {
  cancelReservation,
  createReservation,
  listReservationsByUser,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationValidationError,
} from '../reservation.service';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const USER_ID = 'user-1';

interface ResourceFixture {
  tenantId: string;
  name: string;
  type: ResourceType;
  location: string;
}

async function createResource(overrides: Partial<ResourceFixture> = {}): Promise<string> {
  const resource = await ResourceModel.create({
    tenantId: TENANT_A,
    name: 'Study Room 101',
    type: 'ROOM',
    location: 'Snell Library',
    ...overrides,
  });
  return resource._id.toString();
}

function buildRequest(
  resourceId: string,
  startTime: string,
  endTime: string,
  userId: string = USER_ID,
): ReservationRequest {
  return { resourceId, userId, startTime, endTime };
}

describe('reservation.service', () => {
  describe('happy path', () => {
    it('creates a tenant-scoped resource that can be reserved', async () => {
      const resourceId = await createResource();

      const stored = await ResourceModel.findById(resourceId);

      expect(stored).not.toBeNull();
      expect(stored?.tenantId).toBe(TENANT_A);
      expect(stored?.isAvailable).toBe(true);
    });

    it('places a valid reservation as PENDING and returns ISO timestamps', async () => {
      const resourceId = await createResource();
      const request = buildRequest(
        resourceId,
        '2026-12-01T10:00:00.000Z',
        '2026-12-01T11:00:00.000Z',
      );

      const reservation = await createReservation(TENANT_A, request);

      expect(reservation).toMatchObject({
        tenantId: TENANT_A,
        resourceId,
        userId: USER_ID,
        startTime: '2026-12-01T10:00:00.000Z',
        endTime: '2026-12-01T11:00:00.000Z',
        status: 'PENDING',
      });
      expect(Types.ObjectId.isValid(reservation.id)).toBe(true);
      expect(await ReservationModel.countDocuments({ tenantId: TENANT_A })).toBe(1);
    });

    it('cancels an existing reservation', async () => {
      const resourceId = await createResource();
      const created = await createReservation(
        TENANT_A,
        buildRequest(resourceId, '2026-12-01T10:00:00.000Z', '2026-12-01T11:00:00.000Z'),
      );

      const cancelled = await cancelReservation(TENANT_A, created.id);

      expect(cancelled.id).toBe(created.id);
      expect(cancelled.status).toBe('CANCELLED');
      const stored = await ReservationModel.findById(created.id);
      expect(stored?.status).toBe('CANCELLED');
    });

    it('frees the time window once the blocking reservation is cancelled', async () => {
      const resourceId = await createResource();
      const window = buildRequest(
        resourceId,
        '2026-12-01T10:00:00.000Z',
        '2026-12-01T11:00:00.000Z',
      );
      const first = await createReservation(TENANT_A, window);
      await cancelReservation(TENANT_A, first.id);

      const second = await createReservation(TENANT_A, window);

      expect(second.status).toBe('PENDING');
      expect(second.id).not.toBe(first.id);
    });

    it('lists only the requesting tenant and user reservations, sorted by startTime', async () => {
      const resourceId = await createResource();
      await createReservation(
        TENANT_A,
        buildRequest(resourceId, '2026-12-01T14:00:00.000Z', '2026-12-01T15:00:00.000Z'),
      );
      await createReservation(
        TENANT_A,
        buildRequest(resourceId, '2026-12-01T09:00:00.000Z', '2026-12-01T10:00:00.000Z'),
      );
      await createReservation(
        TENANT_A,
        buildRequest(resourceId, '2026-12-01T11:00:00.000Z', '2026-12-01T12:00:00.000Z', 'user-2'),
      );

      const reservations = await listReservationsByUser(TENANT_A, USER_ID);

      expect(reservations.map((reservation) => reservation.startTime)).toEqual([
        '2026-12-01T09:00:00.000Z',
        '2026-12-01T14:00:00.000Z',
      ]);
      expect(await listReservationsByUser(TENANT_B, USER_ID)).toEqual([]);
    });
  });

  describe('edge cases', () => {
    const EXISTING_START = '2026-12-01T10:00:00.000Z';
    const EXISTING_END = '2026-12-01T11:00:00.000Z';

    let resourceId: string;

    beforeEach(async () => {
      resourceId = await createResource();
      await createReservation(TENANT_A, buildRequest(resourceId, EXISTING_START, EXISTING_END));
    });

    describe('double-booking', () => {
      it('rejects a reservation with exactly the same start and end times', async () => {
        await expect(
          createReservation(
            TENANT_A,
            buildRequest(resourceId, EXISTING_START, EXISTING_END, 'user-2'),
          ),
        ).rejects.toBeInstanceOf(ReservationConflictError);
        expect(await ReservationModel.countDocuments({ resourceId })).toBe(1);
      });

      it('rejects a reservation that fully contains the existing one', async () => {
        await expect(
          createReservation(
            TENANT_A,
            buildRequest(resourceId, '2026-12-01T09:00:00.000Z', '2026-12-01T12:00:00.000Z'),
          ),
        ).rejects.toBeInstanceOf(ReservationConflictError);
      });

      it('rejects a reservation fully inside the existing one', async () => {
        await expect(
          createReservation(
            TENANT_A,
            buildRequest(resourceId, '2026-12-01T10:15:00.000Z', '2026-12-01T10:45:00.000Z'),
          ),
        ).rejects.toBeInstanceOf(ReservationConflictError);
      });

      it('allows the same window on the same resource id under a different tenant', async () => {
        const otherTenantResourceId = await createResource({ tenantId: TENANT_B });

        const reservation = await createReservation(
          TENANT_B,
          buildRequest(otherTenantResourceId, EXISTING_START, EXISTING_END),
        );

        expect(reservation.tenantId).toBe(TENANT_B);
      });
    });

    describe('1 millisecond boundaries', () => {
      it('rejects a reservation that starts 1ms before the existing one ends', async () => {
        await expect(
          createReservation(
            TENANT_A,
            buildRequest(resourceId, '2026-12-01T10:59:59.999Z', '2026-12-01T12:00:00.000Z'),
          ),
        ).rejects.toBeInstanceOf(ReservationConflictError);
      });

      it('rejects a reservation that ends 1ms after the existing one starts', async () => {
        await expect(
          createReservation(
            TENANT_A,
            buildRequest(resourceId, '2026-12-01T09:00:00.000Z', '2026-12-01T10:00:00.001Z'),
          ),
        ).rejects.toBeInstanceOf(ReservationConflictError);
      });

      it('allows a back-to-back reservation that starts exactly when the existing one ends', async () => {
        const reservation = await createReservation(
          TENANT_A,
          buildRequest(resourceId, EXISTING_END, '2026-12-01T12:00:00.000Z'),
        );

        expect(reservation.startTime).toBe(EXISTING_END);
      });

      it('allows a back-to-back reservation that ends exactly when the existing one starts', async () => {
        const reservation = await createReservation(
          TENANT_A,
          buildRequest(resourceId, '2026-12-01T09:00:00.000Z', EXISTING_START),
        );

        expect(reservation.endTime).toBe(EXISTING_START);
      });

      it('allows a reservation that starts 1ms after the existing one ends', async () => {
        const reservation = await createReservation(
          TENANT_A,
          buildRequest(resourceId, '2026-12-01T11:00:00.001Z', '2026-12-01T12:00:00.000Z'),
        );

        expect(reservation.startTime).toBe('2026-12-01T11:00:00.001Z');
      });
    });

    describe('invalid time ranges', () => {
      it('rejects a reservation where endTime is before startTime', async () => {
        await expect(
          createReservation(
            TENANT_A,
            buildRequest(resourceId, '2026-12-02T11:00:00.000Z', '2026-12-02T10:00:00.000Z'),
          ),
        ).rejects.toBeInstanceOf(ReservationValidationError);
        expect(await ReservationModel.countDocuments({ resourceId })).toBe(1);
      });

      it('rejects a zero-length reservation where endTime equals startTime', async () => {
        await expect(
          createReservation(
            TENANT_A,
            buildRequest(resourceId, '2026-12-02T10:00:00.000Z', '2026-12-02T10:00:00.000Z'),
          ),
        ).rejects.toBeInstanceOf(ReservationValidationError);
      });

      it('rejects a reservation whose times are not parseable dates', async () => {
        await expect(
          createReservation(TENANT_A, buildRequest(resourceId, 'not-a-date', 'also-not-a-date')),
        ).rejects.toBeInstanceOf(ReservationValidationError);
      });
    });

    describe('resource lookups', () => {
      it('rejects a well-formed resourceId that does not exist', async () => {
        const missingResourceId = new Types.ObjectId().toString();

        await expect(
          createReservation(
            TENANT_A,
            buildRequest(missingResourceId, '2026-12-02T10:00:00.000Z', '2026-12-02T11:00:00.000Z'),
          ),
        ).rejects.toThrow(`Resource ${missingResourceId} was not found for this tenant.`);
      });

      it('rejects a malformed resourceId before querying', async () => {
        await expect(
          createReservation(
            TENANT_A,
            buildRequest(
              'not-an-object-id',
              '2026-12-02T10:00:00.000Z',
              '2026-12-02T11:00:00.000Z',
            ),
          ),
        ).rejects.toBeInstanceOf(ReservationValidationError);
      });

      it('treats another tenant resource as non-existent', async () => {
        await expect(
          createReservation(
            TENANT_B,
            buildRequest(resourceId, '2026-12-02T10:00:00.000Z', '2026-12-02T11:00:00.000Z'),
          ),
        ).rejects.toBeInstanceOf(ReservationValidationError);
      });
    });

    describe('cancellation', () => {
      it('throws not-found when cancelling a reservation id that does not exist', async () => {
        await expect(
          cancelReservation(TENANT_A, new Types.ObjectId().toString()),
        ).rejects.toBeInstanceOf(ReservationNotFoundError);
      });

      it('throws a validation error when cancelling a malformed reservation id', async () => {
        await expect(cancelReservation(TENANT_A, 'not-an-object-id')).rejects.toBeInstanceOf(
          ReservationValidationError,
        );
      });

      it('does not let another tenant cancel the reservation', async () => {
        const [existing] = await listReservationsByUser(TENANT_A, USER_ID);
        if (existing === undefined) {
          throw new Error('Expected the beforeEach reservation to exist.');
        }

        await expect(cancelReservation(TENANT_B, existing.id)).rejects.toBeInstanceOf(
          ReservationNotFoundError,
        );
        const stored = await ReservationModel.findById(existing.id);
        expect(stored?.status).toBe('PENDING');
      });
    });
  });
});
