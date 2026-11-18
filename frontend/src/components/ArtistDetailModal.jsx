import React, { useState, useEffect } from 'react';
import { getArtistPublicProfile } from '../api';
import Diya from './folk/Diya';
import HeritageDivider from './heritage/HeritageDivider';
import TextileBorder from './heritage/TextileBorder';
import CulturalMotif from './heritage/CulturalMotif';
import DharoharLoader from './heritage/DharoharLoader';

const TRADITION_INSIGHTS = {
  'Kalbelia Dance': {
    origin: 'Thar Desert & Jodhpur, Rajasthan',
    heritage: 'UNESCO Intangible Cultural Heritage. Historically nomadic snake charmers, Kalbelia women dance with sinuous, hypnotic serpentine spins while male musicians accompany on Poongi and Khanjari.',
    attire: 'Signature swirling black angrakha embroidered with silver gota-patti and mirror-work reflecting desert moonlight.',
  },
  'Ghoomar Dance': {
    origin: 'Bhil Tribe & Royal Rajputana Courts',
    heritage: 'Historic celebration dance of graceful, flowing pirouettes. Performed by women wearing colorful swirling ghagras and odhanis to welcome newlywed brides and celebrate Gangaur.',
    attire: 'Heavy mirror-work silk lehengas with antique kundan and jadau silver jewelry.',
  },
  'Manganiyar Folk Music': {
    origin: 'Jaisalmer & Barmer, Rajasthan',
    heritage: 'Hereditary desert bards renowned for virtuosic bowing on the rare Kamaicha, Sarangi, and Khartal castanets, singing oral histories of kings, Sufi saints, and desert monsoon showers.',
    attire: 'Crisp white cotton angrakha paired with vibrant saffron or red Rajasthani leheriya pagri (turban).',
  },
  'Bhavai Folk Dance': {
    origin: 'Southern Rajasthan & Western Gujarat',
    heritage: 'Breathtaking balancing artistry. Performers balance up to 9 brass matkas on their head while pirouetting on sword edges or the rims of brass thalis with rhythmic footwork.',
    attire: 'Flared ghagras adorned with brass bells (ghungroo) and traditional silver tribal neckpieces.',
  },
  'Chhau Dance': {
    origin: 'Purulia, West Bengal & Seraikela, Jharkhand',
    heritage: 'Semi-classical martial dance enacting sacred epics with heroic leaps, clay masks, and booming Dhol-Dhumsa percussion.',
    attire: 'Handcrafted clay and papier-mâché mythological masks decorated with zari and peacock feathers.',
  },
  'Kathputli Puppet Theatre': {
    origin: 'Marwar region, Rajasthan',
    heritage: 'Over a thousand years old string marionette tradition. Puppeteers narrate epic folk legends using a characteristic high-pitched bamboo whistle (boli) and miniature instruments.',
    attire: 'Hand-carved mango-wood dolls dressed in flowing vintage Rajasthani brocade.',
  },
};

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
  const tierColor = tier === 'TRUSTED' ? '#15803D' : tier === 'HIGH' ? '#B45309' : '#1E3A8A';
  const tierBg = tier === 'TRUSTED' ? '#ECFDF5' : tier === 'HIGH' ? '#FFFBEB' : '#EFF6FF';

  const traditionInfo = TRADITION_INSIGHTS[artist?.art_form] || {
    origin: `${artist?.city || 'Rajasthan'}, India`,
    heritage: `Living Indian performing art passed down through generations. Preserves ancestral oral repertoires and community ceremonies.`,
    attire: `Authentic hand-loomed traditional attire reflective of regional heritage.`,
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(27, 37, 75, 0.76)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="artist-modal-title"
    >
      <div
        style={{
          backgroundColor: '#FFFDF9',
          border: '3px solid #6B1717',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          fontFamily: "'Noto Sans', sans-serif",
          color: '#1F1A14',
          position: 'relative',
        }}
      >
        <TextileBorder height={16} />

        <div style={{ padding: '24px 28px' }}>
          {/* Header Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid #E8DCCB',
              paddingBottom: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CulturalMotif name="sarangi" size={34} />
              <div>
                <h2
                  id="artist-modal-title"
                  style={{
                    fontFamily: "'Yatra One', cursive",
                    fontSize: '26px',
                    color: '#6B1717',
                    margin: 0,
                  }}
                >
                  {artist?.name || 'Artist Profile'}
                </h2>
                <div style={{ fontSize: '14.5px', color: '#6B5E4F', marginTop: '3px' }}>
                  <strong>{artist?.art_form}</strong> • {artist?.city}, {artist?.state}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6B1717',
                fontWeight: 'bold',
                padding: '4px 8px',
                borderRadius: '4px',
              }}
            >
              ✕
            </button>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '2px solid #EF4444',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#991B1B',
                marginBottom: '18px',
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <DharoharLoader message="Fetching Master Troupe Portfolio & Lineage..." />
          ) : artist ? (
            <div>
              {/* Reliability & Quality Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  backgroundColor: tierBg,
                  border: `2px solid ${tierColor}`,
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '12px',
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
                  <div style={{ fontSize: '13.5px', color: '#4B5563', marginTop: '2px' }}>
                    {reviewSummary.completed_bookings_count} verified performances completed •{' '}
                    {reviewSummary.vouches_count} cultural coordinator vouches
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

              {/* Troupe Biography */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  padding: '16px 20px',
                  borderRadius: '10px',
                  border: '1.5px solid #E8DCCB',
                  marginBottom: '20px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <h4 style={{ margin: '0 0 8px', color: '#6B1717', fontSize: '18px', fontFamily: "'Yatra One', cursive" }}>
                  About the Troupe
                </h4>
                <p style={{ margin: 0, color: '#334155', lineHeight: 1.6, fontSize: '15px' }}>
                  {artist.bio ||
                    `Master exponents of ${artist.art_form} carrying forward centuries-old repertoires with ${artist.years_experience || 5} years of celebrated performances across festivals and heritage venues.`}
                </p>
                <div style={{ marginTop: '10px', fontSize: '13.5px', color: '#6B5E4F' }}>
                  <strong>Spoken Languages:</strong> {(artist.languages || ['Hindi']).join(', ')}
                </div>
              </div>

              {/* Educational Living Tradition Card */}
              <div
                style={{
                  backgroundColor: '#FAF5EE',
                  border: '2px solid #C4A482',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📜</span>
                  <h4 style={{ margin: 0, color: '#6B1717', fontSize: '18px', fontFamily: "'Yatra One', cursive" }}>
                    About the Tradition ({artist.art_form})
                  </h4>
                </div>
                <div style={{ fontSize: '13px', color: '#B45309', fontWeight: 600, marginBottom: '6px' }}>
                  📍 Cultural Cradle: {traditionInfo.origin}
                </div>
                <p style={{ margin: '0 0 8px', color: '#4A3E31', lineHeight: 1.55, fontSize: '14px' }}>
                  {traditionInfo.heritage}
                </p>
                <div style={{ fontSize: '13px', color: '#6B5E4F' }}>
                  <strong>Attire &amp; Instruments:</strong> {traditionInfo.attire}
                </div>
              </div>

              {/* Audition Video or Portfolio Preview */}
              {artist.video_urls && artist.video_urls.length > 0 && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    padding: '16px 20px',
                    borderRadius: '10px',
                    border: '1.5px solid #E8DCCB',
                    marginBottom: '20px',
                  }}
                >
                  <h4 style={{ margin: '0 0 10px', color: '#6B1717', fontSize: '18px', fontFamily: "'Yatra One', cursive" }}>
                    Verified Video Audition
                  </h4>
                  <div
                    style={{
                      backgroundColor: '#0F172A',
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

              {/* Standard Rate Card & Constraints */}
              <div
                style={{
                  backgroundColor: '#FFFDF9',
                  border: '2px solid #C4A482',
                  borderRadius: '10px',
                  padding: '18px',
                  marginBottom: '24px',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 14px',
                    color: '#6B1717',
                    fontSize: '18px',
                    fontFamily: "'Yatra One', cursive",
                  }}
                >
                  Rate Card &amp; Booking Constraints
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
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #E8DCCB',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '12.5px', color: '#6B5E4F' }}>Base Min Fee</div>
                    <div style={{ fontSize: '19px', fontWeight: 'bold', color: '#B84220' }}>
                      ₹{rateCard.min_fee?.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #E8DCCB',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '12.5px', color: '#6B5E4F' }}>Travel Radius</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F1A14' }}>
                      {rateCard.travel_range_km} km
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #E8DCCB',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '12.5px', color: '#6B5E4F' }}>Min Duration</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F1A14' }}>
                      {rateCard.min_duration_minutes} mins
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: '#FFFFFF',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #E8DCCB',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '12.5px', color: '#6B5E4F' }}>Group Size</div>
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
                  borderTop: '1px solid #E8DCCB',
                  paddingTop: '18px',
                }}
              >
                <button
                  type="button"
                  className="folk-btn-secondary"
                  onClick={onClose}
                  style={{ padding: '10px 20px', fontSize: '15px' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="folk-btn-primary"
                  onClick={() => {
                    onClose();
                    if (onBookArtist) onBookArtist(artist);
                  }}
                  style={{
                    padding: '10px 26px',
                    fontSize: '15px',
                    boxShadow: '0 4px 12px rgba(184, 66, 32, 0.25)',
                  }}
                >
                  Book This Troupe
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
