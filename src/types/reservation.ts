import type {
  ErrorResponse,
  Reservation,
  ReservationRequest,
  ReservationStatus,
} from '@campushub/shared-types';

interface ReservationStatusUpdateRequest {
  status: ReservationStatus;
}

export {
  type ErrorResponse,
  type Reservation,
  type ReservationRequest,
  type ReservationStatus,
  type ReservationStatusUpdateRequest,
};
