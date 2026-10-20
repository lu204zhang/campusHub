import { Types } from 'mongoose';

import { ReservationModel, type ReservationDocument } from '../models/Reservation.model';
import { ResourceModel } from '../models/Resource.model';
import type { Reservation, ReservationRequest, ReservationStatus } from '../types/reservation';

class ReservationValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ReservationValidationError';
  }
}

class ReservationConflictError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ReservationConflictError';
  }
}

class ReservationNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ReservationNotFoundError';
  }
}

function toReservation(document: ReservationDocument): Reservation {
  return {
    id: document._id.toString(),
    tenantId: document.tenantId,
    resourceId: document.resourceId.toString(),
    userId: document.userId,
    startTime: document.startTime.toISOString(),
    endTime: document.endTime.toISOString(),
    status: document.status,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function createReservation(
  tenantId: string,
  request: ReservationRequest,
): Promise<Reservation> {
  if (!Types.ObjectId.isValid(request.resourceId)) {
    throw new ReservationValidationError(
      `resourceId ${request.resourceId} is not a valid identifier.`,
    );
  }

  const resourceId = new Types.ObjectId(request.resourceId);
  const startTime = new Date(request.startTime);
  const endTime = new Date(request.endTime);

  const resourceExists = await ResourceModel.exists({ _id: resourceId, tenantId });
  if (!resourceExists) {
    throw new ReservationValidationError(
      `Resource ${request.resourceId} was not found for this tenant.`,
    );
  }

  const hasConflict = await ReservationModel.exists({
    tenantId,
    resourceId,
    status: { $ne: 'CANCELLED' },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  });

  if (hasConflict) {
    throw new ReservationConflictError(
      `Resource ${request.resourceId} is already reserved for the requested time window.`,
    );
  }

  const created = await ReservationModel.create({
    tenantId,
    resourceId,
    userId: request.userId,
    startTime,
    endTime,
    status: 'PENDING',
  });

  return toReservation(created);
}

async function listReservationsByUser(tenantId: string, userId: string): Promise<Reservation[]> {
  const documents = await ReservationModel.find({ tenantId, userId }).sort({ startTime: 1 });
  return documents.map(toReservation);
}

async function updateReservationStatus(
  tenantId: string,
  id: string,
  status: ReservationStatus,
): Promise<Reservation> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ReservationValidationError(`Reservation id ${id} is not a valid identifier.`);
  }

  const updated = await ReservationModel.findOneAndUpdate(
    { _id: id, tenantId },
    { status },
    { new: true },
  );

  if (!updated) {
    throw new ReservationNotFoundError(`Reservation ${id} was not found for this tenant.`);
  }

  return toReservation(updated);
}

async function cancelReservation(tenantId: string, id: string): Promise<Reservation> {
  return updateReservationStatus(tenantId, id, 'CANCELLED');
}

export {
  cancelReservation,
  createReservation,
  listReservationsByUser,
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationValidationError,
  updateReservationStatus,
};
