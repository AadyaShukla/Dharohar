import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { getBookings, getArtists, getOrganizerProfile, runDemoScenario } from '../../api';
import StatusBadge from '../../components/shared/StatusBadge';
import { SkeletonTable, ErrorBanner, EmptyState } from '../../components/shared/States';
import { JaaliDivider } from '../../components/shared/CulturalMotifs';

export default function OrganizerDashboard() {
  const navigate = useNavigate();
  const { setSelectedBookingId, reloadBookings } = useOutletContext() || {};

  const [bookings, setBookings] = useState([]);
  const [artists, setArtists] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const [bookingsData, artistsData, profileData] = await Promise.all([
        getBookings().catch(() => []),
        getArtists().catch(() => []),
        getOrganizerProfile().catch(() => null),
      ]);
      setBookings(bookingsData || []);
      setArtists(artistsData || []);
      setProfile(profileData);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunchDemo() {
    setIsDemoRunning(true);
    setError(null);
    try {
      const res = await runDemoScenario();
      if (reloadBookings) await reloadBookings();
      if (setSelectedBookingId) setSelectedBookingId(res.booking_id);
      await loadDashboardData();
      navigate(`/organizer/negotiate?booking_id=${res.booking_id}`);
    } catch (err) {
      setError(err.message || 'Demo scenario launch failed');
    } finally {
      setIsDemoRunning(false);
    }
  }

  // Calculate Metrics
  const totalBookings = bookings.length;
  const inNegotiation = bookings.filter((b) => b.status === 'NEGOTIATING' || b.status === 'REQUESTED' || b.status === 'AWAITING_ARTIST_APPROVAL').length;
  const inEscrow = bookings.filter((b) => b.status === 'ESCROW_HELD' || b.status === 'PAID').length;
  const completed = bookings.filter((b) => b.status === 'SETTLED' || b.status === 'COMPLETED').length;

  return (
    <div>
      {/* Welcome Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #E5E7EB',
          borderRadius: '16px',
          padding: '28px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
          marginBottom: '28px',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}
          >
            🏛️ {profile?.verification_status === 'VERIFIED' ? 'VERIFIED ORGANIZER' : 'STANDARD PATRON'}
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
            Welcome, {profile?.organization_name || 'Esteemed Patron'}
          </h1>
          <p style={{ fontSize: '15.5px', color: '#525866', margin: 0 }}>
            Manage direct artist negotiations, fair honorarium guarantees, and TrustPay escrow contracts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate('/organizer/search')}
            style={{
              padding: '12px 22px',
              backgroundColor: '#C2410C',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🔍 Find Folk Artists
          </button>
          <button
            type="button"
            onClick={handleLaunchDemo}
            disabled={isDemoRunning}
            style={{
              padding: '12px 20px',
              backgroundColor: '#FFF7ED',
              color: '#C2410C',
              border: '1.5px solid #FFEDD5',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: isDemoRunning ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isDemoRunning ? '⏳ Launching...' : '🎬 Run Demo Scenario'}
          </button>
        </div>
      </div>

      {error && <ErrorBanner title="Dashboard Notice" message={error} onRetry={loadDashboardData} />}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'Total Bookings', value: totalBookings, icon: '📜', color: '#1E3A8A', bg: '#EFF6FF' },
          { label: 'In Negotiation', value: inNegotiation, icon: '🤝', color: '#D97706', bg: '#FFFBEB' },
          { label: 'Escrow Protected', value: inEscrow, icon: '🔒', color: '#15803D', bg: '#F0FDF4' },
          { label: 'Completed Events', value: completed, icon: '✓', color: '#7C3AED', bg: '#F5F3FF' },
        ].map((card, i) => (
          <div
            key={i}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                backgroundColor: card.bg,
                color: card.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
              }}
            >
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {card.label}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 'bold', color: '#141B2D', lineHeight: 1.2 }}>
                {card.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <JaaliDivider />

      {/* Recent Bookings Section */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '16px', padding: '24px 28px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#141B2D', margin: 0 }}>
              Recent Bookings & Escrows
            </h2>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '4px 0 0 0' }}>
              Real-time status of your artist reservations and negotiation milestones.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/organizer/bookings')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#C2410C',
              fontSize: '14.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View All ({bookings.length}) →
          </button>
        </div>

        {loading ? (
          <SkeletonTable rows={4} />
        ) : bookings.length === 0 ? (
          <EmptyState
            title="No Bookings Placed Yet"
            description="Explore our living catalogue of verified Rajasthani, Gujarati, and folk artists across India."
            actionLabel="Discover Artists Now"
            onAction={() => navigate('/organizer/search')}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #E5E7EB', backgroundColor: '#FAF8F4' }}>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#4B5563' }}>Booking ID</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#4B5563' }}>Art Form</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#4B5563' }}>Event Date</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#4B5563' }}>Budget</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#4B5563' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#4B5563', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 6).map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontFamily: 'monospace', fontWeight: 600, color: '#1E3A8A' }}>
                      #{b.id.slice(0, 10)}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '15px', fontWeight: 600, color: '#1F1A14' }}>
                      {b.art_form_requested || 'Folk Performance'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '14px', color: '#525866' }}>
                      📅 {b.event_date || 'TBD'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '15px', fontWeight: 700, color: '#1F1A14' }}>
                      ₹{((b.budget_paise ? b.budget_paise / 100 : b.budget) || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={b.status} />
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (setSelectedBookingId) setSelectedBookingId(b.id);
                          navigate(`/organizer/negotiate?booking_id=${b.id}`);
                        }}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#FFF7ED',
                          color: '#C2410C',
                          border: '1px solid #FFEDD5',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginRight: '8px',
                        }}
                      >
                        Negotiate
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (setSelectedBookingId) setSelectedBookingId(b.id);
                          navigate(`/organizer/payment?booking_id=${b.id}`);
                        }}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#F0FDF4',
                          color: '#15803D',
                          border: '1px solid #BBF7D0',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

