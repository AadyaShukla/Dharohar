import React, { useState, useEffect } from 'react';
import { searchArtists, getControlledArtForms, getOrganizerProfile } from '../api';
import Diya from './folk/Diya';
import HeritageDivider from './heritage/HeritageDivider';
import TextileBorder from './heritage/TextileBorder';
import CulturalMotif from './heritage/CulturalMotif';
import FolkPattern from './heritage/FolkPattern';
import DharoharLoader from './heritage/DharoharLoader';
import ArtistDetailModal from './ArtistDetailModal';
import BookingRequestModal from './BookingRequestModal';
import OrganizerProfileModal from './OrganizerProfileModal';

export default function ArtistSearchPage({ currentUser, onBookingCreated }) {
  // Search Filters
  const [artForm, setArtForm] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState('2026-11-20');
  const [budget, setBudget] = useState(30000);
  const [groupSize, setGroupSize] = useState(6);
  const [language, setLanguage] = useState('');

  // Pagination & Results
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [artists, setArtists] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Metadata
  const [controlledForms, setControlledForms] = useState([]);
  const [organizerProfile, setOrganizerProfile] = useState(null);

  // Modals
  const [selectedArtistId, setSelectedArtistId] = useState(null);
  const [bookingArtist, setBookingArtist] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    getControlledArtForms()
      .then((forms) => setControlledForms(forms || []))
      .catch(() => {});

    if (currentUser?.role === 'ORGANIZER') {
      getOrganizerProfile()
        .then((p) => setOrganizerProfile(p))
        .catch(() => {});
    }
  }, [currentUser]);

  useEffect(() => {
    executeSearch();
  }, [artForm, city, date, budget, groupSize, language, page]);

  async function executeSearch() {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        art_form: artForm || undefined,
        city: city || undefined,
        date: date || undefined,
        budget: budget ? Number(budget) : undefined,
        group_size: groupSize ? Number(groupSize) : undefined,
        language: language || undefined,
        page,
        page_size: pageSize,
      };

      const res = await searchArtists(filters);
      setArtists(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleResetFilters() {
    setArtForm('');
    setCity('');
    setDate('2026-11-20');
    setBudget(30000);
    setGroupSize(6);
    setLanguage('');
    setPage(1);
  }

  const isVerified = organizerProfile?.verification_status === 'VERIFIED';

  function getMotifForArtForm(name) {
    if (!name) return 'sarangi';
    const lower = name.toLowerCase();
    if (lower.includes('dance') || lower.includes('ghoomar') || lower.includes('bhavai') || lower.includes('kalbelia')) {
      return 'dancer';
    }
    if (lower.includes('puppet') || lower.includes('kathputli')) {
      return 'puppet';
    }
    if (lower.includes('dholak') || lower.includes('chhau')) {
      return 'dholak';
    }
    return 'sarangi';
  }

  return (
    <div
      style={{
        maxWidth: '1240px',
        margin: '0 auto',
        padding: '24px 16px 48px',
        fontFamily: "'Noto Sans', sans-serif",
        color: '#1F1A14',
      }}
    >
      {/* ====================================================================
          1. TOP BANNER / ORGANIZER STATUS CARD
          ==================================================================== */}
      <div
        style={{
          backgroundColor: '#FFFDF9',
          border: '2px solid var(--dh-border-heritage)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <FolkPattern variant="jaali" opacity={0.03} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 1 }}>
          <CulturalMotif name="sarangi" size={38} />
          <div>
            <h1
              style={{
                fontFamily: "'Yatra One', cursive",
                fontSize: '28px',
                color: '#6B1717',
                margin: 0,
              }}
            >
              Curated Folk Artist Collection
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#6B5E4F', fontSize: '15px' }}>
              Authentic living traditions with verified rate cards, calendar availability, and coordinator vouches.
            </p>
          </div>
        </div>

        {currentUser?.role === 'ORGANIZER' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1 }}>
            <span
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                backgroundColor: isVerified ? '#ECFDF5' : '#FFFBEB',
                color: isVerified ? '#15803D' : '#B45309',
                border: `1.5px solid ${isVerified ? '#A7F3D0' : '#FDE68A'}`,
              }}
            >
              {isVerified ? '🛡️ Verified Organizer' : '⚠️ Unverified (Limit ₹20,000)'}
            </span>
            <button
              type="button"
              className="folk-btn-secondary"
              onClick={() => setIsProfileModalOpen(true)}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Organizer Profile
            </button>
          </div>
        ) : (
          <div
            style={{
              zIndex: 1,
              background: '#FAF5EE',
              border: '1px solid #E8DCCB',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '13px',
              color: '#6B5E4F',
            }}
          >
            👁️ Viewing as Cultural Guest • Select any troupe to inspect profile or book
          </div>
        )}
      </div>

      {/* ====================================================================
          2. MULTI-CRITERIA FILTER BAR
          ==================================================================== */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '2px solid #6B1717',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
            borderBottom: '1px solid #E8DCCB',
            paddingBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🔍</span>
            <h3
              style={{
                margin: 0,
                fontFamily: "'Yatra One', cursive",
                fontSize: '20px',
                color: '#6B1717',
              }}
            >
              Filter by Tradition, Location &amp; Budget
            </h3>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#B84220',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'underline',
            }}
          >
            Reset Filters ↺
          </button>
        </div>

        {/* Filter Controls Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Art Form Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Art Form / Tradition
            </label>
            <select
              value={artForm}
              onChange={(e) => {
                setArtForm(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '14.5px',
                border: '1.5px solid var(--dh-border-heritage)',
                borderRadius: '8px',
                backgroundColor: '#FFFDF9',
                outline: 'none',
              }}
            >
              <option value="">All Art Forms</option>
              {controlledForms.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* City / Region Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              City / Region
            </label>
            <input
              type="text"
              placeholder="e.g. Jodhpur, Udaipur, Purulia"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '14.5px',
                border: '1.5px solid var(--dh-border-heritage)',
                borderRadius: '8px',
                backgroundColor: '#FFFDF9',
                outline: 'none',
              }}
            />
          </div>

          {/* Event Date Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Performance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '14.5px',
                border: '1.5px solid var(--dh-border-heritage)',
                borderRadius: '8px',
                backgroundColor: '#FFFDF9',
                outline: 'none',
              }}
            />
          </div>

          {/* Target Budget */}
          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Max Budget: ₹{Number(budget).toLocaleString('en-IN')}
            </label>
            <input
              type="range"
              min="8000"
              max="80000"
              step="2000"
              value={budget}
              onChange={(e) => {
                setBudget(Number(e.target.value));
                setPage(1);
              }}
              style={{
                width: '100%',
                accentColor: '#B84220',
                cursor: 'pointer',
                marginTop: '8px',
              }}
            />
          </div>

          {/* Group Size Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Max Troupe Size
            </label>
            <input
              type="number"
              min="1"
              max="30"
              value={groupSize}
              onChange={(e) => {
                setGroupSize(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '14.5px',
                border: '1.5px solid var(--dh-border-heritage)',
                borderRadius: '8px',
                backgroundColor: '#FFFDF9',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. ARTISTS GALLERY SECTION
          ==================================================================== */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#6B1717' }}>
            Showing {artists.length} of {totalCount} Verified Folk Troupes
          </span>
          <span style={{ fontSize: '13.5px', color: '#6B5E4F' }}>
            Page {page} of {totalPages}
          </span>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '2px solid #EF4444',
              borderRadius: '8px',
              padding: '14px 18px',
              color: '#991B1B',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <DharoharLoader message="Searching authenticated village troupes and checking calendar availability..." />
        ) : artists.length === 0 ? (
          /* Empty State */
          <div
            style={{
              backgroundColor: '#FFFDF9',
              border: '2px dashed var(--dh-border-heritage)',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <CulturalMotif name="diya" size={48} />
            <h3 style={{ color: '#6B1717', margin: '14px 0 8px', fontFamily: "'Yatra One', cursive", fontSize: '22px' }}>
              No Artists Found for Selected Criteria
            </h3>
            <p style={{ color: '#6B5E4F', margin: '0 0 20px', fontSize: '15px' }}>
              Try broadening your budget threshold, selecting "All Art Forms", or clearing specific date filters.
            </p>
            <button
              type="button"
              className="folk-btn-primary"
              onClick={handleResetFilters}
              style={{ padding: '10px 22px', fontSize: '15px' }}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          /* Gallery Grid */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '24px',
            }}
          >
            {artists.map((artist) => {
              const tier = artist.reliability_tier || 'TRUSTED';
              const tierBg =
                tier === 'TRUSTED' ? '#ECFDF5' : tier === 'HIGH' ? '#FFFBEB' : '#EFF6FF';
              const tierColor =
                tier === 'TRUSTED' ? '#15803D' : tier === 'HIGH' ? '#B45309' : '#1E3A8A';

              const rateCard = artist.rate_card || { min_fee: artist.min_fee || 12000 };
              const motif = getMotifForArtForm(artist.art_form);

              return (
                <div
                  key={artist.id}
                  className="curated-artist-card"
                >
                  <FolkPattern variant="jaali" opacity={0.03} />

                  {/* Card Header */}
                  <div className="curated-artist-header">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: tierBg,
                          color: tierColor,
                          border: `1.5px solid ${tierColor}`,
                          borderRadius: '6px',
                          padding: '3px 10px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          letterSpacing: '0.4px',
                        }}
                      >
                        🛡️ {tier} ({artist.reliability_score?.toFixed(0) || 100}%)
                      </span>
                      <span style={{ fontSize: '14.5px', fontWeight: 'bold', color: '#B45309' }}>
                        ⭐ {artist.rating?.toFixed(1) || '5.0'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CulturalMotif name={motif} size={30} />
                      <div>
                        <h3
                          style={{
                            margin: '0 0 2px 0',
                            fontFamily: "'Yatra One', cursive",
                            fontSize: '21px',
                            color: '#6B1717',
                          }}
                        >
                          {artist.name}
                        </h3>
                        <div style={{ fontSize: '13.5px', color: '#B84220', fontWeight: 600 }}>
                          {artist.art_form}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="curated-artist-body">
                    <div style={{ fontSize: '13px', color: '#6B5E4F', marginBottom: '10px' }}>
                      📍 <strong>Location:</strong> {artist.city}, {artist.state || 'Rajasthan'}
                    </div>

                    <p
                      style={{
                        fontSize: '14px',
                        lineHeight: 1.55,
                        color: '#4B5563',
                        margin: '0 0 16px',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {artist.bio ||
                        `Traditional masters of ${artist.art_form} preserving authentic folklore with ${artist.years_experience || 5} years of performance heritage.`}
                    </p>

                    {/* Rate & Spec Pills */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '8px',
                        background: '#FAF6EE',
                        border: '1px solid #E8DCCB',
                        borderRadius: '8px',
                        padding: '10px',
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B5E4F', textTransform: 'uppercase' }}>Min Fee</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#B84220' }}>
                          ₹{rateCard.min_fee?.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B5E4F', textTransform: 'uppercase' }}>Radius</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1F1A14' }}>
                          {rateCard.travel_range_km || 100} km
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#6B5E4F', textTransform: 'uppercase' }}>Group</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1F1A14' }}>
                          {rateCard.group_size || 6} artists
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="curated-artist-footer">
                    <button
                      type="button"
                      className="folk-btn-secondary"
                      onClick={() => setSelectedArtistId(artist.id)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '14px' }}
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      className="folk-btn-primary"
                      onClick={() => setBookingArtist(artist)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '14px' }}
                    >
                      Book Troupe
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Navigation */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '16px',
              marginTop: '36px',
            }}
          >
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="folk-btn-secondary"
              style={{
                padding: '8px 18px',
                fontSize: '14.5px',
                opacity: page <= 1 ? 0.5 : 1,
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#4A3E31' }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="folk-btn-secondary"
              style={{
                padding: '8px 18px',
                fontSize: '14.5px',
                opacity: page >= totalPages ? 0.5 : 1,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Public Profile Detail Modal */}
      <ArtistDetailModal
        artistId={selectedArtistId}
        isOpen={Boolean(selectedArtistId)}
        onClose={() => setSelectedArtistId(null)}
        onBookArtist={(art) => setBookingArtist(art)}
      />

      {/* Multi-Step Booking Creation Modal */}
      <BookingRequestModal
        isOpen={Boolean(bookingArtist)}
        onClose={() => setBookingArtist(null)}
        initialArtist={bookingArtist}
        currentUser={currentUser}
        onBookingCreated={(newBooking, negResult) => {
          setBookingArtist(null);
          if (onBookingCreated) {
            onBookingCreated(newBooking, negResult);
          }
        }}
      />

      {/* Organizer Profile View/Edit Modal */}
      <OrganizerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onUpdated={(p) => setOrganizerProfile(p)}
      />
    </div>
  );
}
