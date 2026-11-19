import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getUser, clearSession } from '../../auth';
import { logoutUser } from '../../api';
import { AnimatedDiya } from '../../components/shared/CulturalMotifs';

export default function OperatorShell() {
  const user = getUser();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logoutUser();
    } catch (_) {}
    clearSession();
    navigate('/login');
  }

  const navItems = [
    { path: '/operator', label: 'Review Queue', icon: '🛡️', end: true },
    { path: '/operator/vouch', label: 'Coordinator Vouches', icon: '📜' },
    { path: '/operator/notifications', label: 'Failed Notifications', icon: '🔔' },
    { path: '/operator/demo', label: 'Demo Control Center', icon: '🎮' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FAF8F4', color: '#1F1A14', fontFamily: "'Noto Sans', sans-serif" }}>
      {/* Simulation Banner */}
      <div style={{ backgroundColor: '#FEF3C7', borderBottom: '1px solid #FCD34D', padding: '6px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#92400E' }}>
        ★ PLATFORM OPERATOR &amp; AUDIT SHELL — ROOT GOVERNANCE ★
      </div>

      {/* Header */}
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1.5px solid #E5E7EB',
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AnimatedDiya size={34} />
          <div>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#1E3A8A', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              धरोहर • Operator Console
            </span>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Verification, TrustPay Governance &amp; Coordinator Oversight
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
            {user?.name || 'Operator'} ({user?.role || 'OPERATOR'})
          </div>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '6px 14px',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Logout ✕
          </button>
        </div>
      </header>

      {/* Operator Tabs */}
      <nav
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          padding: '0 28px',
          display: 'flex',
          gap: '8px',
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 18px',
              borderBottom: isActive ? '3px solid #1E3A8A' : '3px solid transparent',
              color: isActive ? '#1E3A8A' : '#6B7280',
              fontWeight: isActive ? 700 : 500,
              textDecoration: 'none',
              fontSize: '14.5px',
            })}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px 28px', maxWidth: '1320px', margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
}

