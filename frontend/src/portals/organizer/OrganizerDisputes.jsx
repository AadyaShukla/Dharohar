import React, { useState, useEffect } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { nonReceiptClaim, getTrustPay, getBooking } from '../../api';
import { ErrorBanner } from '../../components/shared/States';
import StatusBadge from '../../components/shared/StatusBadge';
import { JaaliDivider } from '../../components/shared/CulturalMotifs';

export default function OrganizerDisputes() {
  const [searchParams] = useSearchParams();
  const context = useOutletContext() || {};

  const bookingId = searchParams.get('booking_id') || context.selectedBookingId || '';
  const [booking, setBooking] = useState(null);
  const [trustpay, setTrustpay] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [claimNotice, setClaimNotice] = useState(null);

  // Rating State
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    if (bookingId) {
      loadBookingData(bookingId);
    }
  }, [bookingId]);

  async function loadBookingData(id) {
    setLoading(true);
    setError(null);
    try {
      const [b, tp] = await Promise.all([
        getBooking(id).catch(() => null),
        getTrustPay(id).catch(() => null),
      ]);
      setBooking(b);
      setTrustpay(tp);
    } catch (err) {
      setError(err.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenDispute() {
    if (!bookingId) return;
    setLoading(true);
    setClaimNotice(null);
    try {
      const res = await nonReceiptClaim(bookingId);
      setClaimNotice(res.message || 'Non-receipt claim submitted. Platform Operator is reviewing the dispute.');
      await loadBookingData(bookingId);
    } catch (err) {
      setError(err.message || 'Failed to submit claim');
    } finally {
      setLoading(false);
    }
  }

  function handleRateSubmit(e) {
    e.preventDefault();
    setRatingSubmitted(true);
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          Disputes &amp; Artist Ratings
        </h1>
        <p style={{ fontSize: '15px', color: '#525866', margin: 0 }}>
          Manage escrow performance concerns, file claims under TrustPay protection, and rate verified folk performers.
        </p>
      </div>

      {error && <ErrorBanner title="Dispute Portal Notice" message={error} onRetry={() => loadBookingData(bookingId)} />}
      {claimNotice && (
        <div style={{ padding: '14px 18px', backgroundColor: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: '10px', color: '#991B1B', fontWeight: 600, marginBottom: '20px' }}>
          ⚠️ {claimNotice}
        </div>
      )}

      {/* Booking Context */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '24px', marginBottom: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#C2410C', textTransform: 'uppercase' }}>Active Booking</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#141B2D', marginTop: '2px' }}>
              {booking ? `${booking.art_form_requested || 'Folk Show'} (#${booking.id.slice(0, 10)})` : 'No Booking Selected'}
            </div>
            {booking && (
              <div style={{ fontSize: '14px', color: '#525866', marginTop: '4px' }}>
                Date: {booking.event_date || 'TBD'} • Agreed Budget: ₹{((booking.budget_paise ? booking.budget_paise / 100 : booking.budget) || 0).toLocaleString('en-IN')}
              </div>
            )}
          </div>

          {booking && <StatusBadge status={booking.status} />}
        </div>
      </div>

      {/* Dispute Section */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '28px', marginBottom: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '24px' }}>⚖️</span>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#141B2D', margin: 0 }}>
            File a Performance Concern or Non-Receipt Claim
          </h2>
        </div>
        <p style={{ fontSize: '15px', color: '#525866', lineHeight: 1.6, marginBottom: '20px' }}>
          If an artist failed to arrive, performed significantly below agreed duration, or if a discrepancy occurred, you can file a non-receipt claim. TrustPay escrow funds will remain locked until our human cultural coordinator reviews the case.
        </p>

        <button
          type="button"
          onClick={handleOpenDispute}
          disabled={loading || !bookingId}
          style={{
            padding: '12px 24px',
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: loading || !bookingId ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Submitting...' : '⚠️ File Non-Receipt Claim'}
        </button>
      </div>

      <JaaliDivider />

      {/* Rating & Review Section */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '24px' }}>⭐</span>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#141B2D', margin: 0 }}>
            Rate Artist &amp; Provide Cultural Feedback
          </h2>
        </div>
        <p style={{ fontSize: '15px', color: '#525866', lineHeight: 1.6, marginBottom: '20px' }}>
          Your verified reviews help master folk artists maintain their <strong>Tier 1 Heritage Reliability</strong> rating and receive fair patronage across India.
        </p>

        {ratingSubmitted ? (
          <div style={{ padding: '16px 20px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '10px', color: '#14532D' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>✓ Review Submitted Successfully!</h4>
            <p style={{ margin: 0, fontSize: '14.5px' }}>
              Thank you for supporting authentic folk traditions and keeping the money in the village.
            </p>
          </div>
        ) : (
          <form onSubmit={handleRateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '8px' }}>
                Overall Performance Experience
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: '32px',
                      cursor: 'pointer',
                      color: star <= rating ? '#F59E0B' : '#D1D5DB',
                      transition: 'transform 0.1s ease',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: '8px' }}>
                Patron Testimonial
              </label>
              <textarea
                rows={4}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Describe the punctuality, traditional authenticity, and audience response..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #D1D5DB',
                  fontSize: '15px',
                  fontFamily: 'inherit',
                  backgroundColor: '#FAF8F4',
                }}
                required
              />
            </div>

            <button
              type="submit"
              style={{
                alignSelf: 'flex-start',
                padding: '12px 28px',
                backgroundColor: '#C2410C',
                color: '#FFFFFF',
                borderRadius: '8px',
                border: 'none',
                fontSize: '15.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Submit Verified Rating
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

