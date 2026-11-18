import React, { useState, useEffect } from 'react';
import { getBooking, getArtists, artistApprove, artistDecline } from '../api';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import PaisleyBorder from './folk/PaisleyBorder';

export default function ArtistApprovalPanel({ bookingId, booking, setBooking, currentUser }) {
  const [artistsMap, setArtistsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

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
    setTimeout(() => setToast(null), 3000);
  }

  async function handleApprove(artistId) {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    setActionNotice(null);
    try {
      const res = await artistApprove(bookingId, artistId);
      setActionNotice(`✓ Approval recorded for ${artistId}. Booking status is now ${res.booking_status}.`);
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

  // Extract artists from negotiated roles
  const negotiatedRoles = booking?.negotiated_roles || {};
  const approvals = booking?.artist_approvals || {};

  // Build list of artists in booking
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

  // Role filter: ARTIST sees ONLY their own offers
  const isArtistUser = currentUser?.role === 'ARTIST';
  const artistList = isArtistUser
    ? allArtistsInBooking.filter((item) => item.artistId === currentUser.artist_id)
    : allArtistsInBooking;

  if (!bookingId) {
    return (
      <div className="tab-placeholder">
        <Diya size={48} />
        <h2 style={{ marginTop: '0.75rem' }}>No Active Booking Selected</h2>
        <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
          {currentUser?.role === 'ORGANIZER'
            ? 'Please go to the Organizer Chat tab to create or negotiate an event request.'
            : 'No active booking is currently selected for your artist profile.'}
        </p>
      </div>
    );
  }

  return (
    <div className="whatsapp-panel-container">
      {/* Toast Notification */}
      {toast && <div className="whatsapp-toast">{toast}</div>}

      {/* Header Bar */}
      <div className="whatsapp-header">
        <div className="whatsapp-header-left">
          <div className="whatsapp-avatar">🪕</div>
          <div className="whatsapp-meta">
            <h3>Dharohar Artist Community Desk</h3>
            <span className="online-badge">
              Online • {isArtistUser ? `Logged in: ${currentUser.name}` : 'Community Channel'}
            </span>
          </div>
        </div>

        <div className="whatsapp-header-right">
          <span className="booking-ref-badge">Booking: #{bookingId}</span>
          <span className={`booking-status-tag tag-${booking?.status?.toLowerCase() || 'none'}`}>
            {booking?.status || 'AWAITING_ARTIST_APPROVAL'}
          </span>
        </div>
      </div>

      {/* Mandatory Notice */}
      <div className="whatsapp-approval-banner">
        ⚠️ <strong>Note:</strong> Booking is confirmed only when every artist approves. Final acceptance is a human action.
      </div>

      {error && (
        <div className="error-banner" style={{ margin: '0.75rem 1rem' }} role="alert">
          <strong>Backend Error: </strong> {error}
        </div>
      )}

      {actionNotice && (
        <div
          className="action-notice"
          style={{
            margin: '0.5rem 1rem',
            padding: '0.75rem 1rem',
            background: '#ecfdf5',
            color: '#065f46',
            borderRadius: 8,
            fontWeight: 600,
          }}
        >
          {actionNotice}
        </div>
      )}

      {/* Approval Status Tracker Card */}
      <div className="approval-status-tracker">
        <h4>{isArtistUser ? 'Your Offer Status' : 'Artist Approval Checklist'}</h4>
        <div className="checklist-items">
          {artistList.length === 0 ? (
            <p style={{ fontSize: '1rem', color: '#6b7280' }}>
              {isArtistUser
                ? `No pending offers for your artist profile (${currentUser?.artist_id}) in booking #${bookingId}.`
                : 'No artists assigned yet. Run negotiation in Organizer Chat to propose artists.'}
            </p>
          ) : (
            artistList.map((item) => (
              <div key={item.artistId} className="checklist-row">
                <span className="artist-name-role">
                  <strong>{item.artist.name}</strong> ({item.roleName})
                </span>
                {item.approved ? (
                  <span className="badge-approved-done">✓ Approved</span>
                ) : (
                  <span className="badge-pending-wait">⏳ Pending Your Approval</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ padding: '0 1rem' }}>
        <PaisleyBorder height={18} />
      </div>

      {/* WhatsApp Chat Bubbles Stream */}
      <div className="whatsapp-chat-stream">
        {artistList.map((item) => {
          const isHindi =
            (item.artist.languages || []).some((l) =>
              ['hindi', 'rajasthani', 'mewari', 'marwari'].includes(l.toLowerCase())
            ) || true;

          const offerMessage = isHindi
            ? `नमस्ते ${item.artist.name} जी! "${booking?.organizer_name || 'आयोजक'}" द्वारा दिनांक ${booking?.event_date || 'निर्धारित तिथि'} को "${item.roleName}" प्रस्तुति के लिए ₹${item.price?.toLocaleString('en-IN') || item.artist.min_fee} का प्रस्ताव भेजा गया है (अवधि: ${booking?.duration_minutes || 60} मिनट)। क्या आप इस कार्यक्रम के लिए स्वीकृति देते हैं?`
            : `Hello ${item.artist.name}! You have received a booking proposal from "${booking?.organizer_name || 'Organizer'}" for ${item.roleName} on ${booking?.event_date || 'Date'} at ₹${item.price?.toLocaleString('en-IN') || item.artist.min_fee} (Duration: ${booking?.duration_minutes || 60} mins). Do you approve this booking?`;

          return (
            <div key={item.artistId} className="whatsapp-bubble-wrapper">
              <div className="whatsapp-chat-bubble">
                <div className="whatsapp-sender-label">Dharohar Booking Notification</div>

                <div className="whatsapp-message-body">{offerMessage}</div>

                {/* Voice Note Simulation Row */}
                <div className="voice-note-row">
                  <button
                    type="button"
                    className="btn-play-voice"
                    onClick={() =>
                      showToast(
                        `▶ Playing simulated voice note (${isHindi ? 'Hindi' : 'English'}) for ${item.artist.name}...`
                      )
                    }
                  >
                    ▶
                  </button>
                  <div className="voice-note-track">
                    <span className="voice-wave"></span>
                    <span className="voice-wave tall"></span>
                    <span className="voice-wave short"></span>
                    <span className="voice-wave tall"></span>
                    <span className="voice-wave"></span>
                  </div>
                  <span className="voice-note-label">Voice note (simulated) • 0:14</span>
                </div>

                {/* Human Action Buttons */}
                <div className="whatsapp-action-buttons">
                  <button
                    type="button"
                    className="btn-wa-approve"
                    disabled={item.approved || loading}
                    onClick={() => handleApprove(item.artistId)}
                  >
                    <Ghungroo size={14} /> {item.approved ? '✓ Approved' : 'Approve Offer'}
                  </button>
                  <button
                    type="button"
                    className="btn-wa-decline"
                    disabled={loading}
                    onClick={() => handleDecline(item.artistId)}
                  >
                    Decline
                  </button>
                </div>

                <div className="whatsapp-timestamp">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
