import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { getToken, getUser } from '../../auth';

export default function RoleGuard({ allowedRoles = [], children }) {
  const token = getToken();
  const user = getUser();
  const location = useLocation();

  if (!token || !user) {
    // Not logged in -> send to login with redirect back
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const userRole = user.role;
  const isAllowed = allowedRoles.includes(userRole);

  if (!isAllowed) {
    const portalDest =
      userRole === 'ORGANIZER'
        ? '/organizer'
        : userRole === 'ARTIST'
        ? '/artist'
        : '/operator';

    return (
      <div
        style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#FAF8F4',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            backgroundColor: '#FFFFFF',
            border: '2px solid #E5E7EB',
            borderRadius: '16px',
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            🚫
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#141B2D', marginBottom: '12px', fontFamily: "'Cormorant Garamond', serif" }}>
            Access Not Allowed
          </h2>
          <p style={{ fontSize: '16px', color: '#525866', lineHeight: '1.6', marginBottom: '20px' }}>
            This portal is restricted to <strong>{allowedRoles.join(' or ')}</strong> accounts only.
            You are currently signed in as <strong>{user.name}</strong> with role{' '}
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                fontWeight: 'bold',
                fontSize: '13px',
              }}
            >
              {userRole}
            </span>
            .
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to={portalDest}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: '#B45309',
                color: '#FFFFFF',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '15px',
              }}
            >
              Go to Your {userRole === 'ORGANIZER' ? 'Organizer' : userRole === 'ARTIST' ? 'Artist' : 'Operator'} Portal →
            </Link>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '12px 20px',
                backgroundColor: '#F3EDE4',
                color: '#141B2D',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '15px',
              }}
            >
              Switch Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
