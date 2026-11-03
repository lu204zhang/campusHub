import { useCallback, useEffect, useState } from 'react';

import {
  cancelReservation,
  fetchUserReservations,
  resolveApiErrorMessage,
  type Reservation,
} from '../api/campushubApi';

interface UseReservationsResult {
  reservations: Reservation[];
  isLoading: boolean;
  error: string | undefined;
  cancellingId: string | undefined;
  cancel: (reservationId: string) => Promise<void>;
}

function useReservations(
  tenantId: string,
  userId: string,
  refreshSignal: number = 0,
): UseReservationsResult {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [cancellingId, setCancellingId] = useState<string | undefined>(undefined);

  const loadReservations = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await fetchUserReservations(tenantId, userId);
      setReservations(result);
    } catch (loadError) {
      setError(resolveApiErrorMessage(loadError, 'Failed to load bookings.'));
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, userId]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations, refreshSignal]);

  const cancel = useCallback(
    async (reservationId: string): Promise<void> => {
      setError(undefined);
      setCancellingId(reservationId);
      try {
        await cancelReservation(tenantId, reservationId);
        await loadReservations();
      } catch (cancelError) {
        setError(resolveApiErrorMessage(cancelError, 'Failed to cancel reservation.'));
      } finally {
        setCancellingId(undefined);
      }
    },
    [tenantId, loadReservations],
  );

  return { reservations, isLoading, error, cancellingId, cancel };
}

export { useReservations };
