import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { artistAcknowledge, nonReceiptClaim } from '../../api';
import { ErrorBanner, EmptyState } from '../../components/shared/States';

export default function ArtistEarnings() {
  const navigate = useNavigate();
  const { lang, artistId, myOffers, reloadArtistData } = useOutletContext() || {};

  const [loadingId, setLoadingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  // Compute earnings metrics
  let totalEarned = 0;
  let inEscrow = 0;
  let settled = 0;

  (myOffers || []).forEach((b) => {
    const roleMatch = b.negotiated_roles
      ? Object.entries(b.negotiated_roles).find(([_, r]) => r.artist_id === artistId)
      : null;
    const price = roleMatch ? roleMatch[1].price / 100 : (b.budget_paise ? b.budget_paise / 100 : b.budget) || 12000;

    if (b.status === 'SETTLED' || b.status === 'FUNDS_RELEASED') {
      settled += price;
      totalEarned += price;
    } else if (b.status === 'PAID' || b.status === 'ESCROW_HELD' || b.status === 'PERFORMANCE_CONFIRMED') {
      inEscrow += price;
      totalEarned += price;
    }
  });

  async function handleAcknowledge(bookingId) {
    setLoadingId(bookingId);
    setNotice(null);
    setError(null);
    try {
      await artistAcknowledge(bookingId, true);
      setNotice(lang === 'hi' ? '✓ भुगतान प्राप्ति की पुष्टि कर दी गई है! धन्यवाद।' : '✓ Payout acknowledged successfully! Thank you.');
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Failed to acknowledge payout');
    } finally {
      setLoadingId(null);
    }
  }

  async function handleNotReceived(bookingId) {
    setLoadingId(bookingId);
    setNotice(null);
    setError(null);
    try {
      await nonReceiptClaim(bookingId);
      setNotice(lang === 'hi' ? '⚠️ भुगतान न मिलने की सूचना ऑपरेटर को भेज दी गई है।' : '⚠️ Non-receipt claim submitted to platform operator for investigation.');
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Failed to submit non-receipt claim');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 4px 0' }}>
            {lang === 'hi' ? 'कमाई एवं भुगतान खाता (Earnings)' : 'Earnings & Payout Ledger'}
          </h1>
          <p style={{ fontSize: '14.5px', color: '#525866', margin: 0 }}>
            {lang === 'hi'
              ? 'एस्क्रो में सुरक्षित मानदेय और बैंक खाते में प्राप्त राशि का विवरण।'
              : 'Direct bank transfers, TrustPay escrow reserves, and receipt confirmations.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/artist/statement')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#FAF8F4',
            color: '#C2410C',
            border: '1.5px solid #FFEDD5',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
          }}
        >
          📄 {lang === 'hi' ? 'स्टेटमेंट डाउनलोड' : 'Download Statement'}
        </button>
      </div>

      {error && <ErrorBanner title={lang === 'hi' ? 'त्रुटि' : 'Error'} message={error} />}
      {notice && (
        <div style={{ padding: '14px 18px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', color: '#15803D', fontWeight: 700, fontSize: '15.5px', marginBottom: '20px' }}>
          {notice}
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#F0FDF4', border: '2px solid #DCFCE7', borderRadius: '16px', padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
            {lang === 'hi' ? 'खाते में प्राप्त' : 'Settled Payouts'}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#15803D', marginTop: '4px' }}>
            ₹{settled.toLocaleString('en-IN')}
          </div>
        </div>

        <div style={{ backgroundColor: '#FEF3C7', border: '2px solid #FDE68A', borderRadius: '16px', padding: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>
            {lang === 'hi' ? 'एस्क्रो में सुरक्षित' : 'Locked in Escrow'}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#B45309', marginTop: '4px' }}>
            ₹{inEscrow.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Payouts List */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', marginBottom: '14px' }}>
          {lang === 'hi' ? 'हाल के कार्यक्रम एवं भुगतान स्थितियां' : 'Recent Bookings & Payout Confirmations'}
        </h2>

        {(myOffers || []).length === 0 ? (
          <EmptyState
            title={lang === 'hi' ? 'अभी कोई भुगतान लेनदेन नहीं है' : 'No Payout Records Yet'}
            description={
              lang === 'hi'
                ? 'जैसे ही आपके स्वीकृत कार्यक्रमों का भुगतान होगा, वे यहाँ दर्ज होंगे।'
                : 'Completed and escrow-funded shows will appear here with one-click payout acknowledgment.'
            }
            icon="💰"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(myOffers || []).map((booking) => {
              const roleMatch = booking.negotiated_roles
                ? Object.entries(booking.negotiated_roles).find(([_, r]) => r.artist_id === artistId)
                : null;
              const price = roleMatch ? roleMatch[1].price / 100 : (booking.budget_paise ? booking.budget_paise / 100 : booking.budget) || 12000;
              const isSettled = booking.status === 'SETTLED';
              const isEscrow = booking.status === 'ESCROW_HELD' || booking.status === 'PAID';

              return (
                <div
                  key={booking.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', margin: 0 }}>
                        {booking.art_form_requested || 'Folk Performance'}
                      </h3>
                      <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>
                        {booking.organizer_name} • 📅 {booking.event_date || 'Date TBD'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803D' }}>
                        ₹{price.toLocaleString('en-IN')}
                      </div>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSettled ? '#DCFCE7' : isEscrow ? '#FEF3C7' : '#F3F4F6',
                          color: isSettled ? '#15803D' : isEscrow ? '#92400E' : '#4B5563',
                        }}
                      >
                        {booking.status}
                      </span>
                    </div>
                  </div>

                  {/* Acknowledge & Not Received Buttons */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '16px', marginTop: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>
                      {lang === 'hi' ? 'भुगतान रसीद कार्रवाई (Payout Action):' : 'Confirm Payout Receipt:'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(booking.id)}
                        disabled={loadingId === booking.id}
                        style={{
                          height: '48px',
                          backgroundColor: '#15803D',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '14.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        ✓ {lang === 'hi' ? 'भुगतान प्राप्त हुआ (Acknowledge)' : 'Acknowledge Receipt'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNotReceived(booking.id)}
                        disabled={loadingId === booking.id}
                        style={{
                          height: '48px',
                          backgroundColor: '#FEF2F2',
                          color: '#DC2626',
                          border: '1.5px solid #FCA5A5',
                          borderRadius: '10px',
                          fontSize: '14px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✕ {lang === 'hi' ? 'नहीं मिला (Not Received)' : 'Not Received'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

