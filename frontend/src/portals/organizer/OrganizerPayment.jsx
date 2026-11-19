import React, { useState, useEffect } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import TrustPayTracker from '../../components/TrustPayTracker';
import { getBooking, pay, getPublicConfig } from '../../api';
import { getUser } from '../../auth';

export default function OrganizerPayment() {
  const [searchParams, setSearchParams] = useSearchParams();
  const context = useOutletContext() || {};
  const currentUser = getUser();

  const queryBookingId = searchParams.get('booking_id') || context.selectedBookingId || '';
  const [bookingId, setBookingId] = useState(queryBookingId);
  const [booking, setBooking] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState('mock');
  const [paying, setPaying] = useState(false);
  const [payNotice, setPayNotice] = useState(null);

  useEffect(() => {
    getPublicConfig()
      .then((cfg) => {
        if (cfg && cfg.payment_provider) {
          setPaymentProvider(cfg.payment_provider);
        }
      })
      .catch(() => {});
  }, []);

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

  async function handleQuickSimulatedPay() {
    if (!bookingId) return;
    setPaying(true);
    setPayNotice(null);
    try {
      const res = await pay(bookingId);
      setPayNotice('✓ Simulated payment captured successfully! Escrow is now held.');
      const b = await getBooking(bookingId);
      setBooking(b);
      if (context.reloadBookings) await context.reloadBookings();
    } catch (err) {
      setPayNotice(`Payment failed: ${err.message}`);
    } finally {
      setPaying(false);
    }
  }

  const isPaid = booking?.status === 'PAID' || booking?.status === 'ESCROW_HELD' || booking?.status === 'PERFORMANCE_CONFIRMED' || booking?.status === 'SETTLED';

  return (
    <div>
      {/* Prominent Simulated Payment Banner */}
      <div
        style={{
          backgroundColor: '#FFFBEB',
          border: '2px solid #F59E0B',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🔒</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#92400E' }}>
              SIMULATED PAYMENT (test provider, no real money)
            </div>
            <div style={{ fontSize: '13.5px', color: '#B45309' }}>
              Provider: <strong>{paymentProvider.toUpperCase()}</strong> — Funds are safely tracked in simulated TrustPay escrow ledger.
            </div>
          </div>
        </div>

        {bookingId && !isPaid && (
          <button
            type="button"
            onClick={handleQuickSimulatedPay}
            disabled={paying}
            style={{
              padding: '10px 22px',
              backgroundColor: '#C2410C',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: paying ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(194, 65, 12, 0.3)',
            }}
          >
            {paying ? 'Processing...' : 'Pay (simulated)'}
          </button>
        )}
      </div>

      {payNotice && (
        <div style={{ padding: '12px 16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', color: '#15803D', fontWeight: 600, marginBottom: '20px' }}>
          {payNotice}
        </div>
      )}

      {/* TrustPay Escrow Tracker */}
      <TrustPayTracker
        bookingId={bookingId}
        setBookingId={(id) => {
          setBookingId(id);
          if (id) {
            setSearchParams({ booking_id: id });
            if (context.setSelectedBookingId) context.setSelectedBookingId(id);
          }
        }}
        booking={booking}
        setBooking={setBooking}
        currentUser={currentUser}
      />
    </div>
  );
}

