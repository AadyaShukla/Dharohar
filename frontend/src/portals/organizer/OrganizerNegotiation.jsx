import React, { useState, useEffect } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import OrganizerChat from '../../components/OrganizerChat';
import { getBooking } from '../../api';
import { getUser } from '../../auth';

export default function OrganizerNegotiation() {
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
          AI Multi-Agent Negotiation
        </h1>
        <p style={{ fontSize: '15px', color: '#525866', margin: 0 }}>
          Direct AI-assisted agreement between Organizer Agent and Artist Representative. Review proposals and approve substitutions.
        </p>
      </div>

      <OrganizerChat
        bookingId={bookingId}
        setBookingId={(id) => {
          setBookingId(id);
          if (id) {
            setSearchParams({ booking_id: id });
            if (context.setSelectedBookingId) context.setSelectedBookingId(id);
            if (context.reloadBookings) context.reloadBookings();
          }
        }}
        booking={booking}
        setBooking={setBooking}
        currentUser={currentUser}
      />
    </div>
  );
}

