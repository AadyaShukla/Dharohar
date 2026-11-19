import React, { useState, useEffect } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import AuditLogView from '../../components/AuditLogView';
import { getBooking } from '../../api';
import { getUser } from '../../auth';

export default function OrganizerAudit() {
  const [searchParams, setSearchParams] = useSearchParams();
  const context = useOutletContext() || {};
  const currentUser = getUser();

  const queryBookingId = searchParams.get('booking_id') || context.selectedBookingId || '';
  const [bookingId, setBookingId] = useState(queryBookingId);
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    if (queryBookingId && queryBookingId !== bookingId) {
      setBookingId(queryBookingId);
    }
  }, [queryBookingId]);

  useEffect(() => {
    if (bookingId) {
      getBooking(bookingId)
        .then((b) => setBooking(b))
        .catch(() => {});
      if (searchParams.get('booking_id') !== bookingId) {
        setSearchParams({ booking_id: bookingId });
      }
      if (context.setSelectedBookingId) {
        context.setSelectedBookingId(bookingId);
      }
    }
  }, [bookingId]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          Immutable Cryptographic Audit Trail
        </h1>
        <p style={{ fontSize: '15px', color: '#525866', margin: 0 }}>
          Inspect SHA-256 state transitions, negotiation counter-offers, escrow releases, and operator interventions.
        </p>
      </div>

      <AuditLogView
        bookingId={bookingId}
        setBookingId={(id) => {
          setBookingId(id);
          if (id) {
            setSearchParams({ booking_id: id });
            if (context.setSelectedBookingId) context.setSelectedBookingId(id);
          }
        }}
        booking={booking}
        currentUser={currentUser}
      />
    </div>
  );
}

