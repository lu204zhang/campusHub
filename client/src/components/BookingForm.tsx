import { useState, type FormEvent } from 'react';

import {
  CampusHubApiError,
  createReservation,
  type Reservation,
  type Resource,
} from '../api/campushubApi';
import styles from './BookingForm.module.css';

interface BookingFormProps {
  tenantId: string;
  userId: string;
  resource: Resource;
  onBooked: (reservation: Reservation) => void;
  onCancel: () => void;
}

function validateWindow(startTimeLocal: string, endTimeLocal: string): string | undefined {
  if (startTimeLocal.length === 0 || endTimeLocal.length === 0) {
    return 'Start time and end time are both required.';
  }

  const startTime = new Date(startTimeLocal);
  const endTime = new Date(endTimeLocal);

  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    return 'Start time and end time must be valid dates.';
  }

  if (startTime.getTime() < Date.now()) {
    return 'Start time must be in the future.';
  }

  if (startTime.getTime() >= endTime.getTime()) {
    return 'Start time must be before end time.';
  }

  return undefined;
}

function BookingForm({
  tenantId,
  userId,
  resource,
  onBooked,
  onCancel,
}: BookingFormProps): React.JSX.Element {
  const [startTimeLocal, setStartTimeLocal] = useState<string>('');
  const [endTimeLocal, setEndTimeLocal] = useState<string>('');
  const [validationError, setValidationError] = useState<string | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const windowError = validateWindow(startTimeLocal, endTimeLocal);
    setValidationError(windowError);
    if (windowError !== undefined) {
      return;
    }

    setSubmitError(undefined);
    setIsSubmitting(true);
    try {
      const reservation = await createReservation(tenantId, {
        resourceId: resource.id,
        userId,
        startTime: new Date(startTimeLocal).toISOString(),
        endTime: new Date(endTimeLocal).toISOString(),
      });
      onBooked(reservation);
    } catch (error) {
      if (error instanceof CampusHubApiError && error.status === 409) {
        setSubmitError('This resource is already reserved for the selected time window.');
      } else if (error instanceof CampusHubApiError) {
        setSubmitError(error.message);
      } else {
        setSubmitError('Failed to create reservation.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      <h3 className={styles.title}>Book {resource.name}</h3>

      <div className={styles.field}>
        <label htmlFor="booking-start-time">Start time</label>
        <input
          id="booking-start-time"
          type="datetime-local"
          value={startTimeLocal}
          onChange={(event) => setStartTimeLocal(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="booking-end-time">End time</label>
        <input
          id="booking-end-time"
          type="datetime-local"
          value={endTimeLocal}
          onChange={(event) => setEndTimeLocal(event.target.value)}
        />
      </div>

      {validationError !== undefined && <p className={styles.errorText}>{validationError}</p>}
      {submitError !== undefined && <p className={styles.errorText}>{submitError}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          {isSubmitting ? 'Booking…' : 'Confirm booking'}
        </button>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export { BookingForm };
