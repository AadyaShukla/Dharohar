import React, { useState, useEffect } from 'react';
import { getArtistPublicProfile } from '../api';
import Diya from './folk/Diya';
import PaisleyBorder from './folk/PaisleyBorder';

export default function ArtistDetailModal({ artistId, isOpen, onClose, onBookArtist }) {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && artistId) {
      loadProfile(artistId);
    }
  }, [isOpen, artistId]);

  async function loadProfile(id) {
    setLoading(true);
    setError(null);
    try {
      const data = await getArtistPublicProfile(id);
      setArtist(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const rateCard = artist?.rate_card || {
    min_fee: artist?.min_fee || 10000,
    travel_range_km: artist?.travel_range_km || 100,
    min_duration_minutes: artist?.min_duration_minutes || 60,
    max_group_size: artist?.max_group_size || 10,
    group_size: artist?.group_size || 6,
  };

  const reviewSummary = artist?.review_summary || {
    rating: artist?.rating || 5.0,
    ratings_count: artist?.ratings_count || 0,
    completed_bookings_count: artist?.completed_bookings_count || 0,
    vouches_count: artist?.vouches_count || 0,
    summary: 'Authentic verified traditional folk artist.',
  };

  const tier = artist?.reliability_tier || 'TRUSTED';
  const tierColor = tier === 'TRUSTED' ? '#166534' : tier === 'HIGH' ? '#B45309' : '#1E3A8A';
  const tierBg = tier === 'TRUSTED' ? '#ECFDF5' : tier === 'HIGH' ? '#FFFBEB' : '#EFF6FF';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(31, 26, 20, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFDF9',
          border: '3px solid #8B2500',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          fontFamily: "'Noto Sans', sans-serif",
          color: '#1F1A14',
          fontSize: '16px',
        }}
      >
        <PaisleyBorder />
        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px dashed #D97706',
              paddingBottom: '14px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Diya />
              <div>
                <h2
                  style={{
                    fontFamily: "'Yatra One', cursive",
                    fontSize: '24px',
                    color: '#8B2500',
                    margin: 0,
                  }}
                >
                  {artist?.name || 'Artist Profile'}
                </h2>
                <div style={{ fontSize: '15px', color: '#6B5E4F', marginTop: '2px' }}>
                  {artist?.art_form} • {artist?.city}, {artist?.state}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                color: '#8B2500',
                fontWeight: 'bold',
                padding: '4px 8px',
              }}
            >
              ✕
            </button>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '2px solid #DC2626',
                borderRadius: '8px',
                padding: '12px',
                color: '#991B1B',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <p style={{ textAlign: 'center', color: '#6B5E4F', padding: '30px' }}>
              Loading public artist profile...
            </p>
          ) : artist ? (
            <div>
              {/* Reliability & Verification Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: tierBg,
                  border: `2px solid ${tierColor}`,
                  marginBottom: '18px',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontWeight: 'bold',
                      color: tierColor,
                      fontSize: '15px',
                    }}
                  >
                    🛡️ Reliability Tier: {tier} ({artist.reliability_score?.toFixed(0) || 100}%)
                  </span>
                  <div style={{ fontSize: '14px', color: '#4A3E31', marginTop: '2px' }}>
                    {reviewSummary.completed_bookings_count} verified performances completed •{' '}
                    {reviewSummary.vouches_count} coordinator vouches
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#B45309',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ⭐ {artist.rating?.toFixed(1) || '5.0'} / 5.0
                </div>
              </div>

              {/* Bio & Background */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: '1px solid #E5D5C5',
                  marginBottom: '18px',
                }}
              >
                <h4 style={{ margin: '0 0 6px 0', color: '#8B2500', fontSize: '17px' }}>
                  About the Troupe
                </h4>
                <p style={{ margin: 0, color: '#2D241E', lineHeight: 1.5 }}>
                  {artist.bio ||
                    `Traditional masters of ${artist.art_form} preserving Rajasthan's cultural heritage with over ${artist.years_experience || 5} years of live stage experience.`}
                </p>
                <div style={{ marginTop: '10px', fontSize: '14px', color: '#6B5E4F' }}>
                  <strong>Languages:</strong>{' '}
                  {(artist.languages || ['Hindi']).join(', ')}
                </div>
              </div>

              {/* Audition Video or Portfolio Preview */}
              {artist.video_urls && artist.video_urls.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: '1px solid #E5D5C5',
                    marginBottom: '18px',
                  }}
                >
                  <h4 style={{ margin: '0 0 10px 0', color: '#8B2500', fontSize: '17px' }}>
                    Audition & Performance Clip
                  </h4>
                  <div
                    style={{
                      backgroundColor: '#1F1A14',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <video
                      controls
                      src={`http://localhost:8000${artist.video_urls[0]}`}
                      style={{ width: '100%', maxHeight: '280px', display: 'block' }}
                      poster={
                        artist.photo_urls && artist.photo_urls[0]
                          ? `http://localhost:8000${artist.photo_urls[0]}`
                          : undefined
                      }
                    >
                      Your browser does not support video playback.
                    </video>
                  </div>
                </div>
              )}

              {/* Rate Card Grid */}
              <div
                style={{
                  backgroundColor: '#FDFBF7',
                  border: '2px solid #C4A482',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 12px 0',
                    color: '#8B2500',
                    fontSize: '18px',
                    fontFamily: "'Yatra One', cursive",
                  }}
                >
                  Standard Rate Card & Constraints
                </h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #E5D5C5',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#6B5E4F' }}>Base Min Fee</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8B2500' }}>
                      ₹{rateCard.min_fee?.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #E5D5C5',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#6B5E4F' }}>Travel Radius</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F1A14' }}>
                      {rateCard.travel_range_km} km
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #E5D5C5',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#6B5E4F' }}>Min Duration</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F1A14' }}>
                      {rateCard.min_duration_minutes} mins
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #E5D5C5',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#6B5E4F' }}>Group Size</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F1A14' }}>
                      {rateCard.group_size || 6} artists
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  borderTop: '1px solid #E5D5C5',
                  paddingTop: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 18px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    backgroundColor: '#F3EDE4',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    color: '#4A3E31',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onBookArtist) onBookArtist(artist);
                  }}
                  style={{
                    padding: '10px 24px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    backgroundColor: '#8B2500',
                    border: '2px solid #5A1800',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  }}
                >
                  Book This Artist
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
