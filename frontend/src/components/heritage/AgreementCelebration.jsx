import React from 'react';
import Diya from '../folk/Diya';

/**
 * AgreementCelebration
 * Tasteful cultural celebration modal / banner when multi-agent negotiation
 * achieves fair compensation agreement.
 */
export default function AgreementCelebration({
  bookingId,
  finalPrice,
  onProceedToEscrow,
  onClose,
}) {
  return (
    <div
      className="celebration-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(27, 37, 75, 0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px',
        animation: 'celebrationBurst 400ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      role="dialog"
      aria-labelledby="agreement-title"
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #FFFDF9 0%, #FAF5EE 100%)',
          border: '3px solid #C69214',
          borderRadius: '16px',
          padding: '36px 32px',
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 24px 48px rgba(30, 41, 88, 0.28), 0 0 0 4px rgba(198, 146, 20, 0.2)',
          position: 'relative',
        }}
      >
        {/* Floating Gold Petals / Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>✨</span>
          <Diya size={42} animated />
          <span style={{ fontSize: '24px' }}>✨</span>
        </div>

        <span
          style={{
            backgroundColor: '#ECFDF5',
            color: '#15803D',
            border: '1px solid #A7F3D0',
            padding: '4px 14px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          ✓ Multi-Agent Consensus
        </span>

        <h2
          id="agreement-title"
          style={{
            fontFamily: "'Yatra One', cursive",
            fontSize: '30px',
            color: '#6B1717',
            margin: '14px 0 6px',
          }}
        >
          Agreement Reached!
        </h2>

        <p
          style={{
            fontFamily: "'Noto Sans', sans-serif",
            fontSize: '15px',
            color: '#4B5563',
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          Both the Organizer Agent and Artist Representative have reached common ground respecting dignity, travel constraints, and village artisan minimums.
        </p>

        {finalPrice && (
          <div
            style={{
              background: '#FFF8E7',
              border: '2px dashed #C69214',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
            }}
          >
            <div style={{ fontSize: '13px', color: '#8D5B18', fontWeight: 600, textTransform: 'uppercase' }}>
              Final Agreed Compensation
            </div>
            <div
              style={{
                fontFamily: "'Yatra One', cursive",
                fontSize: '34px',
                color: '#B84220',
                margin: '4px 0',
              }}
            >
              ₹{Number(finalPrice).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '12px', color: '#6B5E4F' }}>
              Ready for Artist Human Acceptance &amp; TrustPay Escrow Deposit
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {onProceedToEscrow && (
            <button
              type="button"
              className="folk-btn-primary"
              onClick={onProceedToEscrow}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🔒 Fund TrustPay Escrow
            </button>
          )}

          <button
            type="button"
            className="folk-btn-secondary"
            onClick={onClose}
            style={{
              padding: '12px 20px',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            Review Details
          </button>
        </div>
      </div>
    </div>
  );
}
