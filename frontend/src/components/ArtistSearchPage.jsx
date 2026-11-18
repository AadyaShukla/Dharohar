import React, { useState, useEffect } from 'react';
import { searchArtists, getControlledArtForms, getOrganizerProfile } from '../api';
import Diya from './folk/Diya';
import PaisleyBorder from './folk/PaisleyBorder';
import ArtistDetailModal from './ArtistDetailModal';
import BookingRequestModal from './BookingRequestModal';
import OrganizerProfileModal from './OrganizerProfileModal';

export default function ArtistSearchPage({ currentUser, onBookingCreated }) {
  // Search Filters
  const [artForm, setArtForm] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState('2026-11-20');
  const [budget, setBudget] = useState(25000);
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
    setBudget(25000);
    setGroupSize(6);
    setLanguage('');
    setPage(1);
  }

  const isVerified = organizerProfile?.verification_status === 'VERIFIED';

  return (
    <div
      style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '20px 16px',
        fontFamily: "'Noto Sans', sans-serif",
        color: '#1F1A14',
      }}
    >
      {/* Top Banner / Organizer Status Card */}
      <div
        style={{
          backgroundColor: '#FFFDF9',
          border: '2px solid #C4A482',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Diya />
          <div>
            <h1
              style={{
                fontFamily: "'Yatra One', cursive",
                fontSize: '26px',
                color: '#8B2500',
                margin: 0,
              }}
            >
              Folk Artist Discovery & Search
            </h1>
            <p style={{ margin: '2px 0 0 0', color: '#6B5E4F', fontSize: '15px' }}>
              Discover authentic, verified folk troupes with real availability and transparent rates.
            </p>
          </div>
        </div>

        {currentUser?.role === 'ORGANIZER' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                backgroundColor: isVerified ? '#ECFDF5' : '#FFFBEB',
                color: isVerified ? '#166534' : '#B45309',
                border: `1px solid ${isVerified ? '#166534' : '#D97706'}`,
              }}
            >
              {isVerified ? '🛡️ Verified Organizer' : '⚠️ Unverified (Limit ₹20k)'}
            </span>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              style={{
                backgroundColor: '#8B2500',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              Organizer Profile
            </button>
          </div>
        )}
      </div>

      {/* Multi-Criteria Filter Bar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '2px solid #8B2500',
          borderRadius: '10px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: "'Yatra One', cursive",
              fontSize: '20px',
              color: '#8B2500',
            }}
          >
            Filter Available Artists
          </h3>
          <button
            onClick={handleResetFilters}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8B2500',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'underline',
            }}
          >
            Reset Filters
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Art Form Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
              Art Form
            </label>
            <select
              value={artForm}
              onChange={(e) => {
                setArtForm(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '15px',
                border: '1px solid #C4A482',
                borderRadius: '6px',
                backgroundColor: '#FFFDF9',
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

          {/* City Input */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. Jodhpur, Jaipur"
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '15px',
                border: '1px solid #C4A482',
                borderRadius: '6px',
                backgroundColor: '#FFFDF9',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Event Date Picker */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
              Event Date
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
                padding: '8px 10px',
                fontSize: '15px',
                border: '1px solid #C4A482',
                borderRadius: '6px',
                backgroundColor: '#FFFDF9',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Max Budget (INR) */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
              Max Budget: ₹{Number(budget).toLocaleString('en-IN')}
            </label>
            <input
              type="range"
              min={5000}
              max={60000}
              step={1000}
              value={budget}
              onChange={(e) => {
                setBudget(Number(e.target.value));
                setPage(1);
              }}
              style={{ width: '100%', accentColor: '#8B2500' }}
            />
          </div>

          {/* Group Size */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
              Group Size ({groupSize} artists)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={groupSize}
              onChange={(e) => {
                setGroupSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '15px',
                border: '1px solid #C4A482',
                borderRadius: '6px',
                backgroundColor: '#FFFDF9',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Language */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
              Language
            </label>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                setPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '15px',
                border: '1px solid #C4A482',
                borderRadius: '6px',
                backgroundColor: '#FFFDF9',
              }}
            >
              <option value="">Any Language</option>
              <option value="Hindi">Hindi</option>
              <option value="Rajasthani">Rajasthani</option>
              <option value="Marwari">Marwari</option>
              <option value="Mewari">Mewari</option>
              <option value="Bengali">Bengali</option>
              <option value="English">English</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '16px',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "'Yatra One', cursive",
              fontSize: '22px',
              color: '#8B2500',
            }}
          >
            Available Live Artists ({totalCount})
          </h2>
          <span style={{ fontSize: '14px', color: '#6B5E4F' }}>
            Sorted by relevance & reliability score
          </span>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '2px solid #DC2626',
              borderRadius: '8px',
              padding: '14px',
              color: '#991B1B',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', color: '#6B5E4F', padding: '40px', fontSize: '18px' }}>
            Searching authentic folk artists...
          </p>
        ) : artists.length === 0 ? (
          <div
            style={{
              backgroundColor: '#FFFDF9',
              border: '2px dashed #C4A482',
              borderRadius: '8px',
              padding: '40px 20px',
              textAlign: 'center',
            }}
          >
            <Diya />
            <h3 style={{ color: '#8B2500', margin: '10px 0 6px 0' }}>No Artists Found</h3>
            <p style={{ color: '#6B5E4F', margin: 0 }}>
              Try broadening your budget or clearing date/art form filters.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {artists.map((artist) => {
              const tier = artist.reliability_tier || 'TRUSTED';
              const tierBg =
                tier === 'TRUSTED' ? '#ECFDF5' : tier === 'HIGH' ? '#FFFBEB' : '#EFF6FF';
              const tierColor =
                tier === 'TRUSTED' ? '#166534' : tier === 'HIGH' ? '#B45309' : '#1E3A8A';

              const rateCard = artist.rate_card || { min_fee: artist.min_fee || 12000 };

              return (
                <div
                  key={artist.id}
                  style={{
                    backgroundColor: '#FFFDF9',
                    border: '2px solid #C4A482',
                    borderRadius: '10px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    transition: 'transform 0.2s',
                  }}
                >
                  <div>
                    {/* Header line with tier badge */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '8px',
                      }}
                    >
                      <span
                        style={{
                          backgroundColor: tierBg,
                          color: tierColor,
                          border: `1px solid ${tierColor}`,
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        🛡️ {tier} ({artist.reliability_score?.toFixed(0) || 100}%)
                      </span>
                      <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#B45309' }}>
                        ⭐ {artist.rating?.toFixed(1) || '5.0'}
                      </span>
                    </div>

                    {/* Artist Title & Art Form */}
                    <h3
                      style={{
                        margin: '0 0 4px 0',
                        fontFamily: "'Yatra One', cursive",
                        fontSize: '20px',
                        color: '#8B2500',
                      }}
                    >
                      {artist.name}
                    </h3>
                    <div style={{ fontSize: '14px', color: '#4A3E31', marginBottom: '8px' }}>
                      🎭 {artist.art_form} • 📍 {artist.city}, {artist.state}
                    </div>

                    {/* Short Bio snippet */}
                    <p
                      style={{
                        fontSize: '14px',
                        color: '#2D241E',
                        lineHeight: 1.4,
                        margin: '0 0 12px 0',
                        maxHeight: '40px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {artist.bio ||
                        `Traditional folk troupe renowned for authentic ${artist.art_form}.`}
                    </p>

                    {/* Rate Card Strip */}
                    <div
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5D5C5',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '14px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B5E4F' }}>Base Min Fee</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#8B2500' }}>
                          ₹{rateCard.min_fee?.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B5E4F' }}>Travel</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1F1A14' }}>
                          {rateCard.travel_range_km || 150} km
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B5E4F' }}>Group</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1F1A14' }}>
                          {rateCard.group_size || 6} artists
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={() => setSelectedArtistId(artist.id)}
                      style={{
                        flex: '1',
                        padding: '8px 12px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        backgroundColor: '#F3EDE4',
                        border: '1px solid #C4A482',
                        borderRadius: '6px',
                        color: '#4A3E31',
                        cursor: 'pointer',
                      }}
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => setBookingArtist(artist)}
                      style={{
                        flex: '1',
                        padding: '8px 12px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        backgroundColor: '#8B2500',
                        border: '1px solid #5A1800',
                        borderRadius: '6px',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      Book Artist
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
              marginTop: '28px',
            }}
          >
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '8px 16px',
                fontSize: '15px',
                fontWeight: 'bold',
                backgroundColor: page <= 1 ? '#F3EDE4' : '#8B2500',
                color: page <= 1 ? '#A89E92' : '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#4A3E31' }}>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '8px 16px',
                fontSize: '15px',
                fontWeight: 'bold',
                backgroundColor: page >= totalPages ? '#F3EDE4' : '#8B2500',
                color: page >= totalPages ? '#A89E92' : '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next
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

      {/* Booking Creation Modal */}
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
