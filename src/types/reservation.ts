type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

interface Reservation {
  id: string;
  tenantId: string;
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

interface ReservationRequest {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
}

interface ReservationStatusUpdateRequest {
  status: ReservationStatus;
}

interface ErrorResponse {
  code: string;
  message: string;
}

export {
  type ErrorResponse,
  type Reservation,
  type ReservationRequest,
  type ReservationStatus,
  type ReservationStatusUpdateRequest,
};
