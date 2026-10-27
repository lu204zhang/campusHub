import { useState } from 'react';

import './App.css';
import { BookingForm } from './components/BookingForm';
import { ResourceList } from './components/ResourceList';
import { UserReservations } from './components/UserReservations';
import type { Resource } from './api/campushubApi';

function App(): React.JSX.Element {
  const [tenantId, setTenantId] = useState<string>('tenant-a');
  const [userId, setUserId] = useState<string>('student-1');
  const [bookingResource, setBookingResource] = useState<Resource | undefined>(undefined);
  const [bookingRefreshSignal, setBookingRefreshSignal] = useState<number>(0);

  function handleBooked(): void {
    setBookingResource(undefined);
    setBookingRefreshSignal((signal) => signal + 1);
  }

  return (
    <div className="app">
      <h1>CampusHub</h1>

      <div className="identityBar">
        <div className="identityField">
          <label htmlFor="tenant-id">Tenant ID</label>
          <input
            id="tenant-id"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          />
        </div>
        <div className="identityField">
          <label htmlFor="user-id">User ID</label>
          <input id="user-id" value={userId} onChange={(event) => setUserId(event.target.value)} />
        </div>
      </div>

      <h2 className="sectionHeading">Resources</h2>
      <ResourceList tenantId={tenantId} onBook={setBookingResource} />

      {bookingResource !== undefined && (
        <>
          <h2 className="sectionHeading">New booking</h2>
          <BookingForm
            tenantId={tenantId}
            userId={userId}
            resource={bookingResource}
            onBooked={handleBooked}
            onCancel={() => setBookingResource(undefined)}
          />
        </>
      )}

      <h2 className="sectionHeading">My bookings</h2>
      <UserReservations tenantId={tenantId} userId={userId} refreshSignal={bookingRefreshSignal} />
    </div>
  );
}

export default App;
