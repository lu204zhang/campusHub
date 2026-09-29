import type { NextFunction, Request, Response } from 'express';

import {
  createReservation as createReservationForTenant,
  listReservationsByUser as listReservationsByUserForTenant,
  ReservationConflictError,
} from '../services/reservation.service';
import type { ErrorResponse, Reservation, ReservationRequest } from '../types/reservation';

const TENANT_HEADER = 'x-tenant-id';

function getTenantId(request: Request): string | undefined {
  const header = request.headers[TENANT_HEADER];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
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

type CreateReservationRequest = Request<
  Record<string, never>,
  Reservation | ErrorResponse,
  unknown
>;
type CreateReservationResponse = Response<Reservation | ErrorResponse>;

async function createReservation(
  request: CreateReservationRequest,
  response: CreateReservationResponse,
  next: NextFunction,
): Promise<void> {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    response
      .status(400)
      .json({ code: 'TENANT_ID_REQUIRED', message: 'X-Tenant-Id header is required.' });
    return;
  }

  if (!isReservationRequest(request.body)) {
    response.status(400).json({
      code: 'INVALID_RESERVATION_REQUEST',
      message:
        'resourceId, userId, startTime, and endTime are required, and startTime must precede endTime.',
    });
    return;
  }

  try {
    const reservation = await createReservationForTenant(tenantId, request.body);
    response.status(201).json(reservation);
  } catch (error) {
    if (error instanceof ReservationConflictError) {
      response.status(409).json({ code: 'RESERVATION_CONFLICT', message: error.message });
      return;
    }
    next(error);
  }
}

type ListReservationsByUserRequest = Request<{ userId: string }, Reservation[] | ErrorResponse>;
type ListReservationsByUserResponse = Response<Reservation[] | ErrorResponse>;

async function listReservationsByUser(
  request: ListReservationsByUserRequest,
  response: ListReservationsByUserResponse,
  next: NextFunction,
): Promise<void> {
  const tenantId = getTenantId(request);
  if (!tenantId) {
    response
      .status(400)
      .json({ code: 'TENANT_ID_REQUIRED', message: 'X-Tenant-Id header is required.' });
    return;
  }

  try {
    const reservations = await listReservationsByUserForTenant(tenantId, request.params.userId);
    response.status(200).json(reservations);
  } catch (error) {
    next(error);
  }
}

export { createReservation, listReservationsByUser };
