import { asyncHandler } from '../middleware/asyncHandler';
import {
  cancelReservation as cancelReservationForTenant,
  createReservation as createReservationForTenant,
  listReservationsByUser as listReservationsByUserForTenant,
  updateReservationStatus as updateReservationStatusForTenant,
} from '../services/reservation.service';
import type {
  ErrorResponse,
  Reservation,
  ReservationRequest,
  ReservationStatus,
  ReservationStatusUpdateRequest,
} from '../types/reservation';

const UPDATABLE_STATUSES: readonly ReservationStatus[] = ['CONFIRMED', 'CANCELLED'];

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isReservationStatusUpdateRequest(value: unknown): value is ReservationStatusUpdateRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === 'string' &&
    (UPDATABLE_STATUSES as readonly string[]).includes(candidate.status)
  );
}

function isReservationRequest(value: unknown): value is ReservationRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.resourceId === 'string' &&
    candidate.resourceId.length > 0 &&
    typeof candidate.userId === 'string' &&
    candidate.userId.length > 0 &&
    isIsoDateTime(candidate.startTime) &&
    isIsoDateTime(candidate.endTime) &&
    new Date(candidate.startTime).getTime() < new Date(candidate.endTime).getTime()
  );
}

const createReservation = asyncHandler<Record<string, never>, Reservation | ErrorResponse, unknown>(
  async (request, response) => {
    if (!isReservationRequest(request.body)) {
      response.status(400).json({
        code: 'INVALID_RESERVATION_REQUEST',
        message:
          'resourceId, userId, startTime, and endTime are required, and startTime must precede endTime.',
      });
      return;
    }

    const reservation = await createReservationForTenant(request.tenantId, request.body);
    response.status(201).json(reservation);
  },
);

const listReservationsByUser = asyncHandler<{ userId: string }, Reservation[] | ErrorResponse>(
  async (request, response) => {
    const reservations = await listReservationsByUserForTenant(
      request.tenantId,
      request.params.userId,
    );
    response.status(200).json(reservations);
  },
);

const updateReservationStatus = asyncHandler<{ id: string }, Reservation | ErrorResponse, unknown>(
  async (request, response) => {
    if (!isReservationStatusUpdateRequest(request.body)) {
      response.status(400).json({
        code: 'INVALID_STATUS_UPDATE_REQUEST',
        message: `status is required and must be one of ${UPDATABLE_STATUSES.join(', ')}.`,
      });
      return;
    }

    const reservation = await updateReservationStatusForTenant(
      request.tenantId,
      request.params.id,
      request.body.status,
    );
    response.status(200).json(reservation);
  },
);

const cancelReservation = asyncHandler<{ id: string }, Reservation | ErrorResponse>(
  async (request, response) => {
    const reservation = await cancelReservationForTenant(request.tenantId, request.params.id);
    response.status(200).json(reservation);
  },
);

export { cancelReservation, createReservation, listReservationsByUser, updateReservationStatus };
