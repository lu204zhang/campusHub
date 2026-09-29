import { randomUUID } from 'node:crypto';

import type { Reservation, ReservationRequest } from '../types/reservation';

class ReservationConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ReservationConflictError';
  }
}

const reservationsByTenant = new Map<string, Reservation[]>();

function getTenantReservations(tenantId: string): Reservation[] {
  const existing = reservationsByTenant.get(tenantId);
  if (existing) {
    return existing;
  }

  const created: Reservation[] = [];
  reservationsByTenant.set(tenantId, created);
  return created;
}

function overlaps(
  reservation: Reservation,
  resourceId: string,
  startTime: Date,
  endTime: Date,
): boolean {
  if (reservation.resourceId !== resourceId || reservation.status === 'CANCELLED') {
    return false;
  }

  const existingStart = new Date(reservation.startTime);
  const existingEnd = new Date(reservation.endTime);
  return startTime < existingEnd && endTime > existingStart;
}

async function createReservation(
  tenantId: string,
  request: ReservationRequest,
): Promise<Reservation> {
  const startTime = new Date(request.startTime);
  const endTime = new Date(request.endTime);
  const tenantReservations = getTenantReservations(tenantId);

  const hasConflict = tenantReservations.some((reservation) =>
    overlaps(reservation, request.resourceId, startTime, endTime),
  );

  if (hasConflict) {
    throw new ReservationConflictError(
      `Resource ${request.resourceId} is already reserved for the requested time window.`,
    );
  }

  const now = new Date().toISOString();
  const reservation: Reservation = {
    id: randomUUID(),
    tenantId,
    resourceId: request.resourceId,
    userId: request.userId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  tenantReservations.push(reservation);
  return reservation;
}

async function listReservationsByUser(tenantId: string, userId: string): Promise<Reservation[]> {
  return getTenantReservations(tenantId).filter((reservation) => reservation.userId === userId);
}

export { createReservation, listReservationsByUser, ReservationConflictError };
