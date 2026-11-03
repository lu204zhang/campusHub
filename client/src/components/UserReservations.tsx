import { useReservations } from '../hooks/useReservations';
import type { Reservation } from '../api/campushubApi';
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
  const { reservations, isLoading, error, cancellingId, cancel } = useReservations(
    tenantId,
    userId,
    refreshSignal,
  );

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
              onClick={() => void cancel(reservation.id)}
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
