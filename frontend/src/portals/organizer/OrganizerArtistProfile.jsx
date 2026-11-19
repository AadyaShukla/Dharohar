import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArtistPublicProfile, getArtistVouches } from '../../api';
import { getUser } from '../../auth';
import { ErrorBanner, SkeletonCard } from '../../components/shared/States';
import BookingRequestModal from '../../components/BookingRequestModal';
import { JaaliDivider, SarangiIcon } from '../../components/shared/CulturalMotifs';

export default function OrganizerArtistProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getUser();

  const [artist, setArtist] = useState(null);
  const [vouches, setVouches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadProfile(id);
    }
  }, [id]);

  async function loadProfile(artistId) {
    setLoading(true);
    setError(null);
    try {
      const [profileData, vouchesData] = await Promise.all([
        getArtistPublicProfile(artistId),
        getArtistVouches(artistId).catch(() => []),
      ]);
      setArtist(profileData);
      setVouches(vouchesData || []);
    } catch (err) {
      setError(err.message || 'Failed to load artist public profile');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <SkeletonCard />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <ErrorBanner title="Profile Load Failed" message={error || 'Artist not found'} onRetry={() => loadProfile(id)} />
        <button
          type="button"
          onClick={() => navigate('/organizer/search')}
          style={{ padding: '10px 18px', backgroundColor: '#C2410C', color: '#FFFFFF', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          ← Return to Search
        </button>
      </div>
    );
  }

  const baseRate = artist.rate_cards?.standard_rate || artist.base_honorarium || 12000;

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/organizer/search')}
        style={{
          border: 'none',
          background: 'transparent',
          color: '#C2410C',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        ← Back to Discovery
      </button>

      {/* Hero Profile Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #E5E7EB',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          marginBottom: '32px',
        }}
      >
        <div style={{ height: '240px', backgroundColor: '#FEF3C7', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {artist.photos?.[0] ? (
            <img src={artist.photos[0]} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <SarangiIcon size={96} />
          )}
          <div style={{ position: 'absolute', bottom: '16px', right: '20px' }}>
            <span style={{ padding: '6px 14px', borderRadius: '9999px', backgroundColor: '#1E3A8A', color: '#FFFFFF', fontSize: '13px', fontWeight: 700 }}>
              ★ {artist.reliability_tier || 'TIER_1_HERITAGE'}
            </span>
          </div>
        </div>

        <div style={{ padding: '32px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                {artist.art_form || 'Living Heritage Tradition'}
              </div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 10px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {artist.name}
              </h1>
              <div style={{ display: 'flex', gap: '16px', color: '#525866', fontSize: '15px', flexWrap: 'wrap' }}>
                <span>📍 {artist.city || artist.region || 'Rajasthan, India'}</span>
                <span>•</span>
                <span>👥 {artist.max_group_size || 8} Ensemble Members</span>
                <span>•</span>
                <span>🗣️ {artist.languages?.join(', ') || 'Hindi, Marwari'}</span>
              </div>
            </div>

            <div style={{ textAlign: 'right', minWidth: '200px' }}>
              <div style={{ fontSize: '13px', color: '#6B7280', textTransform: 'uppercase' }}>Standard Honorarium</div>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#141B2D', marginBottom: '12px' }}>
                ₹{baseRate.toLocaleString('en-IN')}
              </div>
              <button
                type="button"
                onClick={() => setIsBookingOpen(true)}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: '#C2410C',
                  color: '#FFFFFF',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(194, 65, 12, 0.25)',
                }}
              >
                Initiate Booking Request
              </button>
            </div>
          </div>

          <JaaliDivider />

          {/* Privacy Notice */}
          <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 18px', fontSize: '14px', color: '#1E40AF', marginBottom: '24px' }}>
            🔒 <strong>Direct Fair-Wage Protection:</strong> Artist contact phone numbers, banking identifiers, and direct UPI IDs are protected and managed through Dharohar TrustPay Escrow to ensure fair compensation directly to the master artists.
          </div>

          {/* Bio & Heritage Background */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', marginBottom: '10px' }}>
              Tradition & Performance Style
            </h3>
            <p style={{ fontSize: '16px', color: '#374151', lineHeight: '1.7', margin: 0 }}>
              {artist.bio || 'Generationally trained folk artists performing authentic regional masterworks with traditional acoustic instruments, hand-embroidered heritage costumes, and historic cultural storytelling.'}
            </p>
          </div>

          {/* Rate Card Breakdown */}
          {artist.rate_cards && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', marginBottom: '12px' }}>
                Standard Rate Structure
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px 18px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Standard Event Rate</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', marginTop: '4px' }}>
                    ₹{(artist.rate_cards.standard_rate || baseRate).toLocaleString('en-IN')}
                  </div>
                </div>
                {artist.rate_cards.multi_day_discount && (
                  <div style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px 18px' }}>
                    <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Multi-Day Concession</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#15803D', marginTop: '4px' }}>
                      {artist.rate_cards.multi_day_discount}% Off
                    </div>
                  </div>
                )}
                {artist.travel_range_km && (
                  <div style={{ backgroundColor: '#FAF8F4', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px 18px' }}>
                    <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Max Transit Range</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', marginTop: '4px' }}>
                      {artist.travel_range_km} km radius
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video Audition */}
          {artist.audition_video_url && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', marginBottom: '12px' }}>
                Audition & Performance Recording
              </h3>
              <div style={{ borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000000', maxHeight: '420px' }}>
                <video
                  controls
                  src={artist.audition_video_url}
                  style={{ width: '100%', maxHeight: '420px', display: 'block' }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          )}

          {/* Regional Coordinator Vouches */}
          {vouches.length > 0 && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D', marginBottom: '12px' }}>
                Regional Coordinator Authenticity Vouches ({vouches.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {vouches.map((v, i) => (
                  <div key={i} style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>📜</span>
                      <strong style={{ fontSize: '14.5px', color: '#14532D' }}>{v.coordinator_name || 'Folk Heritage Coordinator'}</strong>
                      <span style={{ fontSize: '12px', color: '#166534' }}>({v.coordinator_district || 'Rajasthan Division'})</span>
                    </div>
                    <p style={{ fontSize: '14px', color: '#166534', margin: 0, fontStyle: 'italic' }}>
                      "{v.notes || 'Verified authentic traditional lineage and master craftsmanship.'}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {isBookingOpen && (
        <BookingRequestModal
          isOpen={isBookingOpen}
          onClose={() => setIsBookingOpen(false)}
          initialArtist={artist}
          currentUser={currentUser}
          onBookingCreated={(newBooking) => {
            setIsBookingOpen(false);
            navigate(`/organizer/negotiate?booking_id=${newBooking.id}`);
          }}
        />
      )}
    </div>
  );
}

