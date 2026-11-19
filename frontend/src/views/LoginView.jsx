import React from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import LoginScreen from '../components/LoginScreen';

export default function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const isRegister = location.pathname.includes('/register');

  function handleLoginSuccess(user) {
    if (redirectParam && redirectParam.startsWith('/')) {
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
    <LoginScreen
      onLoginSuccess={handleLoginSuccess}
      onBack={() => navigate('/')}
      initialMode={isRegister ? 'register' : 'login'}
    />
  );
}
