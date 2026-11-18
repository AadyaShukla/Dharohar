import React, { useState, useEffect } from 'react';
import {
  getTrustPay,
  payout,
  artistAcknowledge,
  nonReceiptClaim,
  advanceTime,
  failNextPayout,
  seed,
  getBooking,
} from '../api';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import TextileBorder from './heritage/TextileBorder';
import HeritageDivider from './heritage/HeritageDivider';
import CulturalMotif from './heritage/CulturalMotif';

export default function TrustPayTracker({
  bookingId,
  setBookingId,
  booking,
  setBooking,
  currentUser,
  onRunDemoScenario,
}) {
  const [trustpayData, setTrustpayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [claimFindings, setClaimFindings] = useState(null);
  const [demoNotice, setDemoNotice] = useState(null);
  const [earlyApproval, setEarlyApproval] = useState(false);

  const isOperator = currentUser?.role === 'OPERATOR';
  const isArtist = currentUser?.role === 'ARTIST';
  const isOrganizer = currentUser?.role === 'ORGANIZER';

  useEffect(() => {
    if (bookingId) {
      loadData(bookingId);
    }
  }, [bookingId]);

  async function loadData(id) {
    try {
      setError(null);
      const data = await getTrustPay(id);
      setTrustpayData(data);
      if (setBooking) {
        const b = await getBooking(id);
        setBooking(b);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReleasePayout() {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      await payout(bookingId, { early_approval: earlyApproval });
      await loadData(bookingId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge(confirmed) {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      await artistAcknowledge(bookingId, confirmed);
      await loadData(bookingId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNonReceiptClaim() {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    setClaimFindings(null);
    try {
      const findings = await nonReceiptClaim(bookingId);
      setClaimFindings(findings);
      await loadData(bookingId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdvanceTime() {
    setLoading(true);
    setError(null);
    try {
      await advanceTime(bookingId);
      setDemoNotice('Simulated settlement delay advanced: pending payouts updated to SUCCESSFUL.');
      await loadData(bookingId);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFailNextPayout() {
    setLoading(true);
    setError(null);
    try {
      await failNextPayout();
      setDemoNotice('Failure injection active: the next released payout will fail settlement and trigger an operator ticket.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!bookingId) {
    return (
      <div
        style={{
          maxWidth: '720px',
          margin: '40px auto',
          textAlign: 'center',
          background: '#FFFDF9',
          border: '2px dashed var(--dh-border-heritage)',
          borderRadius: '16px',
          padding: '48px 24px',
        }}
      >
        <Diya size={48} animated />
        <h2 style={{ fontFamily: "'Yatra One', cursive", color: '#6B1717', margin: '14px 0 8px' }}>
          No Active Escrow Selected
        </h2>
        <p style={{ color: '#6B5E4F', fontSize: '15px', margin: 0 }}>
          Please select an active booking from the top navigation or create one in Organizer Chat to inspect the TrustPay escrow ledger.
        </p>
        {isOperator && onRunDemoScenario && (
          <button
            type="button"
            className="folk-btn-primary"
            style={{ marginTop: '20px' }}
            onClick={onRunDemoScenario}
          >
            <Ghungroo size={16} /> Load Demo Escrow Scenario
          </button>
        )}
      </div>
    );
  }

  const isClosed = trustpayData?.booking_status === 'CLOSED';
  const organizerStatus = trustpayData?.organizer_payment_status || 'NOT_PAID';
  const payoutStatus = trustpayData?.artist_payout_status || 'NOT_STARTED';
  const ackStatus = trustpayData?.artist_ack_status || 'NOT_ACKNOWLEDGED';
  const tickets = trustpayData?.tickets || [];

  return (
    <div
      style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '24px 16px 48px',
        fontFamily: "'Noto Sans', sans-serif",
      }}
    >
      {/* ====================================================================
          1. TASTEFUL SIMULATED PAYMENT DISCLAIMER
          ==================================================================== */}
      <div className="simulated-payment-banner" role="alert">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <div>
            <strong>SIMULATED TRUSTPAY ESCROW:</strong> Operating under deterministic test provider. No real bank accounts or payment cards are debited.
          </div>
        </div>
        <span
          style={{
            backgroundColor: '#D97706',
            color: '#FFFFFF',
            padding: '3px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
          }}
        >
          DEMO ACTIVE
        </span>
      </div>

      {/* Booking CLOSED Banner */}
      {isClosed && (
        <div
          style={{
            background: '#ECFDF5',
            border: '2px solid #10B981',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#065F46',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '24px' }}>🎉</span>
          <div>
            <strong>Booking Lifecycle Successfully CLOSED:</strong> Escrow payout has settled to the artist's verified bank account and receipt has been formally confirmed.
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '2px solid #EF4444',
            borderRadius: '8px',
            padding: '14px 18px',
            color: '#991B1B',
            marginBottom: '20px',
          }}
        >
          <strong>Backend Error: </strong> {error}
        </div>
      )}

      {demoNotice && (
        <div
          style={{
            backgroundColor: '#EFF6FF',
            border: '1.5px solid #3B82F6',
            borderRadius: '8px',
            padding: '12px 18px',
            color: '#1E40AF',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>ℹ️ {demoNotice}</span>
          <button
            type="button"
            onClick={() => setDemoNotice(null)}
            style={{ background: 'none', border: 'none', color: '#1E40AF', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div
        style={{
          background: '#FFFDF9',
          border: '2px solid var(--dh-border-heritage)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
          marginBottom: '28px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <CulturalMotif name="diya" size={38} />
            <div>
              <h1
                style={{
                  fontFamily: "'Yatra One', cursive",
                  fontSize: '28px',
                  color: '#6B1717',
                  margin: 0,
                }}
              >
                TrustPay Guaranteed Escrow Ledger
              </h1>
              <p style={{ margin: '4px 0 0', color: '#6B5E4F', fontSize: '15px' }}>
                Booking Reference: <strong>#{bookingId}</strong> • Verified Milestone Vault
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>Total In Escrow</div>
            <div style={{ fontFamily: "'Yatra One', cursive", fontSize: '32px', color: '#B84220' }}>
              ₹{((trustpayData?.total_organizer_amount || trustpayData?.amount || 0)).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* 5-STAGE HIGH-TRUST ESCROW TIMELINE */}
        <div className="escrow-stage-track">
          {[
            { step: 1, title: 'Offer Agreed', desc: 'Terms Accepted', done: true },
            { step: 2, title: 'Escrow Funded', desc: organizerStatus === 'RECEIVED' ? 'Funds in Vault' : 'Pending Payment', done: organizerStatus === 'RECEIVED' },
            { step: 3, title: 'Arrival Advance', desc: '50% Released', done: payoutStatus === 'SUCCESSFUL' || payoutStatus === 'PENDING' },
            { step: 4, title: 'Performance', desc: 'Show Completed', done: isClosed || payoutStatus === 'SUCCESSFUL' },
            { step: 5, title: 'Final Settlement', desc: ackStatus === 'CONFIRMED' ? 'Confirmed Receipt' : 'Pending Receipt', done: ackStatus === 'CONFIRMED' },
          ].map((node) => (
            <div
              key={node.step}
              className={`escrow-stage-node ${node.done ? 'completed' : ''}`}
            >
              <div className="escrow-node-circle">
                {node.done ? '✓' : `0${node.step}`}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: node.done ? '#15803D' : '#4B5563' }}>
                {node.title}
              </div>
              <div style={{ fontSize: '11.5px', color: '#6B7280', marginTop: '2px' }}>
                {node.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ====================================================================
          2. FEE TRANSPARENCY CARD (Paise-Accurate)
          ==================================================================== */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid var(--dh-border-heritage)',
          borderRadius: '12px',
          padding: '20px 24px',
          marginBottom: '28px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>💰</span>
            <strong style={{ color: '#6B1717', fontSize: '17px', fontFamily: "'Yatra One', cursive" }}>
              Transparent Escrow Fee Structure
            </strong>
          </div>
          <span style={{ fontSize: '13px', color: '#15803D', fontWeight: 600 }}>
            ✓ 100% Artist Fee Protected (Zero Deductions from Artist Remittance)
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            background: '#FAF6EE',
            borderRadius: '10px',
            padding: '16px',
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>Artist Net Compensation:</span>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F1A14', marginTop: '2px' }}>
              ₹{(trustpayData?.amount || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>Platform Service Fee (5%):</span>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F1A14', marginTop: '2px' }}>
              ₹{(trustpayData?.platform_fee || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>GST on Fee (18%):</span>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F1A14', marginTop: '2px' }}>
              ₹{(trustpayData?.fee_gst || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ borderLeft: '2px dashed #C4A482', paddingLeft: '16px' }}>
            <span style={{ fontSize: '12px', color: '#B84220', textTransform: 'uppercase', fontWeight: 'bold' }}>
              Organizer Total Deposited:
            </span>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#B84220', marginTop: '2px' }}>
              ₹{(trustpayData?.total_organizer_amount || trustpayData?.amount || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. THREE MILESTONE CARDS
          ==================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        {/* Milestone 1: Organizer Deposit */}
        <div
          style={{
            background: '#FFFFFF',
            border: `2px solid ${organizerStatus === 'RECEIVED' ? '#10B981' : '#F59E0B'}`,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: '#6B5E4F', fontWeight: 'bold' }}>
            Milestone 1 • Escrow Vault Deposit
          </div>
          <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: '4px 0 10px' }}>
            Organizer Payment
          </h3>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              backgroundColor: organizerStatus === 'RECEIVED' ? '#ECFDF5' : '#FFFBEB',
              color: organizerStatus === 'RECEIVED' ? '#15803D' : '#B45309',
              border: `1px solid ${organizerStatus === 'RECEIVED' ? '#A7F3D0' : '#FDE68A'}`,
              marginBottom: '10px',
            }}
          >
            {organizerStatus}
          </span>
          <p style={{ fontSize: '13.5px', color: '#4B5563', margin: 0, lineHeight: 1.5 }}>
            {organizerStatus === 'RECEIVED'
              ? `Funds held safely in simulated vault. Txn: ${trustpayData?.txn_id || 'MOCK-TXN-SIMULATED'}`
              : 'Awaiting organizer payment via simulated checkout or Razorpay.'}
          </p>
        </div>

        {/* Milestone 2: Artist Payout */}
        <div
          style={{
            background: '#FFFFFF',
            border: `2px solid ${payoutStatus === 'SUCCESSFUL' ? '#10B981' : payoutStatus === 'FAILED' ? '#EF4444' : '#C4A482'}`,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: '#6B5E4F', fontWeight: 'bold' }}>
            Milestone 2 • Escrow Disbursement
          </div>
          <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: '4px 0 10px' }}>
            Artist Bank Payout
          </h3>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              backgroundColor: payoutStatus === 'SUCCESSFUL' ? '#ECFDF5' : payoutStatus === 'FAILED' ? '#FEF2F2' : '#EFF6FF',
              color: payoutStatus === 'SUCCESSFUL' ? '#15803D' : payoutStatus === 'FAILED' ? '#991B1B' : '#1E40AF',
              border: `1px solid ${payoutStatus === 'SUCCESSFUL' ? '#A7F3D0' : payoutStatus === 'FAILED' ? '#FECACA' : '#BFDBFE'}`,
              marginBottom: '10px',
            }}
          >
            {payoutStatus}
          </span>
          <p style={{ fontSize: '13.5px', color: '#4B5563', margin: 0, lineHeight: 1.5 }}>
            {payoutStatus === 'SUCCESSFUL'
              ? 'Funds successfully transferred to artist linked bank account.'
              : payoutStatus === 'PENDING'
              ? 'Payout in settlement queue. Operator can advance time to finalize.'
              : payoutStatus === 'FAILED'
              ? 'Bank transfer simulated failure; operator reconciliation ticket opened.'
              : 'Disbursement triggers automatically upon event day check-in.'}
          </p>
        </div>

        {/* Milestone 3: Artist Receipt Confirmation */}
        <div
          style={{
            background: '#FFFFFF',
            border: `2px solid ${ackStatus === 'CONFIRMED' ? '#10B981' : '#C4A482'}`,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: '#6B5E4F', fontWeight: 'bold' }}>
            Milestone 3 • Receipt Verification
          </div>
          <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: '4px 0 10px' }}>
            Artist Acknowledgement
          </h3>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 'bold',
              backgroundColor: ackStatus === 'CONFIRMED' ? '#ECFDF5' : '#FFFBEB',
              color: ackStatus === 'CONFIRMED' ? '#15803D' : '#B45309',
              border: `1px solid ${ackStatus === 'CONFIRMED' ? '#A7F3D0' : '#FDE68A'}`,
              marginBottom: '10px',
            }}
          >
            {ackStatus}
          </span>
          <p style={{ fontSize: '13.5px', color: '#4B5563', margin: 0, lineHeight: 1.5 }}>
            {ackStatus === 'CONFIRMED'
              ? 'Artist confirmed receiving payment in full.'
              : ackStatus === 'DISPUTED'
              ? 'Artist reported payment discrepancy; operator reviewing.'
              : 'Pending artist verification after funds clearance.'}
          </p>
        </div>
      </div>

      {/* ====================================================================
          4. ROLE-BASED ACTIONS PANEL
          ==================================================================== */}
      <div
        style={{
          background: '#FFFDF9',
          border: '2px solid #6B1717',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: '0 0 16px' }}>
          Escrow Lifecycle Actions
        </h4>

        {isOperator && organizerStatus === 'RECEIVED' && payoutStatus !== 'SUCCESSFUL' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#4A3E31' }}>
              <input
                type="checkbox"
                checked={earlyApproval}
                onChange={(e) => setEarlyApproval(e.target.checked)}
              />
              <span>Operator Early Release Approval (bypass 48h post-event window)</span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Release Payout (OPERATOR only) */}
          <button
            type="button"
            className="folk-btn-primary"
            disabled={!isOperator || organizerStatus !== 'RECEIVED' || payoutStatus === 'SUCCESSFUL' || loading}
            onClick={handleReleasePayout}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              opacity: !isOperator || organizerStatus !== 'RECEIVED' || payoutStatus === 'SUCCESSFUL' ? 0.5 : 1,
            }}
          >
            💰 Release Escrow Payout (Operator)
          </button>

          {/* Artist Actions */}
          <button
            type="button"
            className="folk-btn-secondary"
            disabled={(!isArtist && !isOperator) || payoutStatus !== 'SUCCESSFUL' || ackStatus === 'CONFIRMED' || loading}
            onClick={() => handleAcknowledge(true)}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              backgroundColor: '#ECFDF5',
              borderColor: '#10B981',
              color: '#065F46',
              opacity: (!isArtist && !isOperator) || payoutStatus !== 'SUCCESSFUL' || ackStatus === 'CONFIRMED' ? 0.5 : 1,
            }}
          >
            ✓ Confirm Bank Receipt (Artist)
          </button>

          <button
            type="button"
            className="folk-btn-secondary"
            disabled={(!isArtist && !isOperator) || loading}
            onClick={handleNonReceiptClaim}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              backgroundColor: '#FEF2F2',
              borderColor: '#EF4444',
              color: '#991B1B',
              opacity: (!isArtist && !isOperator) ? 0.5 : 1,
            }}
          >
            ⚠️ Report Non-Receipt Claim
          </button>

          {/* Operator Demo Simulator Controls */}
          {isOperator && (
            <>
              <button
                type="button"
                className="folk-btn-secondary"
                disabled={loading}
                onClick={handleAdvanceTime}
                style={{ padding: '10px 14px', fontSize: '13.5px' }}
                title="Advance time by 24h to simulate bank clearing"
              >
                ⏩ Advance Time (+24h)
              </button>

              <button
                type="button"
                className="folk-btn-secondary"
                disabled={loading}
                onClick={handleFailNextPayout}
                style={{ padding: '10px 14px', fontSize: '13.5px', borderColor: '#D97706', color: '#B45309' }}
                title="Simulate bank transfer failure"
              >
                ⚡ Inject Failure
              </button>
            </>
          )}
        </div>

        {/* Claim Findings Diagnostic Output if submitted */}
        {claimFindings && (
          <div
            style={{
              marginTop: '20px',
              background: '#FFFBEB',
              border: '1.5px solid #F59E0B',
              borderRadius: '10px',
              padding: '16px',
            }}
          >
            <div style={{ fontWeight: 'bold', color: '#B45309', marginBottom: '6px' }}>
              Non-Receipt Investigation Findings:
            </div>
            <pre style={{ fontSize: '12px', background: '#FFFFFF', padding: '10px', borderRadius: '6px', overflowX: 'auto', margin: 0 }}>
              {JSON.stringify(claimFindings, null, 2)}
            </pre>
          </div>
        )}

        {/* Active Reconciliation Tickets */}
        {tickets.length > 0 && (
          <div style={{ marginTop: '24px', borderTop: '1px solid #E8DCCB', paddingTop: '16px' }}>
            <h5 style={{ color: '#6B1717', fontSize: '16px', margin: '0 0 10px' }}>
              Active Operator Reconciliation Tickets ({tickets.length})
            </h5>
            {tickets.map((t) => (
              <div
                key={t.id}
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '8px',
                  fontSize: '13px',
                }}
              >
                <strong>Ticket #{t.id}</strong> • Issue: {t.issue_type} • Status: <strong>{t.status}</strong>
                <div style={{ color: '#6B5E4F', marginTop: '4px' }}>{t.notes}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
