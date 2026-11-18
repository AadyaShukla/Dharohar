import React, { useState } from 'react';
import { checkBookingExpiry, reconfirmStandby } from '../api';
import Diya from './folk/Diya';

const LIFECYCLE_STEPS = [
  { key: 'REQUESTED', label: '1. Requested', desc: 'Booking offer created' },
  { key: 'NEGOTIATING', label: '2. Negotiating', desc: 'Multi-agent evaluation' },
  { key: 'AWAITING_ARTIST_APPROVAL', label: '3. Artist Approval', desc: '24h human confirmation' },
  { key: 'PAID', label: '4. Escrow Funded', desc: 'TrustPay lock & venue revealed' },
  { key: 'PERFORMED', label: '5. Performed', desc: 'Event check-in verified' },
  { key: 'SETTLED', label: '6. Settled', desc: 'Payout released to artist' },
];

export default function BookingTimeline({ booking, currentUser, onRefresh }) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (!booking) return null;

  const currentStatus = booking.status || 'REQUESTED';
  const isArtist = currentUser?.role === 'ARTIST';
  const isOrganizer = currentUser?.role === 'ORGANIZER';
  const isOperator = currentUser?.role === 'OPERATOR';

  const isPaidOrBeyond = ['PAID', 'PERFORMED', 'SETTLED'].includes(currentStatus);

  // Compute active step index
  function getStepIndex(status) {
    if (status === 'REQUESTED') return 0;
    if (status === 'NEGOTIATING') return 1;
    if (status === 'AWAITING_ARTIST_APPROVAL' || status === 'NEEDS_ORGANIZER_APPROVAL') return 2;
    if (status === 'APPROVED' || status === 'PAID') return 3;
    if (status === 'PERFORMED') return 4;
    if (status === 'SETTLED' || status === 'CLOSED') return 5;
    return 1;
  }

  const currentStepIdx = getStepIndex(currentStatus);

  async function handleCheckExpiry() {
    setLoadingAction(true);
    setFeedback(null);
    try {
      const res = await checkBookingExpiry(booking.id, true);
      setFeedback(`Expiry checked: ${res.booking_status}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedback(`Expiry check failed: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleReconfirmStandby() {
    setLoadingAction(true);
    setFeedback(null);
    try {
      const res = await reconfirmStandby(booking.id, true);
      setFeedback(`Standbys notified: ${res.candidates_notified || 0} candidate(s)`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedback(`Standby reconfirmation failed: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  }

  const standbys = booking.standby_candidates || {};
  const hasStandbys = Object.keys(standbys).length > 0;

  return (
    <div
      style={{
        backgroundColor: '#FFFDF9',
        border: '2px solid #C4A482',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '20px',
        fontFamily: "'Noto Sans', sans-serif",
        color: '#1F1A14',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px dashed #D97706',
          paddingBottom: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Diya />
          <h3
            style={{
              margin: 0,
              fontFamily: "'Yatra One', cursive",
              fontSize: '20px',
              color: '#8B2500',
            }}
          >
            Booking Status Timeline & Lifecycle
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontWeight: 'bold',
              fontSize: '14px',
              backgroundColor: isPaidOrBeyond ? '#ECFDF5' : '#FFFBEB',
              color: isPaidOrBeyond ? '#166534' : '#B45309',
              border: `1px solid ${isPaidOrBeyond ? '#166534' : '#D97706'}`,
            }}
          >
            Status: {currentStatus}
          </span>
          {booking.approval_expires_at && !isPaidOrBeyond && (
            <span
              style={{
                fontSize: '13px',
                color: '#6B5E4F',
                backgroundColor: '#F3EDE4',
                padding: '4px 10px',
                borderRadius: '4px',
              }}
            >
              Approval Expiry: {new Date(booking.approval_expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {feedback && (
        <div
          style={{
            backgroundColor: '#EFF6FF',
            border: '1px solid #3B82F6',
            color: '#1E3A8A',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {feedback}
        </div>
      )}

      {/* Progress Bar / Stepper */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        {LIFECYCLE_STEPS.map((step, idx) => {
          const isCompleted = idx < currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          return (
            <div
              key={step.key}
              style={{
                backgroundColor: isCurrent ? '#FFFBEB' : isCompleted ? '#ECFDF5' : '#F9F6F0',
                border: `2px solid ${isCurrent ? '#D97706' : isCompleted ? '#166534' : '#E5D5C5'}`,
                borderRadius: '8px',
                padding: '10px',
                textAlign: 'center',
                boxShadow: isCurrent ? '0 2px 8px rgba(217,119,6,0.2)' : 'none',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: isCurrent ? '#B45309' : isCompleted ? '#166534' : '#6B5E4F',
                }}
              >
                {step.label}
              </div>
              <div style={{ fontSize: '12px', color: '#6B5E4F', marginTop: '4px' }}>
                {step.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Venue Address & Privacy Gate Box */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: `2px solid ${isPaidOrBeyond ? '#166534' : '#D97706'}`,
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontSize: '16px', color: '#8B2500' }}>
            📍 Venue Address & Organizer Contact
          </strong>
          <span
            style={{
              fontSize: '13px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 'bold',
              backgroundColor: isPaidOrBeyond ? '#ECFDF5' : '#FEF3C7',
              color: isPaidOrBeyond ? '#166534' : '#92400E',
            }}
          >
            {isPaidOrBeyond ? '🔓 Disclosed (Escrow Paid)' : '🔒 Hidden from Artists'}
          </span>
        </div>
        <div style={{ fontSize: '15px', color: '#1F1A14', marginBottom: '6px' }}>
          <strong>Venue:</strong>{' '}
          {booking.venue_address || 'City Palace Courtyard, Udaipur'}
        </div>
        <div style={{ fontSize: '14px', color: '#4A3E31' }}>
          <strong>Organizer:</strong> {booking.organizer_name}
          {booking.organizer_phone && ` • Phone: ${booking.organizer_phone}`}
          {booking.organizer_email && ` • Email: ${booking.organizer_email}`}
        </div>
      </div>

      {/* Standby Candidates & Expiry Controls */}
      <div
        style={{
          backgroundColor: '#FDFBF7',
          border: '1px solid #E5D5C5',
          borderRadius: '8px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <strong style={{ color: '#8B2500' }}>👥 Standby Replacements:</strong>
            <span style={{ fontSize: '14px', color: '#4A3E31', marginLeft: '6px' }}>
              {hasStandbys
                ? Object.entries(standbys)
                    .map(([role, list]) => `${role}: ${list.length} standby(s)`)
                    .join(' | ')
                : 'Auto-standbys persisted on negotiation'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* 72h Standby Reconfirmation Button */}
            <button
              onClick={handleReconfirmStandby}
              disabled={loadingAction}
              style={{
                backgroundColor: booking.standby_reconfirmed ? '#ECFDF5' : '#F3EDE4',
                border: `1px solid ${booking.standby_reconfirmed ? '#166534' : '#C4A482'}`,
                color: booking.standby_reconfirmed ? '#166534' : '#4A3E31',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: loadingAction ? 'not-allowed' : 'pointer',
              }}
            >
              {booking.standby_reconfirmed
                ? '✓ 72h Standby Reconfirmed'
                : 'Reconfirm Standbys (72h)'}
            </button>

            {/* Check Expiry Button */}
            {!isPaidOrBeyond && (
              <button
                onClick={handleCheckExpiry}
                disabled={loadingAction}
                style={{
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #D97706',
                  color: '#B45309',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: loadingAction ? 'not-allowed' : 'pointer',
                }}
              >
                Check Expiry / Next Candidate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
