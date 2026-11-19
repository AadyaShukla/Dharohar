import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { getToken, getUser, clearSession } from '../../auth';
import { getBookings, logoutUser } from '../../api';
import { AnimatedDiya } from '../../components/shared/CulturalMotifs';
import OrganizerProfileModal from '../../components/OrganizerProfileModal';

export default function OrganizerShell() {
  const user = getUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [bookings, setBookings] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [textScale, setTextScale] = useState(() => {
    return Number(localStorage.getItem('dharohar_text_scale') || 1.0);
  });

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    try {
      const data = await getBookings();
      if (Array.isArray(data) && data.length > 0) {
        setBookings(data);
        if (!selectedBookingId) {
          setSelectedBookingId(data[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load organizer bookings:', err);
    }
  }

  function handleZoom(delta) {
    const next = Math.max(0.9, Math.min(1.3, Number((textScale + delta).toFixed(2))));
    setTextScale(next);
    document.documentElement.style.fontSize = `${16 * next}px`;
    localStorage.setItem('dharohar_text_scale', String(next));
  }

  async function handleLogout() {
    try {
      await logoutUser();
    } catch (_) {}
    clearSession();
    navigate('/login');
  }

  const navItems = [
    { path: '/organizer', label: 'Dashboard', icon: '📊', end: true },
    { path: '/organizer/search', label: 'Find Artists', icon: '🔍' },
    { path: '/organizer/negotiate', label: 'Negotiation', icon: '🤝' },
    { path: '/organizer/bookings', label: 'My Bookings', icon: '📜' },
    { path: '/organizer/payment', label: 'TrustPay Payment', icon: '💳' },
    { path: '/organizer/disputes', label: 'Disputes & Ratings', icon: '⚖️' },
    { path: '/organizer/audit', label: 'Audit Trail', icon: '🛡️' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FAF8F4', color: '#1F1A14', fontFamily: "'Noto Sans', sans-serif" }}>
      {/* Simulation Banner */}
      <div style={{ backgroundColor: '#FEF3C7', borderBottom: '1px solid #FCD34D', padding: '6px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#92400E', letterSpacing: '0.5px' }}>
        ★ SIMULATED PAYMENT PLATFORM — ESCROW IS SIMULATED FOR FOLK ARTISTS ★
      </div>

      {/* Top Desktop Navigation Bar */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1.5px solid #E5E7EB',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            onClick={() => navigate('/organizer')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            title="Dharohar Organizer Portal"
          >
            <AnimatedDiya size={34} />
            <div>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#C2410C', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                धरोहर • Dharohar
              </span>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Organizer Workspace
              </span>
            </div>
          </div>

          {/* Active Booking Switcher */}
          {bookings.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#FFF7ED',
                border: '1px solid #FFEDD5',
                borderRadius: '8px',
                padding: '4px 12px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#9A3412' }}>Booking:</span>
              <select
                value={selectedBookingId}
                onChange={(e) => {
                  setSelectedBookingId(e.target.value);
                  // Update current view if on negotiate/payment/audit with ID
                  if (location.pathname.includes('/negotiate')) {
                    navigate(`/organizer/negotiate?booking_id=${e.target.value}`);
                  } else if (location.pathname.includes('/payment')) {
                    navigate(`/organizer/payment?booking_id=${e.target.value}`);
                  } else if (location.pathname.includes('/audit')) {
                    navigate(`/organizer/audit?booking_id=${e.target.value}`);
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#C2410C',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    #{b.id.slice(0, 10)} — {b.art_form_requested || 'Folk Show'} ({b.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right Header Utilities: User, Org Profile, Zoom, Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Text Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#F3EDE4', padding: '2px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#525866' }}>Text:</span>
            <button
              type="button"
              onClick={() => handleZoom(-0.1)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', padding: '2px 6px', fontSize: '13px' }}
              title="Decrease text size"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => handleZoom(0.1)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 'bold', padding: '2px 6px', fontSize: '13px' }}
              title="Increase text size"
            >
              A+
            </button>
          </div>

          {/* Org Profile Trigger */}
          <button
            type="button"
            onClick={() => setIsOrgModalOpen(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#FFFBEB',
              color: '#B45309',
              border: '1px solid #FDE68A',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            🏢 Org Profile
          </button>

          {/* User Profile Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1F1A14' }}>
                {user?.name || 'Organizer'}
              </div>
              <div style={{ fontSize: '11px', color: '#1E3A8A', fontWeight: 600 }}>
                {user?.organization_name || 'Verified Patron'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: '6px 12px',
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Sign out of Dharohar"
            >
              Logout ✕
            </button>
          </div>
        </div>
      </header>

      {/* Main Body with Sidebar + Content */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Left Desktop Sidebar Navigation */}
        <aside
          style={{
            width: '240px',
            backgroundColor: '#FFFFFF',
            borderRight: '1.5px solid #E5E7EB',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <div style={{ padding: '0 8px 12px', fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Organizer Menu
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 14px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: isActive ? 700 : 500,
                textDecoration: 'none',
                color: isActive ? '#FFFFFF' : '#374151',
                backgroundColor: isActive ? '#C2410C' : 'transparent',
                transition: 'all 0.15s ease',
              })}
            >
              <span style={{ fontSize: '18px' }} aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #F3F4F6', fontSize: '12px', color: '#6B7280', textAlign: 'center' }}>
            <span>🔒 Direct TrustPay Escrow</span>
            <br />
            <span>Preserving 2,000+ Folk Traditions</span>
          </div>
        </aside>

        {/* Content Outlet */}
        <main style={{ flex: 1, padding: '32px 40px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
          <Outlet context={{ selectedBookingId, setSelectedBookingId, reloadBookings: loadBookings }} />
        </main>
      </div>

      {/* Organizer Profile Modal */}
      <OrganizerProfileModal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
      />
    </div>
  );
}

