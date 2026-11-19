import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUser } from '../auth';

export default function UnauthorizedView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = getUser();
  const attempted = searchParams.get('attempted') || 'the requested';

  const userRole = user?.role || 'GUEST';
  const myPortal =
    userRole === 'ORGANIZER'
      ? '/organizer'
      : userRole === 'ARTIST'
      ? '/artist'
      : userRole === 'OPERATOR' || userRole === 'COORDINATOR'
      ? '/operator'
      : '/login';

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FAF8F4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Noto Sans', sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          backgroundColor: '#FFFFFF',
          border: '2px solid #E5E7EB',
          borderRadius: '20px',
          padding: '48px 36px',
          textAlign: 'center',
          boxShadow: '0 8px 28px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            fontSize: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          🚫
        </div>

        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 12px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          Access Not Allowed
        </h1>

        <p style={{ fontSize: '16px', color: '#525866', lineHeight: 1.6, margin: '0 0 24px 0' }}>
          You tried to access <strong>{attempted}</strong> portal, but your current account is registered as{' '}
          <span
            style={{
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              fontWeight: 800,
              fontSize: '14px',
            }}
          >
            {userRole}
          </span>
          . Each role in Dharohar has its own dedicated portal to protect privacy and workflow integrity.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <button
              type="button"
              onClick={() => navigate(myPortal)}
              style={{
                padding: '12px 24px',
                backgroundColor: '#C2410C',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              Go to Your {userRole} Portal →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#C2410C',
                color: '#FFFFFF',
                borderRadius: '10px',
                border: 'none',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              Sign In to Your Account →
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 20px',
              backgroundColor: '#FAF8F4',
              color: '#141B2D',
              border: '1px solid #D1D5DB',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Switch Account
          </button>
        </div>
      </div>
    </div>
  );
}
