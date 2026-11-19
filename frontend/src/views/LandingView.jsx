import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingPage from '../components/LandingPage';
import { quickLoginAs, runDemoScenario } from '../api';
import { getUser } from '../auth';

export default function LandingView() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleQuickLogin(targetPhone) {
    setIsProcessing(true);
    try {
      const user = await quickLoginAs(targetPhone);
      if (user.role === 'ORGANIZER') {
        navigate('/organizer');
      } else if (user.role === 'ARTIST') {
        navigate('/artist');
      } else if (user.role === 'OPERATOR') {
        navigate('/operator');
      } else if (user.role === 'COORDINATOR') {
        navigate('/operator/vouch');
      } else {
        navigate('/login');
      }
    } catch (err) {
      alert(`Quick login failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRunDemo() {
    setIsProcessing(true);
    try {
      const currentUser = getUser();
      if (!currentUser || currentUser.role !== 'ORGANIZER') {
        await quickLoginAs('9000000099');
      }
      const res = await runDemoScenario();
      navigate(`/organizer/negotiate?booking_id=${res.booking_id}`);
    } catch (err) {
      alert(`Demo launch failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FAF8F4' }}>
      <LandingPage
        onExploreArtists={() => navigate('/organizer/search')}
        onStartBooking={() => navigate('/login')}
        onQuickLogin={handleQuickLogin}
        onRunDemo={handleRunDemo}
        isProcessing={isProcessing}
      />
    </div>
  );
}
