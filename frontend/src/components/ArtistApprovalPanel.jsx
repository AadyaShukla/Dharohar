import React, { useState, useEffect } from 'react';
import { getBooking, getArtists, artistApprove, artistDecline } from '../api';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import TextileBorder from './heritage/TextileBorder';
import HeritageDivider from './heritage/HeritageDivider';
import CulturalMotif from './heritage/CulturalMotif';

export default function ArtistApprovalPanel({ bookingId, booking, setBooking, currentUser }) {
  const [artistsMap, setArtistsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [counterOpen, setCounterOpen] = useState(false);

  useEffect(() => {
    loadArtists();
  }, []);

  useEffect(() => {
    if (bookingId) {
      loadBookingDetails(bookingId);
    }
  }, [bookingId]);

  async function loadArtists() {
    try {
      const data = await getArtists();
      const map = {};
      data.forEach((a) => {
        map[a.id] = a;
      });
      setArtistsMap(map);
    } catch (err) {
      console.error('Failed to load artists reference', err);
    }
  }

  async function loadBookingDetails(id) {
    try {
      const b = await getBooking(id);
      if (setBooking) setBooking(b);
    } catch (err) {
      setError(err.message);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleApprove(artistId) {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    setActionNotice(null);
    try {
      const res = await artistApprove(bookingId, artistId);
      setActionNotice(`✓ Formal approval recorded for ${artistId}. Booking status is now ${res.booking_status}.`);
      await loadBookingDetails(bookingId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline(artistId) {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    setActionNotice(null);
    try {
      const res = await artistDecline(bookingId, artistId);
      setActionNotice(`✕ Booking proposal declined by ${artistId}. Booking status is now ${res.booking_status}.`);
      await loadBookingDetails(bookingId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const negotiatedRoles = booking?.negotiated_roles || {};
  const approvals = booking?.artist_approvals || {};

  let allArtistsInBooking = Object.entries(negotiatedRoles)
    .filter(([_, info]) => info.artist_id)
    .map(([roleName, info]) => {
      const artist = artistsMap[info.artist_id] || {
        id: info.artist_id,
        name: info.artist_id,
        languages: ['Hindi'],
        art_form: roleName,
      };
      return {
        roleName,
        artistId: info.artist_id,
        price: info.price,
        artist,
        approved: !!approvals[info.artist_id],
      };
    });

  const isArtistUser = currentUser?.role === 'ARTIST';
  const artistList = isArtistUser
    ? allArtistsInBooking.filter((item) => item.artistId === currentUser.artist_id)
    : allArtistsInBooking;

  if (!bookingId) {
    return (
      <div
        style={{
          maxWidth: '720px',
          margin: '40px auto',
          textAlign: 'center',
          background: '#FFFDF9',
          border: '2px dashed var(--dh-border-heritage)',
          borderRadius: '16px',
          padding: '48px 24px',
        }}
      >
        <Diya size={48} animated />
        <h2 style={{ fontFamily: "'Yatra One', cursive", color: '#6B1717', margin: '14px 0 8px' }}>
          No Active Booking Invitation Selected
        </h2>
        <p style={{ color: '#6B5E4F', fontSize: '15px', margin: 0 }}>
          {currentUser?.role === 'ORGANIZER'
            ? 'Go to Organizer Chat or Demo Control Center to launch a booking negotiation.'
            : 'Select an active booking from the top navigation bar to review offers.'}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '920px',
        margin: '0 auto',
        padding: '24px 16px 48px',
        fontFamily: "'Noto Sans', sans-serif",
      }}
    >
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#1E2958',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1200,
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      {/* Header Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#FAF6EE',
          border: '1.5px solid #E8DCCB',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CulturalMotif name="sarangi" size={28} />
          <div>
            <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '18px', color: '#6B1717', margin: 0 }}>
              Dharohar Artist Community Desk
            </h3>
            <span style={{ fontSize: '12.5px', color: '#15803D', fontWeight: 600 }}>
              ● Verified Portal • {isArtistUser ? currentUser.name : 'All Troupe Offers'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#6B5E4F' }}>Booking: #{bookingId.slice(0, 10)}</span>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              background: '#FFFBEB',
              color: '#B45309',
              border: '1px solid #FDE68A',
            }}
          >
            {booking?.status || 'AWAITING_ARTIST_APPROVAL'}
          </span>
        </div>
      </div>

      {actionNotice && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1.5px solid #A7F3D0',
            color: '#065F46',
            borderRadius: '10px',
            padding: '12px 18px',
            fontWeight: 600,
            fontSize: '14px',
            marginBottom: '20px',
          }}
        >
          {actionNotice}
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1.5px solid #EF4444',
            color: '#991B1B',
            borderRadius: '10px',
            padding: '12px 18px',
            fontSize: '14px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {/* ====================================================================
          FORMAL ROYAL INVITATION SCROLL
          ==================================================================== */}
      <div className="invitation-scroll-card">
        <TextileBorder height={16} />

        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 12px' }}>
          <div className="invitation-wax-seal" title="Dharohar Wax Seal of Authenticity">
            ध
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', letterSpacing: '2px', color: '#8D5B18', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Official Booking Invitation • कलाकार आमंत्रण पत्र
          </div>
          <h2
            style={{
              fontFamily: "'Yatra One', cursive",
              fontSize: '32px',
              color: '#6B1717',
              margin: '6px 0 8px',
            }}
          >
            Cultural Performance Offer
          </h2>
          <p style={{ fontSize: '14.5px', color: '#6B5E4F', margin: 0 }}>
            Presented by <strong>{booking?.organizer_name || 'Event Organizer'}</strong> on behalf of Dharohar Living Heritage
          </p>
        </div>

        <HeritageDivider motif="lotus" color="#C69214" width="80%" />

        {/* Invitation Event Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            margin: '24px 0',
            background: '#FAF6EE',
            border: '1.5px solid #E8DCCB',
            borderRadius: '12px',
            padding: '18px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>Date &amp; Time</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1F1A14', marginTop: '2px' }}>
              📅 {booking?.event_date} at {booking?.event_time || '18:00'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>Performance Venue</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1F1A14', marginTop: '2px' }}>
              📍 {booking?.venue_address || 'City Palace Courtyard, Udaipur'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>Duration &amp; Size</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1F1A14', marginTop: '2px' }}>
              ⏱️ {booking?.duration_minutes || 60} mins • {booking?.group_size || 6} Artists
            </div>
          </div>
        </div>

        {/* Offers List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '24px 0' }}>
          {artistList.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6B5E4F', padding: '20px' }}>
              No pending role assignments for your profile in booking #{bookingId}.
            </p>
          ) : (
            artistList.map((item) => {
              const compensationInr = ((item.price || 0) / 100) || item.artist.min_fee || 12000;

              return (
                <div
                  key={item.artistId}
                  style={{
                    background: '#FFFFFF',
                    border: '2px solid #C4A482',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      borderBottom: '1px solid #E8DCCB',
                      paddingBottom: '14px',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', color: '#B45309', fontWeight: 'bold' }}>
                        ROLE: {item.roleName}
                      </div>
                      <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '22px', color: '#6B1717', margin: '2px 0 0' }}>
                        {item.artist.name}
                      </h3>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>
                        Guaranteed Compensation
                      </div>
                      <div style={{ fontFamily: "'Yatra One', cursive", fontSize: '26px', color: '#B84220' }}>
                        ₹{compensationInr.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Escrow Milestone terms note */}
                  <div
                    style={{
                      fontSize: '13px',
                      color: '#4B5563',
                      lineHeight: 1.5,
                      marginBottom: '16px',
                    }}
                  >
                    🔒 <strong>TrustPay Escrow Terms:</strong> 50% advance (₹{(compensationInr * 0.5).toLocaleString('en-IN')}) will be released to your verified bank account immediately upon event check-in; the 50% balance (₹{(compensationInr * 0.5).toLocaleString('en-IN')}) releases post-performance.
                  </div>

                  {/* Simulated Voice Note Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: '#FAF6EE',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      marginBottom: '18px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => showToast(`▶ Playing simulated voice invitation in Hindi for ${item.artist.name}...`)}
                      style={{
                        background: '#6B1717',
                        color: '#FFFFFF',
                        border: 'none',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                      }}
                    >
                      ▶
                    </button>
                    <span style={{ fontSize: '12.5px', color: '#6B5E4F' }}>
                      Simulated Voice Note (Hindi/Rajasthani) • 0:14
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={item.approved || loading}
                      onClick={() => handleApprove(item.artistId)}
                      style={{
                        flex: '1.2',
                        minWidth: '160px',
                        padding: '12px 18px',
                        fontSize: '15px',
                        fontWeight: 'bold',
                        backgroundColor: item.approved ? '#ECFDF5' : '#D97706',
                        color: item.approved ? '#15803D' : '#FFFFFF',
                        border: item.approved ? '2px solid #15803D' : '2px solid #B45309',
                        borderRadius: '8px',
                        cursor: item.approved ? 'default' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: item.approved ? 'none' : '0 4px 12px rgba(217, 119, 6, 0.3)',
                      }}
                    >
                      <Ghungroo size={16} />
                      <span>{item.approved ? '✓ Approved & Accepted' : 'Accept & Confirm Offer'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={loading || item.approved}
                      onClick={() => {
                        setCounterOpen(true);
                        showToast('To propose counter terms, please speak your voice note or submit an adjustment via WhatsApp.');
                      }}
                      style={{
                        flex: '1',
                        minWidth: '130px',
                        padding: '12px 16px',
                        fontSize: '14.5px',
                        fontWeight: 'bold',
                        backgroundColor: '#FFFFFF',
                        color: '#1E2958',
                        border: '2px solid #1E2958',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Counter Terms
                    </button>

                    <button
                      type="button"
                      disabled={loading || item.approved}
                      onClick={() => handleDecline(item.artistId)}
                      style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        backgroundColor: '#FEF2F2',
                        color: '#991B1B',
                        border: '1.5px solid #EF4444',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
