import React, { useState, useEffect } from 'react';
import {
  seed,
  runDemoScenario,
  setLlmProvider,
  getLlmProvider,
  advanceTime,
  failNextPayout,
  createBooking,
  negotiate,
  pay,
  payout,
  artistApprove,
  getBooking,
} from '../api';
import Diya from './folk/Diya';
import TextileBorder from './heritage/TextileBorder';
import CulturalMotif from './heritage/CulturalMotif';

export default function DemoControlCenter({
  onBookingSelected,
  onSwitchTab,
  currentUser,
}) {
  const [provider, setProvider] = useState('scripted');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);

  useEffect(() => {
    getLlmProvider()
      .then((res) => {
        if (res && res.provider) {
          setProvider(res.provider);
        }
      })
      .catch(() => {});
  }, []);

  async function handleToggleProvider(newProvider) {
    setLoading(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await setLlmProvider(newProvider);
      setProvider(newProvider);
      setStatusMsg(`✓ AI Provider successfully switched to: ${newProvider.toUpperCase()}`);
    } catch (err) {
      setErrorMsg(`Failed to switch provider: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetDatabase() {
    setLoading(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await seed();
      setStatusMsg(`✓ Database wiped and freshly seeded with ${res.count || 10} authentic folk artists and baseline accounts.`);
    } catch (err) {
      setErrorMsg(`Reset failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // 1. Scenario: Full Happy Path
  async function runHappyPathScenario() {
    setLoading(true);
    setActiveScenario('happy_path');
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const demoRes = await runDemoScenario();
      const bId = demoRes.booking_id;
      if (onBookingSelected) onBookingSelected(bId);

      await artistApprove(bId, 'dance_kalbelia_01').catch(() => {});
      await pay(bId).catch(() => {});

      setStatusMsg(
        `✓ Happy Path executed! Booking #${bId} created, negotiated, approved by artists, and funded in simulated escrow.`
      );
      if (onSwitchTab) onSwitchTab('trustpay');
    } catch (err) {
      setErrorMsg(`Happy Path error: ${err.message}`);
    } finally {
      setLoading(false);
      setActiveScenario(null);
    }
  }

  // 2. Scenario: Multi-Role Extravaganza
  async function runMultiRoleScenario() {
    setLoading(true);
    setActiveScenario('multi_role');
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const payload = {
        organizer_name: 'Jaipur Literature Festival (simulated)',
        event_date: '2026-12-25',
        event_time: '19:00',
        venue_address: 'Diggi Palace, Jaipur',
        budget: 45000,
        distance_km: 40,
        expected_duration_minutes: 180,
        duration_minutes: 180,
        group_size: 15,
        notes: 'Three stage cultural showcase for inaugural festival evening.',
        roles: [
          { role: 'Opening Dance', art_form: 'Ghoomar Dance', budget: 18000 },
          { role: 'Musical Ensemble', art_form: 'Manganiyar Folk Music', budget: 15000 },
          { role: 'Puppetry Display', art_form: 'Kathputli Puppet Theatre', budget: 12000 },
        ],
      };

      const newBooking = await createBooking(payload);
      const negResult = await negotiate(newBooking.id);
      if (onBookingSelected) onBookingSelected(newBooking.id);

      setStatusMsg(
        `✓ Multi-Role Extravaganza created! Booking #${newBooking.id} with 3 distinct folk traditions evaluated. Status: ${negResult.status}.`
      );
      if (onSwitchTab) onSwitchTab('organizer');
    } catch (err) {
      setErrorMsg(`Multi-Role Scenario error: ${err.message}`);
    } finally {
      setLoading(false);
      setActiveScenario(null);
    }
  }

  // 3. Scenario: Lowball Negotiation Resistance
  async function runLowballScenario() {
    setLoading(true);
    setActiveScenario('lowball');
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const payload = {
        organizer_name: 'Corporate Gala (Simulated Low Budget)',
        event_date: '2026-12-15',
        event_time: '20:00',
        venue_address: 'Grand Hyatt Convention Hall, Udaipur',
        budget: 5000, // Deliberately below Kalbelia min fee of ₹12,000
        distance_km: 120,
        expected_duration_minutes: 120,
        duration_minutes: 120,
        group_size: 8,
        notes: 'Seeking 8 artists for 2 hours on low budget.',
        roles: [
          { role: 'Dance Troupe', art_form: 'Kalbelia Dance', budget: 5000 },
        ],
      };

      const newBooking = await createBooking(payload);
      const negResult = await negotiate(newBooking.id);
      if (onBookingSelected) onBookingSelected(newBooking.id);

      setStatusMsg(
        `✓ Fair-Wage Safeguard Demonstrated! Booking #${newBooking.id} received lowball ₹5,000 offer. Artist Representative Agent rejected the predatory fee to protect rural livelihood.`
      );
      if (onSwitchTab) onSwitchTab('organizer');
    } catch (err) {
      setErrorMsg(`Lowball Scenario error: ${err.message}`);
    } finally {
      setLoading(false);
      setActiveScenario(null);
    }
  }

  // 4. Scenario: Advance Time (Simulate Performance Day)
  async function handleAdvanceTime() {
    setLoading(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await advanceTime();
      setStatusMsg(`✓ Time simulation advanced! ${res.message || 'Timers checked and milestones processed.'}`);
    } catch (err) {
      setErrorMsg(`Advance time error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // 5. Scenario: Simulate Escrow Payout Failure (Operator Ticket Trigger)
  async function handleSimulatePayoutFailure() {
    setLoading(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await failNextPayout();
      setStatusMsg(
        '✓ Failure simulated! The very next payout attempt will trigger a simulated bank transfer error and generate an Operator Reconciliation Ticket.'
      );
    } catch (err) {
      setErrorMsg(`Simulate failure error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '24px 16px 48px',
        fontFamily: "'Noto Sans', sans-serif",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          background: '#FFFDF9',
          border: '2px solid var(--dh-border-heritage)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Diya size={40} animated />
          <div>
            <h1
              style={{
                fontFamily: "'Yatra One', cursive",
                fontSize: '28px',
                color: '#6B1717',
                margin: 0,
              }}
            >
              Demo Control Center &amp; Test Suite
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6B5E4F', fontSize: '15px' }}>
              Deterministic showcase runner for judges, evaluators, and system auditors.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDatabase}
          disabled={loading}
          style={{
            backgroundColor: '#FEF2F2',
            border: '2px solid #DC2626',
            color: '#DC2626',
            padding: '10px 18px',
            borderRadius: '8px',
            fontSize: '14.5px',
            fontWeight: 'bold',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          🔄 Reset Database &amp; Seed
        </button>
      </div>

      <TextileBorder height={16} />

      {/* Status Notifications */}
      {statusMsg && (
        <div
          style={{
            backgroundColor: '#ECFDF5',
            border: '1.5px solid #10B981',
            borderRadius: '10px',
            padding: '14px 18px',
            color: '#065F46',
            fontWeight: 600,
            margin: '20px 0',
            fontSize: '15px',
          }}
        >
          {statusMsg}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #EF4444',
            borderRadius: '10px',
            padding: '14px 18px',
            color: '#991B1B',
            fontWeight: 600,
            margin: '20px 0',
            fontSize: '15px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Control Panels Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          margin: '24px 0 32px',
        }}
      >
        {/* Panel 1: AI Negotiation Provider */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid var(--dh-border-heritage)',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '24px' }}>🤖</span>
            <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: 0 }}>
              AI Negotiation Engine
            </h3>
          </div>
          <p style={{ fontSize: '14px', color: '#6B5E4F', margin: '0 0 16px' }}>
            Toggle between the deterministic offline test engine and live Google Gemini AI.
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleToggleProvider('scripted')}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: provider === 'scripted' ? '#6B1717' : '#D1C7BD',
                backgroundColor: provider === 'scripted' ? '#6B1717' : '#FAF5EE',
                color: provider === 'scripted' ? '#FFFFFF' : '#4A3E31',
                cursor: 'pointer',
              }}
            >
              ✓ Scripted (Deterministic)
            </button>

            <button
              type="button"
              onClick={() => handleToggleProvider('gemini')}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: '2px solid',
                borderColor: provider !== 'scripted' ? '#6B1717' : '#D1C7BD',
                backgroundColor: provider !== 'scripted' ? '#6B1717' : '#FAF5EE',
                color: provider !== 'scripted' ? '#FFFFFF' : '#4A3E31',
                cursor: 'pointer',
              }}
            >
              ⚡ Live Gemini AI
            </button>
          </div>
        </div>

        {/* Panel 2: Simulation & Fault Injection */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid var(--dh-border-heritage)',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '24px' }}>⏱️</span>
            <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: 0 }}>
              Time &amp; Fault Simulation
            </h3>
          </div>
          <p style={{ fontSize: '14px', color: '#6B5E4F', margin: '0 0 16px' }}>
            Test expiry checks, standby auto-reconfirmations, and payout failure reconciliation.
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleAdvanceTime}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: '13.5px',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: '1.5px solid #C4A482',
                backgroundColor: '#FAF5EE',
                color: '#4A3E31',
                cursor: 'pointer',
              }}
            >
              ⏩ Advance Time (+24h)
            </button>

            <button
              type="button"
              onClick={handleSimulatePayoutFailure}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px 14px',
                fontSize: '13.5px',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: '1.5px solid #D97706',
                backgroundColor: '#FFFBEB',
                color: '#B45309',
                cursor: 'pointer',
              }}
            >
              ⚠️ Fail Next Payout
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Built Presentation Scenarios */}
      <div
        style={{
          background: '#FFFDF9',
          border: '2px solid var(--dh-border-heritage)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <h3
          style={{
            fontFamily: "'Yatra One', cursive",
            fontSize: '24px',
            color: '#6B1717',
            margin: '0 0 18px',
          }}
        >
          Curated Presentation Scenarios
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Card 1: Happy Path */}
          <div
            style={{
              border: '1.5px solid #E8DCCB',
              borderRadius: '10px',
              padding: '18px',
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '22px' }}>🎯</span>
                <strong style={{ fontSize: '17px', color: '#6B1717' }}>Full Happy Path (Dec 20)</strong>
              </div>
              <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 16px' }}>
                Hotel Rajmahal creates booking &rarr; Kalbelia Dance &amp; Manganiyar Music matched &rarr; artists approve &rarr; ₹25,000 deposited in TrustPay escrow.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              onClick={runHappyPathScenario}
              disabled={loading}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
            >
              {activeScenario === 'happy_path' ? 'Executing...' : 'Run Happy Path'}
            </button>
          </div>

          {/* Card 2: Multi-Role Extravaganza */}
          <div
            style={{
              border: '1.5px solid #E8DCCB',
              borderRadius: '10px',
              padding: '18px',
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '22px' }}>🎭</span>
                <strong style={{ fontSize: '17px', color: '#6B1717' }}>Multi-Role Extravaganza</strong>
              </div>
              <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 16px' }}>
                Jaipur Lit Fest requests 3 roles: Ghoomar Dance, Manganiyar Ensemble &amp; Kathputli Puppets (₹45,000 budget).
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              onClick={runMultiRoleScenario}
              disabled={loading}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
            >
              {activeScenario === 'multi_role' ? 'Executing...' : 'Run Multi-Role'}
            </button>
          </div>

          {/* Card 3: Fair Wage Safeguard (Lowball Rejection) */}
          <div
            style={{
              border: '1.5px solid #E8DCCB',
              borderRadius: '10px',
              padding: '18px',
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '22px' }}>🛡️</span>
                <strong style={{ fontSize: '17px', color: '#6B1717' }}>Fair-Wage Safeguard</strong>
              </div>
              <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 16px' }}>
                Organizer submits ₹5,000 for 8 dancers. The Artist AI automatically rejects the lowball bid and enforces village minimum.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-secondary"
              onClick={runLowballScenario}
              disabled={loading}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px', borderColor: '#B84220', color: '#B84220' }}
            >
              {activeScenario === 'lowball' ? 'Evaluating...' : 'Test Lowball Rejection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
