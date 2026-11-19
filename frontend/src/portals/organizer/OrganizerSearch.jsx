import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchArtists, getControlledArtForms } from '../../api';
import { getUser } from '../../auth';
import { SkeletonCard, EmptyState, ErrorBanner } from '../../components/shared/States';
import BookingRequestModal from '../../components/BookingRequestModal';
import { SarangiIcon } from '../../components/shared/CulturalMotifs';

export default function OrganizerSearch() {
  const navigate = useNavigate();
  const currentUser = getUser();

  // Filter States
  const [artForm, setArtForm] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState('2026-12-20');
  const [budget, setBudget] = useState(30000);
  const [groupSize, setGroupSize] = useState(6);
  const [language, setLanguage] = useState('');

  // Results & Pagination
  const [page, setPage] = useState(1);
  const [artists, setArtists] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Metadata & Modals
  const [controlledForms, setControlledForms] = useState([]);
  const [bookingArtist, setBookingArtist] = useState(null);

  useEffect(() => {
    getControlledArtForms()
      .then((forms) => setControlledForms(forms || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadArtists();
  }, [artForm, city, date, budget, groupSize, language, page]);

  async function loadArtists() {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        page,
        page_size: 6,
        ...(artForm ? { art_form: artForm } : {}),
        ...(city ? { city } : {}),
        ...(date ? { date } : {}),
        ...(budget ? { budget: Number(budget) } : {}),
        ...(groupSize ? { group_size: Number(groupSize) } : {}),
        ...(language ? { language } : {}),
      };
      const res = await searchArtists(filters);
      setArtists(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to search artists');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          Explore Living Folk Art Traditions
        </h1>
        <p style={{ fontSize: '15px', color: '#525866', margin: 0 }}>
          Discover master Kalbelia dancers, Manganiyar vocalists, Bhavai balancing artists, and folk troupes verified by regional cultural coordinators.
        </p>
      </div>

      {error && <ErrorBanner title="Search Error" message={error} onRetry={loadArtists} />}

      {/* Filter Bar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #E5E7EB',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          {/* Art Form Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>
              Art Form
            </label>
            <select
              value={artForm}
              onChange={(e) => { setArtForm(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14.5px', color: '#1F1A14', backgroundColor: '#FAF8F4' }}
            >
              <option value="">All Living Forms</option>
              {controlledForms.map((f) => (
                <option key={f.code || f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* City / Region */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>
              City / Region
            </label>
            <input
              type="text"
              placeholder="e.g. Jodhpur, Barmer, Jaipur"
              value={city}
              onChange={(e) => { setCity(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14.5px', color: '#1F1A14', backgroundColor: '#FAF8F4' }}
            />
          </div>

          {/* Event Date */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>
              Performance Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontSize: '14.5px', color: '#1F1A14', backgroundColor: '#FAF8F4' }}
            />
          </div>

          {/* Budget */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>
              Max Budget: ₹{Number(budget).toLocaleString('en-IN')}
            </label>
            <input
              type="range"
              min="5000"
              max="150000"
              step="2500"
              value={budget}
              onChange={(e) => { setBudget(e.target.value); setPage(1); }}
              style={{ width: '100%', accentColor: '#C2410C', marginTop: '6px' }}
            />
          </div>

          {/* Group Size */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', marginBottom: '6px' }}>
              Group Size: {groupSize} performers
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={groupSize}
              onChange={(e) => { setGroupSize(e.target.value); setPage(1); }}
              style={{ width: '100%', accentColor: '#C2410C', marginTop: '6px' }}
            />
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : artists.length === 0 ? (
        <EmptyState
          title="No Artists Match Filter Criteria"
          description="Try broadening your art form, city, or budget range to view more verified folk masters."
          actionLabel="Reset Search Filters"
          onAction={() => {
            setArtForm('');
            setCity('');
            setDate('');
            setBudget(50000);
            setGroupSize(6);
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {artists.map((artist) => {
            const baseRate = artist.rate_cards?.standard_rate || artist.base_honorarium || artist.fair_floor || 12000;
            return (
              <div
                key={artist.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Photo / Visual */}
                <div style={{ height: '180px', backgroundColor: '#F3EFE6', position: 'relative', overflow: 'hidden' }}>
                  {artist.photos?.[0] ? (
                    <img
                      src={artist.photos[0]}
                      alt={artist.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7', color: '#B45309' }}>
                      <SarangiIcon size={64} />
                    </div>
                  )}

                  {/* Reliability Badge */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        backgroundColor: '#1E3A8A',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                      }}
                    >
                      ★ {artist.reliability_tier || 'TIER_1_HERITAGE'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    {artist.art_form || 'Living Heritage Art'}
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 8px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                    {artist.name}
                  </h3>
                  <div style={{ fontSize: '14px', color: '#525866', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span>📍 {artist.city || artist.region || 'Rajasthan, India'}</span>
                    <span>•</span>
                    <span>👥 Up to {artist.max_group_size || 8} performers</span>
                  </div>

                  <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.5, margin: '0 0 16px 0', flex: 1 }}>
                    {artist.bio ? artist.bio.slice(0, 110) + '...' : 'Traditional generationally-trained artists performing authentic regional folk heritage.'}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F3F4F6', paddingTop: '16px', marginTop: 'auto' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Standard Honorarium</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#141B2D' }}>
                        ₹{baseRate.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => navigate(`/organizer/artists/${artist.id}`)}
                        style={{
                          padding: '8px 14px',
                          backgroundColor: '#FAF8F4',
                          color: '#141B2D',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingArtist(artist)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#C2410C',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '36px' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: '#FFFFFF',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1,
              fontWeight: 600,
            }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: '#FFFFFF',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.5 : 1,
              fontWeight: 600,
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Booking Modal */}
      {bookingArtist && (
        <BookingRequestModal
          isOpen={Boolean(bookingArtist)}
          onClose={() => setBookingArtist(null)}
          initialArtist={bookingArtist}
          currentUser={currentUser}
          onBookingCreated={(newBooking) => {
            setBookingArtist(null);
            navigate(`/organizer/negotiate?booking_id=${newBooking.id}`);
          }}
        />
      )}
    </div>
  );
}

