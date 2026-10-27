import { useCallback, useEffect, useState } from 'react';

import {
  CampusHubApiError,
  cancelReservation,
  fetchUserReservations,
  type Reservation,
} from '../api/campushubApi';
import styles from './UserReservations.module.css';

interface UserReservationsProps {
  tenantId: string;
  userId: string;
  refreshSignal?: number;
}

const STATUS_STYLES: Record<Reservation['status'], string> = {
  PENDING: styles.statusPending,
  CONFIRMED: styles.statusConfirmed,
  CANCELLED: styles.statusCancelled,
};

function formatRange(startTime: string, endTime: string): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return `${formatter.format(new Date(startTime))} → ${formatter.format(new Date(endTime))}`;
}

function UserReservations({
  tenantId,
  userId,
  refreshSignal = 0,
}: UserReservationsProps): React.JSX.Element {
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
      setError(
        loadError instanceof CampusHubApiError ? loadError.message : 'Failed to load bookings.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, userId]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations, refreshSignal]);

  async function handleCancel(reservationId: string): Promise<void> {
    setError(undefined);
    setCancellingId(reservationId);
    try {
      await cancelReservation(tenantId, reservationId);
      await loadReservations();
    } catch (cancelError) {
      setError(
        cancelError instanceof CampusHubApiError
          ? cancelError.message
          : 'Failed to cancel reservation.',
      );
    } finally {
      setCancellingId(undefined);
    }
  }

  return (
    <section>
      {isLoading && <p className={styles.status}>Loading your bookings…</p>}
      {error !== undefined && <p className={styles.errorText}>{error}</p>}
      {!isLoading && reservations.length === 0 && (
        <p className={styles.empty}>You have no bookings yet.</p>
      )}

      <ul className={styles.list}>
        {reservations.map((reservation) => (
          <li key={reservation.id} className={styles.row}>
            <div className={styles.details}>
              <p>{formatRange(reservation.startTime, reservation.endTime)}</p>
              <p className={styles.resourceId}>Resource: {reservation.resourceId}</p>
              <span className={STATUS_STYLES[reservation.status]}>{reservation.status}</span>
            </div>
            <button
              type="button"
              className={styles.cancelButton}
              disabled={reservation.status === 'CANCELLED' || cancellingId === reservation.id}
              onClick={() => void handleCancel(reservation.id)}
            >
              {cancellingId === reservation.id ? 'Cancelling…' : 'Cancel reservation'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { UserReservations };
