import React, { useState, useEffect } from 'react';
import { getCoordinatorArtists, submitCoordinatorVouch, getArtistVouches } from '../api';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import PaisleyBorder from './folk/PaisleyBorder';

export default function CoordinatorVouchPanel() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Vouching active form state
  const [activeArtistId, setActiveArtistId] = useState(null);
  const [vouchNotes, setVouchNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Selected artist vouches viewer
  const [viewingVouchesArtist, setViewingVouchesArtist] = useState(null);
  const [artistVouchesList, setArtistVouchesList] = useState([]);

  useEffect(() => {
    loadArtists();
  }, []);

  async function loadArtists() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCoordinatorArtists();
      setArtists(data);
    } catch (err) {
      setError(err.message || 'Failed to load artists for vouching');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitVouch(artistId) {
    if (!vouchNotes || vouchNotes.trim().length < 5) {
      setError('Please provide detailed vouching notes (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);
    setActionNotice(null);

    try {
      const res = await submitCoordinatorVouch(artistId, vouchNotes.trim());
      setActionNotice(`✓ Vouch successfully recorded! Current tier: ${res.verification_stage} (${res.total_vouches} vouches).`);
      setActiveArtistId(null);
      setVouchNotes('');
      await loadArtists();
    } catch (err) {
      setError(err.message || 'Failed to submit coordinator vouch');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleViewVouches(artist) {
    setViewingVouchesArtist(artist);
    try {
      const list = await getArtistVouches(artist.id);
      setArtistVouchesList(list);
    } catch (_) {
      setArtistVouchesList([]);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div className="folk-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Diya size={36} animated />
            <div>
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', margin: 0, color: 'var(--color-dark-maroon)' }}>
                Cultural Coordinator Vouching
              </h2>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
                Vouch for traditional folk artists based on verified in-person performances. 2 independent vouches elevate artists to the <strong>Trusted Tier</strong>.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="folk-btn-secondary"
            onClick={loadArtists}
            disabled={loading}
          >
            ↻ Refresh List ({artists.length})
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
          <p style={{ marginTop: '1rem', fontWeight: 600 }}>⌛ Loading registered artists...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {artists.map((artist) => {
            const hasMyVouch = artist.vouched_by_me;
            const vouchesCount = artist.vouches_count || 0;

            return (
              <div key={artist.id} className="folk-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', margin: 0, color: 'var(--color-dark-maroon)' }}>
                      {artist.name}
                    </h3>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-main)', margin: '0.2rem 0' }}>
                      🪕 {artist.art_form} • 📍 {artist.city}, {artist.state}
                    </p>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: 0 }}>
                      {artist.bio || 'Authentic traditional folk artist.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                    <span
                      style={{
                        background: artist.verification_stage === 'TRUSTED' ? '#FEFCE8' : '#F8FAFC',
                        border: `1.5px solid ${artist.verification_stage === 'TRUSTED' ? 'var(--color-amber-gold)' : 'var(--color-border-subtle)'}`,
                        borderRadius: '20px',
                        padding: '0.3rem 0.85rem',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: artist.verification_stage === 'TRUSTED' ? 'var(--color-dark-maroon)' : 'var(--color-text-muted)',
                      }}
                    >
                      {artist.verification_stage === 'TRUSTED' && '★ TRUSTED TIER'}
                      {artist.verification_stage === 'VIDEO_REVIEWED' && '✓ VIDEO REVIEWED'}
                      {artist.verification_stage === 'COORDINATOR_VOUCHED' && '📜 COORDINATOR VOUCHED'}
                      {artist.verification_stage === 'REGISTERED' && '⚪ REGISTERED'}
                    </span>
                    <button
                      type="button"
                      className="auth-nav-link"
                      onClick={() => handleViewVouches(artist)}
                    >
                      📜 View Vouches ({vouchesCount})
                    </button>
                  </div>
                </div>

                <PaisleyBorder height={10} />

                {/* Vouch CTA / Form */}
                {activeArtistId === artist.id ? (
                  <div style={{ marginTop: '1rem', background: '#FFFDF5', border: '2px solid var(--color-amber-gold)', borderRadius: '8px', padding: '1.25rem' }}>
                    <label htmlFor={`vouch-note-${artist.id}`} style={{ fontWeight: 700, display: 'block', marginBottom: '0.35rem' }}>
                      Coordinator Vouch Notes & Verification Context *
                    </label>
                    <textarea
                      id={`vouch-note-${artist.id}`}
                      className="folk-input"
                      style={{ minHeight: '90px', marginBottom: '0.75rem' }}
                      placeholder="e.g. I have known this troupe for 5 years and personally witnessed their authentic performance at Jodhpur RIFF festival..."
                      value={vouchNotes}
                      onChange={(e) => setVouchNotes(e.target.value)}
                      required
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="folk-btn-secondary"
                        onClick={() => {
                          setActiveArtistId(null);
                          setVouchNotes('');
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="folk-btn-primary"
                        onClick={() => handleSubmitVouch(artist.id)}
                        disabled={submitting || !vouchNotes}
                      >
                        <Ghungroo size={16} /> {submitting ? '⌛ Submitting...' : 'Confirm & Sign Vouch'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                      Min Fee: ₹{artist.min_fee.toLocaleString('en-IN')} • Rating: ⭐ {artist.rating}/5
                    </div>

                    {hasMyVouch ? (
                      <span style={{ color: 'var(--color-leaf-green)', fontWeight: 700, fontSize: '0.95rem' }}>
                        ✓ You have vouched for this artist
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="folk-btn-primary"
                        style={{ minHeight: '40px', padding: '0.4rem 1.25rem' }}
                        onClick={() => {
                          setActiveArtistId(artist.id);
                          setVouchNotes('');
                        }}
                      >
                        📜 Vouch for Artist
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Vouches Viewer Modal / Card */}
      {viewingVouchesArtist && (
        <div className="folk-card" style={{ padding: '1.75rem', background: '#FFFDF9', border: '2px solid var(--color-border-dark)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: 0 }}>
              Recorded Vouches for {viewingVouchesArtist.name}
            </h3>
            <button
              type="button"
              className="auth-nav-link"
              onClick={() => setViewingVouchesArtist(null)}
            >
              ✕ Close
            </button>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {artistVouchesList.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                No vouches recorded yet for this artist.
              </p>
            ) : (
              artistVouchesList.map((v) => (
                <div key={v.id} style={{ background: '#FFFFFF', border: '1.5px solid var(--color-border-subtle)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-dark-maroon)', fontSize: '0.95rem' }}>
                    📜 Coordinator: {v.coordinator_name}
                  </div>
                  <p style={{ margin: '0.35rem 0', fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
                    "{v.notes}"
                  </p>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    Recorded on {v.created_at ? new Date(v.created_at).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
