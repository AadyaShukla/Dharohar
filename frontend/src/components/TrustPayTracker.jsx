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
import PaisleyBorder from './folk/PaisleyBorder';

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

  // Demo Control Handlers (Operator only)
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
      setDemoNotice('Failure injection active: the next released payout will fail settlement.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSeed() {
    setLoading(true);
    setError(null);
    try {
      const res = await seed();
      setDemoNotice(`Database reset & seeded with ${res.count || 10} fictional artists and users.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!bookingId) {
    return (
      <div className="tab-placeholder">
        <Diya size={48} />
        <h2 style={{ marginTop: '0.75rem' }}>No Active Booking Selected</h2>
        <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
          Please select or create a booking to view its escrow ledger.
        </p>
        {isOperator && onRunDemoScenario && (
          <button
            type="button"
            className="folk-btn-primary"
            style={{ marginTop: '1.25rem' }}
            onClick={onRunDemoScenario}
          >
            <Ghungroo size={16} /> Load Demo Scenario (Operator)
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
    <div className="trustpay-tracker-layout">
      {/* Booking CLOSED Banner */}
      {isClosed && (
        <div className="closed-banner">
          🎉 <strong>Booking CLOSED</strong> — Escrow payout has settled successfully and receipt has been confirmed by the artist.
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <strong>Backend Error: </strong> {error}
        </div>
      )}

      {demoNotice && (
        <div className="demo-notice-banner">
          ℹ️ {demoNotice}
          <button type="button" onClick={() => setDemoNotice(null)}>✕</button>
        </div>
      )}

      {/* Manual Operator Payout Alert when Route is not enabled */}
      {trustpayData?.payout_mode === 'MANUAL' && (
        <div
          className="manual-payout-notice"
          style={{
            backgroundColor: '#FFFBEB',
            border: '2px solid #D97706',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '18px',
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#B45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️ Manual Operator Payout Task Required</span>
          </div>
          <p style={{ margin: '6px 0 0 0', color: '#4A3E31', fontSize: '0.95rem' }}>
            Razorpay Route automated transfer is not enabled for this artist. Platform operator must initiate direct UPI/NEFT transfer and confirm settlement.
          </p>
        </div>
      )}

      {/* Fee Transparency & Escrow Breakdown Card */}
      <div
        className="fee-transparency-card"
        style={{
          backgroundColor: '#FFFDF9',
          border: '2px solid #C4A482',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '18px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <strong style={{ color: '#8B2500', fontSize: '1.05rem' }}>💰 Escrow Fee Breakdown (Paise-Accurate)</strong>
          <span style={{ fontSize: '0.9rem', color: '#6B5E4F' }}>
            Artist Receives 100% of Agreed Price • Platform Fee Charged to Organizer
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#6B5E4F', display: 'block' }}>Artist Agreed Price:</span>
            <strong>₹{(trustpayData?.amount || 0).toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#6B5E4F', display: 'block' }}>Visible Platform Fee (5%):</span>
            <strong>₹{(trustpayData?.platform_fee || 0).toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#6B5E4F', display: 'block' }}>GST on Fee (18%):</span>
            <strong>₹{(trustpayData?.fee_gst || 0).toLocaleString()}</strong>
          </div>
          <div style={{ borderLeft: '2px dashed #C4A482', paddingLeft: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: '#8B2500', display: 'block', fontWeight: 'bold' }}>Organizer Paid Total:</span>
            <strong style={{ color: '#8B2500', fontSize: '1.1rem' }}>
              ₹{(trustpayData?.total_organizer_amount || trustpayData?.amount || 0).toLocaleString()}
            </strong>
          </div>
        </div>
      </div>

      {/* 3 Large Colour-Coded Status Chips */}
      <div className="status-chips-grid">
        {/* Chip 1: Organizer Escrow Payment */}
        <div className={`large-status-card card-${organizerStatus.toLowerCase()}`}>
          <div className="chip-eyebrow">Milestone 1 • Escrow Deposit</div>
          <h3>Organizer Payment</h3>
          <div className="chip-value-pill">{organizerStatus}</div>
          <p className="chip-description">
            {organizerStatus === 'RECEIVED'
              ? `Funds held in simulated escrow (Txn: ${trustpayData?.txn_id || 'MOCK-TXN'})`
              : 'Waiting for organizer to initiate payment'}
          </p>
        </div>

        {/* Chip 2: Artist Payout */}
        <div className={`large-status-card card-${payoutStatus.toLowerCase()}`}>
          <div className="chip-eyebrow">Milestone 2 • Escrow Release</div>
          <h3>Artist Payout</h3>
          <div className="chip-value-pill">{payoutStatus}</div>
          <p className="chip-description">
            {payoutStatus === 'SUCCESSFUL'
              ? 'Funds settled to artist bank account'
              : payoutStatus === 'PENDING'
              ? 'Payout in settlement queue (Operator can advance time)'
              : payoutStatus === 'FAILED'
              ? 'Payout failed; ticket opened for retry'
              : 'Escrow release not yet initiated'}
          </p>
        </div>

        {/* Chip 3: Artist Acknowledgement */}
        <div className={`large-status-card card-${ackStatus.toLowerCase()}`}>
          <div className="chip-eyebrow">Milestone 3 • Receipt Verification</div>
          <h3>Artist Acknowledgement</h3>
          <div className="chip-value-pill">{ackStatus}</div>
          <p className="chip-description">
            {ackStatus === 'CONFIRMED'
              ? 'Artist confirmed deposit receipt'
              : ackStatus === 'DISPUTED'
              ? 'Artist reported payment discrepancy'
              : 'Pending artist verification'}
          </p>
        </div>
      </div>

      <PaisleyBorder height={20} />

      {/* Action Buttons Panel with Role-Based Permissions */}
      <div className="trustpay-actions-panel">
        <h4>Escrow Lifecycle Actions</h4>

        {isOperator && organizerStatus === 'RECEIVED' && payoutStatus !== 'SUCCESSFUL' && (
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem', color: '#4A3E31' }}>
              <input
                type="checkbox"
                checked={earlyApproval}
                onChange={(e) => setEarlyApproval(e.target.checked)}
              />
              <span>Operator Early Release Approval (bypass 48h post-event dispute window)</span>
            </label>
          </div>
        )}

        <div className="action-buttons-row">
          {/* Release Payout: OPERATOR only */}
          <button
            type="button"
            className="btn-action btn-payout"
            disabled={!isOperator || organizerStatus !== 'RECEIVED' || payoutStatus === 'SUCCESSFUL' || loading}
            onClick={handleReleasePayout}
            title={
              !isOperator
                ? 'Only Platform Operators can release escrow funds (403)'
                : organizerStatus !== 'RECEIVED'
                ? 'Organizer must deposit funds first'
                : 'Release escrow funds to artist'
            }
          >
            Release Payout {!isOperator && '(Operator Only)'}
          </button>

          {/* Artist Acknowledgement: ARTIST (or Operator) */}
          <button
            type="button"
            className="btn-action btn-confirm-ack"
            disabled={(!isArtist && !isOperator) || payoutStatus !== 'SUCCESSFUL' || ackStatus === 'CONFIRMED' || loading}
            onClick={() => handleAcknowledge(true)}
            title={
              isOrganizer
                ? 'Only assigned Artists can acknowledge receipt (403)'
                : 'Confirm payout receipt'
            }
          >
            Artist Acknowledges Receipt {isOrganizer && '(Artist Only)'}
          </button>

          {/* Artist Disputes: ARTIST (or Operator) */}
          <button
            type="button"
            className="btn-action btn-dispute-ack"
            disabled={(!isArtist && !isOperator) || loading}
            onClick={() => handleAcknowledge(false)}
            title={
              isOrganizer
                ? 'Only assigned Artists can dispute receipt (403)'
                : 'Dispute payout receipt'
            }
          >
            Artist Disputes {isOrganizer && '(Artist Only)'}
          </button>

          {/* Artist Says: Not Received: ARTIST (or Operator) */}
          <button
            type="button"
            className="btn-action btn-claim"
            disabled={(!isArtist && !isOperator) || loading}
            onClick={handleNonReceiptClaim}
            title={
              isOrganizer
                ? 'Only assigned Artists can submit non-receipt claims (403)'
                : 'File non-receipt claim'
            }
          >
            Artist Says: Not Received {isOrganizer && '(Artist Only)'}
          </button>
        </div>
      </div>

      {/* Non-Receipt Claim Investigation Findings */}
      {claimFindings && (
        <div className="findings-panel">
          <h4>🔍 Non-Receipt Investigation Findings</h4>
          <div className="findings-content">
            <p>
              <strong>Finding:</strong>{' '}
              <span className={`finding-tag tag-${claimFindings.finding?.toLowerCase()}`}>
                {claimFindings.finding}
              </span>
            </p>
            <p><strong>Details:</strong> {claimFindings.details}</p>
            <p><strong>Transaction ID:</strong> {claimFindings.txn_id || 'N/A'}</p>
            <p><strong>Beneficiary Account:</strong> {claimFindings.beneficiary || 'N/A'}</p>
            <p><strong>Settlement Reference:</strong> {claimFindings.reference || 'N/A'}</p>
            <small style={{ color: '#6b7280' }}>
              Note: Organizer payment RECEIVED is not treated as proof of artist bank credit.
            </small>
          </div>
        </div>
      )}

      {/* Open Reconciliation Tickets List (Operator & relevant views) */}
      <div className="reconciliation-panel">
        <h4>Reconciliation Tickets ({tickets.length})</h4>
        {tickets.length === 0 ? (
          <p className="no-tickets-text">No active reconciliation tickets for this booking.</p>
        ) : (
          <div className="tickets-list">
            {tickets.map((t) => (
              <div key={t.id} className={`ticket-card ticket-${t.status.toLowerCase()}`}>
                <div className="ticket-header">
                  <strong>Ticket #{t.id}</strong>
                  <span className={`ticket-status-badge badge-${t.status.toLowerCase()}`}>
                    {t.status}
                  </span>
                </div>
                <p className="ticket-reason">{t.reason}</p>
                <small className="ticket-time">Opened: {new Date(t.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Demo Controls Box: VISIBLE ONLY TO OPERATOR */}
      {isOperator && (
        <div className="demo-controls-box">
          <div className="demo-box-header">
            <span className="demo-badge">OPERATOR DEMO CONTROLS ONLY</span>
            <span className="demo-sub">Simulate settlement delays, inject test errors, and seed scenarios</span>
          </div>

          <div className="demo-buttons-row">
            {onRunDemoScenario && (
              <button
                type="button"
                className="folk-btn-primary"
                onClick={onRunDemoScenario}
                disabled={loading}
              >
                <Ghungroo size={16} /> Run Demo Scenario
              </button>
            )}

            <button
              type="button"
              className="btn-demo"
              onClick={handleAdvanceTime}
              disabled={loading}
            >
              ⏩ Advance Time (Settle Payouts)
            </button>

            <button
              type="button"
              className="btn-demo btn-demo-fail"
              onClick={handleFailNextPayout}
              disabled={loading}
            >
              ⚡ Fail Next Payout (Inject Error)
            </button>

            <button
              type="button"
              className="btn-demo"
              onClick={handleResetSeed}
              disabled={loading}
            >
              🔄 Reset & Seed Demo Data
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
