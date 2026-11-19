import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { artistApprove, artistDecline } from '../../api';
import { JaaliDivider } from '../../components/shared/CulturalMotifs';
import { ErrorBanner } from '../../components/shared/States';

export default function ArtistHome() {
  const navigate = useNavigate();
  const { lang, profile, artistId, myOffers, reloadArtistData } = useOutletContext() || {};

  const [actionNotice, setActionNotice] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const pendingOffers = (myOffers || []).filter((b) => {
    const isApproved = b.artist_approvals?.[artistId] === 'APPROVED';
    const isDeclined = b.artist_approvals?.[artistId] === 'DECLINED';
    return !isApproved && !isDeclined && b.status === 'AWAITING_ARTIST_APPROVAL';
  });

  const confirmedShows = (myOffers || []).filter((b) => {
    return b.artist_approvals?.[artistId] === 'APPROVED' || b.status === 'PAID' || b.status === 'ESCROW_HELD';
  });

  async function handleApprove(bookingId) {
    setLoadingId(bookingId);
    setError(null);
    setActionNotice(null);
    try {
      await artistApprove(bookingId, artistId);
      setActionNotice(lang === 'hi' ? '✓ आपने प्रस्ताव स्वीकार कर लिया है! मानदेय सुरक्षित है।' : '✓ Offer Approved! Honorarium is secured in TrustPay.');
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Approval failed');
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDecline(bookingId) {
    setLoadingId(bookingId);
    setError(null);
    setActionNotice(null);
    try {
      await artistDecline(bookingId, artistId);
      setActionNotice(lang === 'hi' ? 'आपने प्रस्ताव अस्वीकार कर दिया।' : 'You declined this offer.');
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Decline failed');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      {/* Welcome Card with Big Friendly Greetings */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '2px solid #FDBA74',
          borderRadius: '18px',
          padding: '24px 20px',
          boxShadow: '0 4px 14px rgba(194, 65, 12, 0.08)',
          marginBottom: '22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: '#DCFCE7',
              color: '#15803D',
              fontSize: '13px',
              fontWeight: 800,
            }}
          >
            ✓ {profile?.verification_status === 'VERIFIED' || profile?.reliability_tier
              ? lang === 'hi' ? 'प्रमाणित लोक कलाकार' : 'Verified Heritage Master'
              : lang === 'hi' ? 'सक्रिय कलाकार' : 'Active Folk Troupe'}
          </span>
          <span style={{ fontSize: '20px' }}>🪕</span>
        </div>

        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0' }}>
          {lang === 'hi' ? `नमस्ते, ${profile?.name || 'कलाकार साथी'}!` : `Welcome, ${profile?.name || 'Artist Friend'}!`}
        </h1>
        <p style={{ fontSize: '15.5px', color: '#525866', margin: 0, lineHeight: 1.5 }}>
          {lang === 'hi'
            ? 'धरोहर पर आपका स्वागत है। यहाँ आपको सीधे आयोजकों से उचित मानदेय मिलता है।'
            : 'Welcome to Dharohar. Receive direct event bookings and guaranteed fair honorarium.'}
        </p>
      </div>

      {error && <ErrorBanner title={lang === 'hi' ? 'सूचना' : 'Notice'} message={error} />}
      {actionNotice && (
        <div style={{ padding: '14px 18px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', color: '#15803D', fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>
          {actionNotice}
        </div>
      )}

      {/* Quick Summary Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
        <div
          onClick={() => navigate('/artist/offers')}
          style={{
            backgroundColor: '#FFF7ED',
            border: '2px solid #FFEDD5',
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#C2410C', lineHeight: 1 }}>
            {pendingOffers.length}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#9A3412', marginTop: '6px' }}>
            {lang === 'hi' ? 'नए प्रस्ताव' : 'Pending Offers'}
          </div>
        </div>

        <div
          onClick={() => navigate('/artist/calendar')}
          style={{
            backgroundColor: '#F0FDF4',
            border: '2px solid #DCFCE7',
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#15803D', lineHeight: 1 }}>
            {confirmedShows.length}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#166534', marginTop: '6px' }}>
            {lang === 'hi' ? 'पक्के कार्यक्रम' : 'Confirmed Shows'}
          </div>
        </div>
      </div>

      {/* Today's Offers Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#141B2D', margin: 0 }}>
            {lang === 'hi' ? "आज के नए प्रस्ताव (Today's Offers)" : "Today's Pending Offers"}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/artist/offers')}
            style={{ border: 'none', background: 'transparent', color: '#C2410C', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
          >
            {lang === 'hi' ? 'सभी देखें →' : 'See All →'}
          </button>
        </div>

        {pendingOffers.length === 0 ? (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #E5E7EB',
              borderRadius: '16px',
              padding: '36px 20px',
              textAlign: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}
          >
            <span style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}>🌾</span>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0' }}>
              {lang === 'hi' ? 'अभी कोई नया प्रस्ताव नहीं है' : 'No New Offers Today'}
            </h3>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              {lang === 'hi'
                ? 'जैसे ही कोई आयोजक आपकी कला के लिए अनुरोध भेजेगा, वह यहाँ दिखाई देगा।'
                : 'New booking requests from organizers will appear right here with instant approval options.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pendingOffers.map((offer) => {
              // Find role info for this artist
              const roleMatch = offer.negotiated_roles
                ? Object.entries(offer.negotiated_roles).find(([_, r]) => r.artist_id === artistId)
                : null;
              const rolePrice = roleMatch ? roleMatch[1].price / 100 : (offer.budget_paise ? offer.budget_paise / 100 : offer.budget) || 12000;

              return (
                <div
                  key={offer.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '2.5px solid #F59E0B',
                    borderRadius: '18px',
                    padding: '20px',
                    boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#B45309', textTransform: 'uppercase' }}>
                        {offer.art_form_requested || 'Folk Show'}
                      </span>
                      <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#141B2D', margin: '2px 0 0' }}>
                        {offer.organizer_name || 'होटल / आयोजक (Patron)'}
                      </h3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>
                        {lang === 'hi' ? 'मानदेय' : 'Honorarium'}
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803D' }}>
                        ₹{rolePrice.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', fontSize: '14.5px', color: '#4B5563', marginBottom: '18px', flexWrap: 'wrap' }}>
                    <span>📅 <strong>{offer.event_date || 'TBD'}</strong></span>
                    <span>⏰ {offer.event_time || '18:00'}</span>
                    <span>⏳ {offer.expected_duration_minutes || 60} mins</span>
                  </div>

                  {/* Big Touch Action Buttons (>= 50px height) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => handleApprove(offer.id)}
                      disabled={loadingId === offer.id}
                      style={{
                        height: '52px',
                        backgroundColor: '#15803D',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '16.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(21, 128, 61, 0.25)',
                      }}
                    >
                      {loadingId === offer.id ? '...' : lang === 'hi' ? '✓ स्वीकार करें' : '✓ Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecline(offer.id)}
                      disabled={loadingId === offer.id}
                      style={{
                        height: '52px',
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        border: '1.5px solid #FCA5A5',
                        borderRadius: '12px',
                        fontSize: '16.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {lang === 'hi' ? '✕ अस्वीकार' : '✕ Decline'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <JaaliDivider />

      {/* Quick Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <button
          type="button"
          onClick={() => navigate('/artist/rules')}
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #E5E7EB',
            borderRadius: '14px',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>⚙️</span>
          <strong style={{ fontSize: '15px', color: '#141B2D', display: 'block' }}>
            {lang === 'hi' ? 'मेरे नियम' : 'My Rules'}
          </strong>
          <span style={{ fontSize: '12.5px', color: '#6B7280' }}>
            {lang === 'hi' ? 'न्यूनतम मानदेय व दूरी' : 'Minimum fee & range'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/artist/earnings')}
          style={{
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1.5px solid #E5E7EB',
            borderRadius: '14px',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '24px', display: 'block', marginBottom: '4px' }}>💰</span>
          <strong style={{ fontSize: '15px', color: '#141B2D', display: 'block' }}>
            {lang === 'hi' ? 'कमाई खाता' : 'Earnings Ledger'}
          </strong>
          <span style={{ fontSize: '12.5px', color: '#6B7280' }}>
            {lang === 'hi' ? 'एस्क्रो व भुगतान रसीद' : 'Escrow & payouts'}
          </span>
        </button>
      </div>
    </div>
  );
}

