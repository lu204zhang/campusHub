type ResourceType = 'ROOM' | 'EQUIPMENT' | 'LAB';

interface Resource {
  id: string;
  tenantId: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

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

interface CreateReservationDTO {
  resourceId: string;
  userId: string;
  startTime: string;
  endTime: string;
}

interface ApiErrorResponse {
  code: string;
  message: string;
}

class CampusHubApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  public constructor(status: number, body: ApiErrorResponse) {
    super(body.message);
    this.name = 'CampusHubApiError';
    this.status = status;
    this.code = body.code;
  }
}

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}

async function request<TResponse>(
  tenantId: string,
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'X-Tenant-Id': tenantId,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    const errorBody: ApiErrorResponse = isApiErrorResponse(body)
      ? body
      : { code: 'UNKNOWN_ERROR', message: `Request failed with status ${response.status}.` };
    throw new CampusHubApiError(response.status, errorBody);
  }

  return (await response.json()) as TResponse;
}

async function fetchResources(
  tenantId: string,
  type?: ResourceType,
  isAvailable?: boolean,
): Promise<Resource[]> {
  const params = new URLSearchParams();
  if (type !== undefined) {
    params.set('type', type);
  }
  if (isAvailable !== undefined) {
    params.set('isAvailable', String(isAvailable));
  }

  const query = params.size > 0 ? `?${params.toString()}` : '';
  return request<Resource[]>(tenantId, `/resources${query}`);
}

async function createReservation(
  tenantId: string,
  payload: CreateReservationDTO,
): Promise<Reservation> {
  return request<Reservation>(tenantId, '/reservations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function fetchUserReservations(tenantId: string, userId: string): Promise<Reservation[]> {
  return request<Reservation[]>(tenantId, `/reservations/user/${encodeURIComponent(userId)}`);
}

async function cancelReservation(tenantId: string, reservationId: string): Promise<Reservation> {
  return request<Reservation>(
    tenantId,
    `/reservations/${encodeURIComponent(reservationId)}/cancel`,
    { method: 'PATCH' },
  );
}

export {
  CampusHubApiError,
  cancelReservation,
  createReservation,
  fetchResources,
  fetchUserReservations,
  type CreateReservationDTO,
  type Reservation,
  type ReservationStatus,
  type Resource,
  type ResourceType,
};
