import type { ErrorRequestHandler } from 'express';

import {
  ReservationConflictError,
  ReservationNotFoundError,
  ReservationValidationError,
} from '../services/reservation.service';
import type { ErrorResponse } from '../types/reservation';

const errorHandler: ErrorRequestHandler = (error, _request, response, _next): void => {
  if (error instanceof ReservationConflictError) {
    const body: ErrorResponse = { code: 'RESERVATION_CONFLICT', message: error.message };
    response.status(409).json(body);
    return;
  }

  if (error instanceof ReservationNotFoundError) {
    const body: ErrorResponse = { code: 'RESERVATION_NOT_FOUND', message: error.message };
    response.status(404).json(body);
    return;
  }

  if (error instanceof ReservationValidationError) {
    const body: ErrorResponse = { code: 'VALIDATION_ERROR', message: error.message };
    response.status(400).json(body);
    return;
  }

  console.error('Unhandled error:', error);
  const body: ErrorResponse = { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' };
  response.status(500).json(body);
};

export { errorHandler };
