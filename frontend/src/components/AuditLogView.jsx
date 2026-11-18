import React, { useState, useEffect } from 'react';
import { getAudit } from '../api';
import Diya from './folk/Diya';
import PaisleyBorder from './folk/PaisleyBorder';

export default function AuditLogView({ bookingId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    if (!bookingId) return;

    fetchLogs();

    // Auto-refresh every 3 seconds while tab is active
    const timer = setInterval(() => {
      fetchLogs(true);
    }, 3000);

    return () => clearInterval(timer);
  }, [bookingId]);

  async function fetchLogs(silent = false) {
    if (!bookingId) return;
    if (!silent) setLoading(true);
    try {
      const data = await getAudit(bookingId);
      setLogs(data || []);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function getActionColorClass(action) {
    if (['OFFER_REJECTED', 'ARTIST_DECLINED'].includes(action)) {
      return 'action-danger'; // Vermilion red
    }
    if (['OFFER_ACCEPTED', 'ARTIST_APPROVED', 'ORGANIZER_APPROVED_CHANGE'].includes(action)) {
      return 'action-success'; // Leaf green
    }
    if (action === 'OFFER_PROPOSED') {
      return 'action-primary'; // Deep indigo
    }
    if (action === 'STANDBY_CHECKED') {
      return 'action-warning'; // Turmeric yellow
    }
    return 'action-neutral';
  }

  function formatDetails(details) {
    if (!details || Object.keys(details).length === 0) {
      return <em>No additional metadata</em>;
    }

    const items = [];
    if (details.price) {
      items.push(`Price: ₹${Number(details.price).toLocaleString('en-IN')}`);
    }
    if (details.artist_id) {
      items.push(`Artist ID: ${details.artist_id}`);
    }
    if (details.candidate_artist_id) {
      items.push(`Candidate Artist: ${details.candidate_artist_id}`);
    }
    if (details.event) {
      items.push(`Event: ${details.event}`);
    }
    if (details.ack_status) {
      items.push(`Acknowledgement: ${details.ack_status}`);
    }
    if (details.decision) {
      items.push(`Decision: ${details.decision}`);
    }
    if (details.counter_price) {
      items.push(`Counter Price: ₹${Number(details.counter_price).toLocaleString('en-IN')}`);
    }
    if (details.findings?.finding) {
      items.push(`Investigation: ${details.findings.finding}`);
    }
    if (details.violations && details.violations.length > 0) {
      const violationsText = details.violations
        .map((v) => v.message || v.rule)
        .join(', ');
      items.push(`Violations: ${violationsText}`);
    }
    if (details.reasons && details.reasons.length > 0) {
      items.push(`Reasons: ${details.reasons.join(', ')}`);
    }

    if (items.length > 0) {
      return (
        <ul className="details-summary-list">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }

    return (
      <pre className="details-json-preview">
        {JSON.stringify(details, null, 2)}
      </pre>
    );
  }

  if (!bookingId) {
    return (
      <div className="tab-placeholder">
        <h2>No Active Booking Selected</h2>
        <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>
          Please go to <strong>Organizer Chat</strong> to select or create a booking.
        </p>
      </div>
    );
  }

  return (
    <div className="audit-log-layout">
      {/* Top Meta Bar */}
      <div className="audit-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Diya size={32} />
          <div>
            <h3>Chronological Audit Trail</h3>
            <p className="audit-sub">
              Booking #{bookingId} • Immutable event log (Auto-refreshes every 3s)
            </p>
          </div>
        </div>

        <div className="audit-header-actions">
          {lastRefreshed && (
            <span className="refresh-indicator">
              Updated: {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            className="btn-manual-refresh folk-btn-secondary"
            onClick={() => fetchLogs(false)}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      <PaisleyBorder height={18} />

      {error && (
        <div className="error-banner">
          <strong>Backend Error: </strong> {error}
        </div>
      )}

      {/* Timeline Stream (Newest at Bottom) */}
      <div className="timeline-container">
        {logs.length === 0 ? (
          <div className="empty-audit-state">
            <p>No audit events recorded yet for this booking.</p>
          </div>
        ) : (
          <div className="timeline-stream">
            {logs.map((entry, index) => {
              const colorClass = getActionColorClass(entry.action);
              const eventDate = new Date(entry.timestamp);

              return (
                <div key={entry.id || index} className="timeline-item">
                  <div className={`timeline-marker ${colorClass}`}></div>

                  <div className="timeline-content">
                    <div className="timeline-item-header">
                      <span className={`action-badge ${colorClass}`}>
                        {entry.action}
                      </span>
                      <span className="actor-badge">Actor: {entry.actor}</span>
                      <span className="timestamp-label">
                        {eventDate.toLocaleDateString()} {eventDate.toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="timeline-details-body">
                      {formatDetails(entry.details)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
