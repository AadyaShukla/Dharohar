import React, { useState, useEffect } from 'react';
import ArtistSearchPage from './components/ArtistSearchPage';
import OrganizerChat from './components/OrganizerChat';
import ArtistApprovalPanel from './components/ArtistApprovalPanel';
import TrustPayTracker from './components/TrustPayTracker';
import AuditLogView from './components/AuditLogView';
import ArtistProfileWrapper from './components/ArtistProfileWrapper';
import OperatorReviewQueue from './components/OperatorReviewQueue';
import CoordinatorVouchPanel from './components/CoordinatorVouchPanel';
import OrganizerProfileModal from './components/OrganizerProfileModal';
import LoginScreen from './components/LoginScreen';
import Toran from './components/folk/Toran';
import Marigolds from './components/folk/Marigolds';
import Diya from './components/folk/Diya';
import PaisleyBorder from './components/folk/PaisleyBorder';
import { seed, runDemoScenario, setLlmProvider, getLlmProvider, logoutUser } from './api';
import { getUser, getToken, clearSession } from './auth';

const ALL_TABS = [
  {
    id: 'artist_search',
    label: 'Artist Discovery & Search',
    icon: '🔍',
    component: ArtistSearchPage,
    roles: ['ORGANIZER', 'OPERATOR'],
  },
  {
    id: 'organizer',
    label: 'Organizer Chat',
    icon: '🏛️',
    component: OrganizerChat,
    roles: ['ORGANIZER', 'OPERATOR'],
  },
  {
    id: 'artist_profile',
    label: 'Artist Profile & Onboarding',
    icon: '🪕',
    component: ArtistProfileWrapper,
    roles: ['ARTIST', 'OPERATOR'],
  },
  {
    id: 'approval',
    label: 'Artist Approval Panel',
    icon: '📝',
    component: ArtistApprovalPanel,
    roles: ['ARTIST', 'OPERATOR'],
  },
  {
    id: 'operator_review',
    label: 'Review Queue',
    icon: '🛡️',
    component: OperatorReviewQueue,
    roles: ['OPERATOR'],
  },
  {
    id: 'coordinator_vouch',
    label: 'Coordinator Vouches',
    icon: '📜',
    component: CoordinatorVouchPanel,
    roles: ['COORDINATOR', 'OPERATOR'],
  },
  {
    id: 'trustpay',
    label: 'TrustPay Tracker',
    icon: '🔒',
    component: TrustPayTracker,
    roles: ['ORGANIZER', 'ARTIST', 'OPERATOR', 'COORDINATOR'],
  },
  {
    id: 'audit',
    label: 'Audit Log View',
    icon: '📜',
    component: AuditLogView,
    roles: ['ORGANIZER', 'ARTIST', 'OPERATOR', 'COORDINATOR'],
  },
];

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const token = getToken();
    const user = getUser();
    return token && user ? user : null;
  });

  const [sessionNotice, setSessionNotice] = useState(null);

  // App Navigation & Booking State
  const [activeTab, setActiveTab] = useState('organizer');
  const [bookingId, setBookingId] = useState('');
  const [booking, setBooking] = useState(null);
  const [seedNotice, setSeedNotice] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [providerMode, setProviderMode] = useState('scripted');
  const [isOrgProfileOpen, setIsOrgProfileOpen] = useState(false);

  // Text Scaling Accessibility (16px base, scalable)
  const [textScale, setTextScale] = useState(() => {
    const saved = localStorage.getItem('dharohar_text_scale');
    return saved ? Number(saved) : 1.0;
  });

  // Reduce Motion Accessibility
  const [reduceMotion, setReduceMotion] = useState(() => {
    return localStorage.getItem('dharohar_reduce_motion') === 'true';
  });

  // Sync reduced motion class on root HTML
  useEffect(() => {
    if (reduceMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
    localStorage.setItem('dharohar_reduce_motion', String(reduceMotion));
  }, [reduceMotion]);

  // Sync text scale class on root HTML
  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * textScale}px`;
    localStorage.setItem('dharohar_text_scale', String(textScale));
  }, [textScale]);

  // Listen for 401 Session Expiration custom event
  useEffect(() => {
    function handleSessionExpired(event) {
      const msg = event.detail?.message || 'Session expired, please log in again.';
      setCurrentUser(null);
      setSessionNotice(msg);
    }
    window.addEventListener('dharohar:auth_expired', handleSessionExpired);
    return () => window.removeEventListener('dharohar:auth_expired', handleSessionExpired);
  }, []);

  // Sync provider mode on mount
  useEffect(() => {
    if (currentUser) {
      getLlmProvider()
        .then((data) => {
          if (data && data.provider) {
            setProviderMode(data.provider);
          }
        })
        .catch(() => {});
    }
  }, [currentUser]);

  // Compute available tabs according to logged-in user role
  const userRole = currentUser?.role || 'ORGANIZER';
  const visibleTabs = ALL_TABS.filter((tab) => tab.roles.includes(userRole));

  // Ensure active tab is allowed for current role
  useEffect(() => {
    if (currentUser && visibleTabs.length > 0) {
      const isAllowed = visibleTabs.some((t) => t.id === activeTab);
      if (!isAllowed) {
        setActiveTab(visibleTabs[0].id);
      }
    }
  }, [currentUser, userRole]);

  function handleLoginSuccess(user) {
    setCurrentUser(user);
    setSessionNotice(null);
    if (user.role === 'ARTIST') {
      setActiveTab('artist_profile');
    } else if (user.role === 'COORDINATOR') {
      setActiveTab('coordinator_vouch');
    } else if (user.role === 'ORGANIZER') {
      setActiveTab('artist_search');
    } else {
      setActiveTab('organizer');
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
    } catch (_) {}
    clearSession();
    setCurrentUser(null);
    setBookingId('');
    setBooking(null);
    setSessionNotice('Logged out successfully.');
  }

  function handleZoomIn() {
    setTextScale((prev) => Math.min(1.3, Number((prev + 0.1).toFixed(2))));
  }

  function handleZoomOut() {
    setTextScale((prev) => Math.max(0.9, Number((prev - 0.1).toFixed(2))));
  }

  async function handleToggleProvider(newMode) {
    setIsProcessing(true);
    try {
      await setLlmProvider(newMode);
      setProviderMode(newMode);
      setSeedNotice(`LLM Provider set to: ${newMode.toUpperCase()}`);
    } catch (err) {
      setSeedNotice(`Failed to switch provider: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSeed() {
    setIsProcessing(true);
    setSeedNotice(null);
    try {
      const res = await seed();
      setSeedNotice(`Database reset & seeded with ${res.count || 10} fictional folk artists.`);
    } catch (err) {
      setSeedNotice(`Seed failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRunDemoScenario() {
    setIsProcessing(true);
    setSeedNotice(null);
    try {
      const res = await runDemoScenario();
      setBookingId(res.booking_id);
      setSeedNotice(
        `Demo Scenario Loaded! Booking #${res.booking_id} created for Hotel Rajmahal Heritage. Switched to Organizer Chat.`
      );
      setActiveTab('organizer');
    } catch (err) {
      setSeedNotice(`Demo scenario failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  // If not logged in, show Login Screen (folk theme)
  if (!currentUser) {
    return (
      <div className="app-container">
        {/* Background Animated Petals */}
        <Marigolds />

        {/* High-Contrast Stamped Disclaimer Label */}
        <div className="simulation-banner-wrapper">
          <div className="simulation-stamped-label" role="alert">
            <span className="stamp-seal">★</span>
            <span>SIMULATED DATA — NOT REAL PAYMENTS</span>
            <span className="stamp-seal">★</span>
          </div>
        </div>

        {/* Decorative Toran Garland */}
        <Toran />

        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          initialMessage={sessionNotice}
        />

        <footer className="app-footer">
          <PaisleyBorder height={18} />
          <p className="footer-note">
            Dharohar • Simulated Booking & TrustPay Escrow Prototype • Authentic Folk Livelihoods
          </p>
        </footer>
      </div>
    );
  }

  const CurrentComponent =
    visibleTabs.find((tab) => tab.id === activeTab)?.component || visibleTabs[0]?.component;

  const isOperator = currentUser.role === 'OPERATOR';

  return (
    <div className="app-container">
      {/* Background Animated Petals (Opacity 20%, behind cards) */}
      <Marigolds />

      {/* High-Contrast Stamped Disclaimer Label */}
      <div className="simulation-banner-wrapper">
        <div className="simulation-stamped-label" role="alert">
          <span className="stamp-seal">★</span>
          <span>SIMULATED DATA — NOT REAL PAYMENTS</span>
          <span className="stamp-seal">★</span>
        </div>
      </div>

      {/* Decorative Toran Garland */}
      <Toran />

      {/* Main App Header */}
      <header className="app-header folk-header">
        <div className="header-left">
          <div className="brand-lockup">
            <Diya size={40} />
            <div>
              <h1 className="brand-title">धरोहर • Dharohar</h1>
              <p className="app-tagline">
                Book authentic heritage. Keep the money in the village.
              </p>
            </div>
          </div>
        </div>

        <div className="header-right">
          {/* User Profile & Role Chip */}
          <div className="user-profile-badge folk-pill" title={`Logged in as ${currentUser.phone}`}>
            <span className="user-role-icon">
              {currentUser.role === 'ORGANIZER' && '🏛️'}
              {currentUser.role === 'ARTIST' && '🪕'}
              {currentUser.role === 'OPERATOR' && '⚙️'}
            </span>
            <div className="user-profile-meta">
              <span className="user-name"><strong>{currentUser.name}</strong></span>
              <span className="user-role-tag">{currentUser.role}</span>
            </div>
            {currentUser.role === 'ORGANIZER' && (
              <button
                type="button"
                className="btn-logout-small"
                style={{ backgroundColor: '#D97706', color: '#FFFFFF', marginRight: '4px' }}
                onClick={() => setIsOrgProfileOpen(true)}
                title="View & Edit Organization Details"
              >
                🏢 Org Profile
              </button>
            )}
            <button
              type="button"
              className="btn-logout-small"
              onClick={handleLogout}
              title="Logout from session"
            >
              Logout ✕
            </button>
          </div>

          {/* Accessibility Controls: Text Sizing (A- / A+) & Reduce Motion */}
          <div className="accessibility-controls-group">
            <div className="text-size-controls" title="Adjust text size">
              <span className="control-label">Text:</span>
              <button
                type="button"
                className="btn-a-toggle"
                onClick={handleZoomOut}
                disabled={textScale <= 0.9}
                aria-label="Decrease text size"
              >
                A-
              </button>
              <button
                type="button"
                className="btn-a-toggle"
                onClick={handleZoomIn}
                disabled={textScale >= 1.3}
                aria-label="Increase text size"
              >
                A+
              </button>
            </div>

            <button
              type="button"
              className={`btn-motion-toggle ${reduceMotion ? 'active' : ''}`}
              onClick={() => setReduceMotion((prev) => !prev)}
              title="Pause or enable looping animations"
              aria-pressed={reduceMotion}
            >
              {reduceMotion ? '▶ Motion Off' : '⏸ Reduce Motion'}
            </button>
          </div>

          {/* Active Booking Identifier */}
          {bookingId && (
            <div className="active-booking-pill folk-pill">
              <span className="pill-dot"></span> Booking: <strong>#{bookingId}</strong>
            </div>
          )}

          {/* Operator Demo Controls: Visible ONLY to OPERATOR */}
          {isOperator && (
            <>
              {/* Provider Toggle: Live AI vs Scripted */}
              <div className="provider-toggle-group folk-toggle" title="Operator: Select LLM Provider">
                <span className="toggle-label">Mode:</span>
                <button
                  type="button"
                  className={`btn-toggle ${providerMode === 'scripted' ? 'active' : ''}`}
                  onClick={() => handleToggleProvider('scripted')}
                  disabled={isProcessing}
                >
                  Scripted
                </button>
                <button
                  type="button"
                  className={`btn-toggle ${providerMode !== 'scripted' ? 'active' : ''}`}
                  onClick={() => handleToggleProvider('gemini')}
                  disabled={isProcessing}
                >
                  Live AI
                </button>
              </div>

              {/* One-Click Demo Scenario Button */}
              <button
                type="button"
                className="btn-demo-scenario-top folk-btn-primary"
                onClick={handleRunDemoScenario}
                disabled={isProcessing}
              >
                🎬 Run Demo Scenario
              </button>

              <button
                type="button"
                className="btn-seed folk-btn-secondary"
                onClick={handleSeed}
                disabled={isProcessing}
              >
                Reset DB
              </button>
            </>
          )}
        </div>
      </header>

      {/* Decorative Divider */}
      <PaisleyBorder height={22} />

      {seedNotice && (
        <div className="seed-notification folk-notification">
          <span>🔔 {seedNotice}</span>
          <button type="button" onClick={() => setSeedNotice(null)} aria-label="Close notification">
            ✕
          </button>
        </div>
      )}

      {/* Tab Bar: Painted Wooden Signboards with 24px+ Yatra One Tab Names */}
      <nav className="tab-navigation wooden-signboard-nav" aria-label="Main sections">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`wooden-tab-sign ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-title-yatra">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Tab Content Card */}
      <main className="tab-content folk-main-content">
        {CurrentComponent && (
          <CurrentComponent
            bookingId={bookingId}
            setBookingId={setBookingId}
            booking={booking}
            setBooking={setBooking}
            currentUser={currentUser}
            onRunDemoScenario={isOperator ? handleRunDemoScenario : undefined}
            onBookingCreated={(newBooking, negResult) => {
              setBookingId(newBooking.id);
              setBooking(newBooking);
              setActiveTab('organizer');
            }}
          />
        )}
      </main>

      {/* Organizer Profile Modal */}
      {currentUser.role === 'ORGANIZER' && (
        <OrganizerProfileModal
          isOpen={isOrgProfileOpen}
          onClose={() => setIsOrgProfileOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="app-footer">
        <PaisleyBorder height={18} />
        <p className="footer-note">
          Dharohar • Simulated Booking & TrustPay Escrow Prototype • Authentic Folk Livelihoods
        </p>
      </footer>
    </div>
  );
}
