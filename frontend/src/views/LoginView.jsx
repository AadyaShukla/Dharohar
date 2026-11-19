import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoginScreen from '../components/LoginScreen';

export default function LoginView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  function handleLoginSuccess(user) {
    if (redirectParam && redirectParam.startsWith('/')) {
      // Validate role for destination
      if (redirectParam.startsWith('/organizer') && user.role === 'ORGANIZER') {
        navigate(redirectParam);
        return;
      }
      if (redirectParam.startsWith('/artist') && user.role === 'ARTIST') {
        navigate(redirectParam);
        return;
      }
      if (redirectParam.startsWith('/operator') && (user.role === 'OPERATOR' || user.role === 'COORDINATOR')) {
        navigate(redirectParam);
        return;
      }
    }

    // Role-based redirection
    if (user.role === 'ORGANIZER') {
      navigate('/organizer');
    } else if (user.role === 'ARTIST') {
      navigate('/artist');
    } else if (user.role === 'OPERATOR') {
      navigate('/operator');
    } else if (user.role === 'COORDINATOR') {
      navigate('/operator/vouch');
    } else {
      navigate('/');
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF8F4', padding: '24px 16px' }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#C2410C',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ← Return to Dharohar Home
        </button>

        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </div>
    </div>
  );
}
