import React, { useState, useEffect } from 'react';
import { getOperatorReviewQueue, reviewArtistSubmission } from '../api';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import PaisleyBorder from './folk/PaisleyBorder';

export default function OperatorReviewQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Rejection modal/reason state
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const data = await getOperatorReviewQueue();
      setQueue(data);
    } catch (err) {
      setError(err.message || 'Failed to load operator review queue');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(artistId, artistName) {
    setProcessing(true);
    setError(null);
    setActionNotice(null);

    try {
      const res = await reviewArtistSubmission(artistId, 'approve', 'Audition video and live challenge verified by operator.');
      setActionNotice(`✓ Success: Artist "${artistName}" approved! Listing is now LIVE.`);
      await loadQueue();
    } catch (err) {
      setError(err.message || 'Failed to approve artist');
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirmReject() {
    if (!rejectingId) return;
    setProcessing(true);
    setError(null);

    try {
      await reviewArtistSubmission(rejectingId, 'reject', rejectReason || 'Audition video needs re-recording.');
      setActionNotice('✓ Success: Artist submission rejected with feedback. Status reverted to Draft.');
      setRejectingId(null);
      setRejectReason('');
      await loadQueue();
    } catch (err) {
      setError(err.message || 'Failed to reject artist');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Card */}
      <div className="folk-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Diya size={36} animated />
            <div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', margin: 0, color: 'var(--color-dark-maroon)' }}>
                Operator Review Queue
              </h2>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
                Verify audition videos, check live challenge codes, and approve artist listings to go LIVE.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="folk-btn-secondary"
            onClick={loadQueue}
            disabled={loading}
          >
            ↻ Refresh Queue ({queue.length})
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="login-alert-banner alert-warning" role="alert" style={{ background: '#F0FDF4', color: '#166534', borderColor: '#22C55E' }}>
          <span>✓</span>
          <span>{actionNotice}</span>
        </div>
      )}

      {error && (
        <div className="login-alert-banner alert-danger" role="alert">
          <span>✖ Error:</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="folk-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <Diya size={40} animated />
          <p style={{ marginTop: '1rem', fontWeight: 600 }}>⌛ Loading pending submissions...</p>
        </div>
      ) : queue.length === 0 ? (
        <div className="folk-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>🎉</span>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: '0.75rem 0 0.25rem 0' }}>
            No Artists Pending Review
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', margin: 0 }}>
            All artist submissions have been verified and processed.
          </p>
        </div>
      ) : (
        queue.map((artist) => (
          <div key={artist.id} className="folk-card" style={{ padding: '1.75rem' }}>
            {/* Artist Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.75rem', margin: 0, color: 'var(--color-dark-maroon)' }}>
                  {artist.name}
                </h3>
                <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0.25rem 0' }}>
                  🪕 {artist.art_form} • 📍 {artist.city}, {artist.state}
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 }}>
                  {artist.bio}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                <span
                  style={{
                    background: '#FEF3C7',
                    border: '1.5px solid #F59E0B',
                    borderRadius: '20px',
                    padding: '0.3rem 0.85rem',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: '#92400E',
                  }}
                >
                  ⌛ PENDING REVIEW
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                  Fee: ₹{artist.min_fee.toLocaleString('en-IN')} • Range: {artist.travel_range_km} km
                </span>
              </div>
            </div>

            <PaisleyBorder height={12} />

            {/* Video Player & Verification Area */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
              {/* Left Column: Embedded Video Player */}
              <div>
                <label style={{ fontWeight: 700, fontSize: '1rem', display: 'block', marginBottom: '0.5rem' }}>
                  Audition Performance Video (.mp4)
                </label>
                {artist.video_urls && artist.video_urls.length > 0 ? (
                  <div style={{ background: '#000000', borderRadius: '8px', overflow: 'hidden' }}>
                    <video
                      controls
                      style={{ width: '100%', maxHeight: '280px', display: 'block' }}
                      src={artist.video_urls[0]}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                ) : (
                  <div style={{ background: '#FEE2E2', padding: '1rem', borderRadius: '8px', color: 'var(--color-vermilion)' }}>
                    ⚠ No audition video attached.
                  </div>
                )}
              </div>

              {/* Right Column: Live Code Verification & Coordinator Vouches */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Live Code Challenge Box */}
                <div style={{ background: '#FFFDF0', border: '2px solid var(--color-amber-gold)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-dark-maroon)' }}>
                    ★ Expected Live Challenge Phrase
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-vermilion)', margin: '0.35rem 0' }}>
                    "{artist.live_prompt_phrase || 'Code not recorded'}"
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    Listen for this exact phrase recited clearly at the beginning of the video to confirm identity.
                  </p>
                </div>

                {/* Coordinator Vouches Summary */}
                <div style={{ background: '#FFFFFF', border: '1.5px solid var(--color-border-subtle)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-dark-maroon)' }}>
                    📜 Coordinator Vouches ({artist.vouches ? artist.vouches.length : 0})
                  </div>
                  {artist.vouches && artist.vouches.length > 0 ? (
                    <ul style={{ margin: '0.35rem 0 0 0', paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                      {artist.vouches.map((v, idx) => (
                        <li key={idx}>"{v.notes}"</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0' }}>
                      No coordinator vouches yet. (Will be placed in VIDEO_REVIEWED tier upon approval).
                    </p>
                  )}
                </div>

                {/* Operator Actions */}
                <div style={{ display: 'flex', gap: '0.85rem', marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="folk-btn-primary"
                    style={{ flex: 1, minHeight: '44px' }}
                    onClick={() => handleApprove(artist.id, artist.name)}
                    disabled={processing}
                  >
                    <Ghungroo size={16} /> Approve (Make LIVE)
                  </button>

                  <button
                    type="button"
                    className="folk-btn-secondary"
                    style={{ flex: 1, minHeight: '44px', borderColor: 'var(--color-vermilion)', color: 'var(--color-vermilion)' }}
                    onClick={() => setRejectingId(artist.id)}
                    disabled={processing}
                  >
                    ✕ Reject (Request Re-upload)
                  </button>
                </div>
              </div>
            </div>

            {/* Rejection Modal / Prompt */}
            {rejectingId === artist.id && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '1.25rem',
                  background: '#FEF2F2',
                  border: '2px solid var(--color-vermilion)',
                  borderRadius: '8px',
                }}
              >
                <label htmlFor="reject-reason" style={{ fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                  Reason for Rejection (Feedback for Artist) *
                </label>
                <textarea
                  id="reject-reason"
                  className="folk-input"
                  style={{ minHeight: '80px', marginBottom: '0.75rem' }}
                  placeholder="e.g. Audio was muffled, or the live challenge phrase was missing from the video..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="folk-btn-secondary"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="folk-btn-primary"
                    onClick={handleConfirmReject}
                    disabled={processing || !rejectReason}
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
