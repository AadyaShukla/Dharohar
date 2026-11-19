import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getUser, clearSession } from '../../auth';
import { getMyArtistProfile, getBookings, logoutUser } from '../../api';
import { AnimatedDiya } from '../../components/shared/CulturalMotifs';

export default function ArtistShell() {
  const user = getUser();
  const navigate = useNavigate();

  // Language State: 'hi' (Hindi) or 'en' (English) - default 'hi' for artist portal
  const [lang, setLang] = useState(() => localStorage.getItem('dharohar_artist_lang') || 'hi');
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('dharohar_artist_lang', lang);
  }, [lang]);

  useEffect(() => {
    loadArtistData();
  }, []);

  async function loadArtistData() {
    setLoading(true);
    try {
      const [profData, allBookings] = await Promise.all([
        getMyArtistProfile().catch(() => null),
        getBookings().catch(() => []),
      ]);
      setProfile(profData);
      setBookings(allBookings || []);
    } catch (err) {
      console.warn('Failed to load artist shell data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
    } catch (_) {}
    clearSession();
    navigate('/login');
  }

  const artistId = profile?.id || user?.artist_id || '';

  // Filter offers for this artist only
  const myOffers = bookings.filter((b) => {
    if (!artistId) return true;
    if (b.artist_id === artistId) return true;
    if (b.negotiated_roles) {
      return Object.values(b.negotiated_roles).some((r) => r.artist_id === artistId);
    }
    if (b.standby_candidates) {
      return Object.values(b.standby_candidates).some((list) =>
        Array.isArray(list) && list.some((c) => c.artist_id === artistId)
      );
    }
    return false;
  });

  const pendingOffersCount = myOffers.filter((b) => {
    const isApproved = b.artist_approvals?.[artistId] === 'APPROVED';
    const isDeclined = b.artist_approvals?.[artistId] === 'DECLINED';
    return !isApproved && !isDeclined && b.status === 'AWAITING_ARTIST_APPROVAL';
  }).length;

  // Nav Items
  const navItems = [
    { path: '/artist', label: lang === 'hi' ? 'गृह' : 'Home', icon: '🏠', end: true },
    {
      path: '/artist/offers',
      label: lang === 'hi' ? 'प्रस्ताव' : 'Offers',
      icon: '📩',
      badge: pendingOffersCount > 0 ? pendingOffersCount : null,
    },
    { path: '/artist/rules', label: lang === 'hi' ? 'नियम' : 'Rules', icon: '⚙️' },
    { path: '/artist/calendar', label: lang === 'hi' ? 'कैलेंडर' : 'Calendar', icon: '📅' },
    { path: '/artist/earnings', label: lang === 'hi' ? 'कमाई' : 'Earnings', icon: '💰' },
    { path: '/artist/profile', label: lang === 'hi' ? 'प्रोफ़ाइल' : 'Profile', icon: '👤' },
    { path: '/artist/statement', label: lang === 'hi' ? 'स्टेटमेंट' : 'Statement', icon: '📄' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FFFDF9',
        color: '#1F1A14',
        fontFamily: "'Noto Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Simulation Banner */}
      <div
        style={{
          backgroundColor: '#FEF3C7',
          borderBottom: '1px solid #FCD34D',
          padding: '6px 12px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#92400E',
        }}
      >
        ★ {lang === 'hi' ? 'सिम्युलेटेड टेस्ट पोर्टल — कलाकार सुरक्षा' : 'SIMULATED DATA — FAIR ARTIST ESCROW'} ★
      </div>

      {/* Top Mobile-First App Bar */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '2px solid #FDBA74',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: '0 2px 8px rgba(234, 88, 12, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AnimatedDiya size={36} />
          <div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#C2410C', fontFamily: "'Cormorant Garamond', Georgia, serif", lineHeight: 1.1 }}>
              {profile?.name || user?.name || 'कलाकार साथी'}
            </div>
            <div style={{ fontSize: '12px', color: '#15803D', fontWeight: 700 }}>
              ● {profile?.art_form || 'लोक कलाकार (Verified Folk Artist)'}
            </div>
          </div>
        </div>

        {/* Right Controls: Hindi/English Toggle & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
            style={{
              padding: '6px 12px',
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              border: '1.5px solid #F59E0B',
              borderRadius: '20px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Toggle Language / भाषा बदलें"
          >
            🌐 {lang === 'hi' ? 'English' : 'हिंदी'}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '6px 10px',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Logout / लॉग आउट"
          >
            ✕
          </button>
        </div>
      </header>

      {/* Main Container - Centered Mobile-First Width */}
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '680px',
          margin: '0 auto',
          padding: '20px 16px 88px', // Bottom padding for sticky mobile nav
        }}
      >
        <Outlet context={{ lang, profile, artistId, myOffers, reloadArtistData: loadArtistData }} />
      </main>

      {/* Sticky Bottom Navigation Bar (Mobile-First Touch Target >= 54px) */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          borderTop: '2px solid #E5E7EB',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '6px 8px 10px',
          zIndex: 50,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
          maxWidth: '680px',
          margin: '0 auto',
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '52px',
              height: '52px',
              textDecoration: 'none',
              borderRadius: '10px',
              color: isActive ? '#C2410C' : '#6B7280',
              backgroundColor: isActive ? '#FFF7ED' : 'transparent',
              fontWeight: isActive ? 700 : 500,
              fontSize: '11.5px',
              position: 'relative',
              transition: 'all 0.15s ease',
            })}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
            <span style={{ marginTop: '2px' }}>{item.label}</span>
            {item.badge && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '6px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  borderRadius: '9999px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  minWidth: '16px',
                  textAlign: 'center',
                }}
              >
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

