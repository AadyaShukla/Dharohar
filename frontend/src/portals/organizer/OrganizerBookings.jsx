import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getBookings } from '../../api';
import StatusBadge from '../../components/shared/StatusBadge';
import { SkeletonTable, EmptyState, ErrorBanner } from '../../components/shared/States';
import BookingTimeline from '../../components/BookingTimeline';

export default function OrganizerBookings() {
  const navigate = useNavigate();
  const context = useOutletContext() || {};

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    setLoading(true);
    setError(null);
    try {
      const data = await getBookings();
      setBookings(data || []);
      if (data && data.length > 0 && !expandedId) {
        setExpandedId(data[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            My Folk Performance Bookings
          </h1>
          <p style={{ fontSize: '15px', color: '#525866', margin: 0 }}>
            Track stage progression, negotiation agreements, and TrustPay escrow release milestones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/organizer/search')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#C2410C',
            color: '#FFFFFF',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Create New Booking
        </button>
      </div>

      {error && <ErrorBanner title="Bookings Error" message={error} onRetry={loadBookings} />}

      {/* Crucial Organizer Notice */}
      <div
        style={{
          backgroundColor: '#EFF6FF',
          border: '1.5px solid #BFDBFE',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}
      >
        <span style={{ fontSize: '24px' }}>🛡️</span>
        <div>
          <strong style={{ fontSize: '15px', color: '#1E40AF' }}>Patron &amp; Artist Privacy Shield Active:</strong>
          <span style={{ fontSize: '14px', color: '#1E3A8A', display: 'block', marginTop: '2px' }}>
            Venue street address, contact phone numbers, and organizer contact details are <strong>strictly hidden from artists</strong> until payment is confirmed into TrustPay escrow.
          </span>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={5} />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No Bookings Placed Yet"
          description="Browse verified folk performers and start an AI negotiation with village master artists."
          actionLabel="Find Folk Artists"
          onAction={() => navigate('/organizer/search')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {bookings.map((booking) => {
            const isExpanded = expandedId === booking.id;
            const budgetAmt = (booking.budget_paise ? booking.budget_paise / 100 : booking.budget) || 0;
            const isPaid = booking.status === 'PAID' || booking.status === 'ESCROW_HELD' || booking.status === 'PERFORMANCE_CONFIRMED' || booking.status === 'SETTLED';

            return (
              <div
                key={booking.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                {/* Header row */}
                <div
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    backgroundColor: isExpanded ? '#FAF8F4' : '#FFFFFF',
                    borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '24px' }}>🪕</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D' }}>
                          {booking.art_form_requested || 'Folk Performance'}
                        </span>
                        <span style={{ fontSize: '13px', fontFamily: 'monospace', color: '#6B7280' }}>
                          #{booking.id.slice(0, 10)}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', color: '#525866', marginTop: '4px' }}>
                        📅 {booking.event_date || 'Date TBD'} at {booking.event_time || '18:00'} • ⏳ {booking.expected_duration_minutes || 60} mins • 👥 {booking.group_size || 6} artists
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Agreed Budget</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#141B2D' }}>
                        ₹{budgetAmt.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <StatusBadge status={booking.status} />

                    <span style={{ fontSize: '18px', color: '#9CA3AF' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details & Timeline */}
                {isExpanded && (
                  <div style={{ padding: '24px 28px' }}>
                    {/* Venue Privacy Tag */}
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: isPaid ? '#F0FDF4' : '#FFFBEB',
                        border: `1px solid ${isPaid ? '#BBF7D0' : '#FDE68A'}`,
                        fontSize: '13.5px',
                        color: isPaid ? '#15803D' : '#92400E',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span>{isPaid ? '✓' : '🔒'}</span>
                      <span>
                        <strong>Venue Status:</strong>{' '}
                        {isPaid
                          ? `Visible to confirmed artists: ${booking.venue_address || 'City Palace Courtyard, Udaipur'}`
                          : 'Hidden from artists until TrustPay escrow payment is completed.'}
                      </span>
                    </div>

                    {/* Timeline Component */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Milestone Progression Track
                      </div>
                      <BookingTimeline booking={booking} />
                    </div>

                    {/* Quick Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #F3F4F6', paddingTop: '16px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (context.setSelectedBookingId) context.setSelectedBookingId(booking.id);
                          navigate(`/organizer/negotiate?booking_id=${booking.id}`);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#FAF8F4',
                          color: '#C2410C',
                          border: '1px solid #FFEDD5',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        💬 View Negotiation
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (context.setSelectedBookingId) context.setSelectedBookingId(booking.id);
                          navigate(`/organizer/payment?booking_id=${booking.id}`);
                        }}
                        style={{
                          padding: '8px 18px',
                          backgroundColor: '#C2410C',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        💳 Pay (Simulated)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (context.setSelectedBookingId) context.setSelectedBookingId(booking.id);
                          navigate(`/organizer/audit?booking_id=${booking.id}`);
                        }}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#EFF6FF',
                          color: '#1E3A8A',
                          border: '1px solid #BFDBFE',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        🛡️ View Audit Trail
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

