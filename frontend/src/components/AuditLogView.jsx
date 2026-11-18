import React, { useState, useEffect } from 'react';
import { getAudit } from '../api';
import Diya from './folk/Diya';
import TextileBorder from './heritage/TextileBorder';
import CulturalMotif from './heritage/CulturalMotif';

export default function AuditLogView({ bookingId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

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

  function getActionMeta(action) {
    switch (action) {
      case 'OFFER_PROPOSED':
        return { label: 'Offer Proposed', color: '#1E40AF', bg: '#EFF6FF', border: '#BFDBFE', icon: '📝' };
      case 'OFFER_ACCEPTED':
      case 'ARTIST_APPROVED':
        return { label: 'Approved & Accepted', color: '#15803D', bg: '#ECFDF5', border: '#A7F3D0', icon: '✓' };
      case 'OFFER_REJECTED':
      case 'ARTIST_DECLINED':
        return { label: 'Declined / Rejected', color: '#991B1B', bg: '#FEF2F2', border: '#FECACA', icon: '✕' };
      case 'STANDBY_CHECKED':
        return { label: 'Standby Candidate Checked', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', icon: '⚠️' };
      case 'ORGANIZER_APPROVED_CHANGE':
        return { label: 'Substitution Approved', color: '#047857', bg: '#D1FAE5', border: '#6EE7B7', icon: '🔄' };
      case 'PAYMENT_RECEIVED':
      case 'ESCROW_FUNDED':
        return { label: 'Escrow Funded', color: '#78350F', bg: '#FEF3C7', border: '#FCD34D', icon: '🔒' };
      case 'PAYOUT_RELEASED':
        return { label: 'Payout Released', color: '#166534', bg: '#DCFCE7', border: '#86EFAC', icon: '💸' };
      default:
        return { label: action, color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB', icon: '●' };
    }
  }

  function getActorBadge(actor) {
    switch (actor) {
      case 'ORGANIZER':
        return { label: 'Organizer', icon: '🏛️', bg: '#EFF6FF', color: '#1E3A8A' };
      case 'ARTIST':
        return { label: 'Folk Artist', icon: '🪕', bg: '#FFFBEB', color: '#92400E' };
      case 'OPERATOR':
        return { label: 'Platform Operator', icon: '⚙️', bg: '#FEF2F2', color: '#991B1B' };
      default:
        return { label: actor || 'Rule Engine', icon: '✦', bg: '#FAF5EE', color: '#6B1717' };
    }
  }

  function formatDetails(details) {
    if (!details || Object.keys(details).length === 0) {
      return <em>No additional metadata</em>;
    }

    const items = [];
    if (details.price) {
      items.push(`Agreed Fee: ₹${Number(details.price / 100 || details.price).toLocaleString('en-IN')}`);
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
    if (details.reasons && details.reasons.length > 0) {
      items.push(`Reasons: ${details.reasons.join(', ')}`);
    }

    return (
      <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
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
          No Active Audit Log Selected
        </h2>
        <p style={{ color: '#6B5E4F', fontSize: '15px', margin: 0 }}>
          Please select or create a booking to view its immutable cryptographic audit stream.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1040px',
        margin: '0 auto',
        padding: '24px 16px 48px',
        fontFamily: "'Noto Sans', sans-serif",
      }}
    >
      {/* Top Header Card */}
      <div
        style={{
          background: '#FFFDF9',
          border: '2px solid var(--dh-border-heritage)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CulturalMotif name="diya" size={34} />
          <div>
            <h1
              style={{
                fontFamily: "'Yatra One', cursive",
                fontSize: '26px',
                color: '#6B1717',
                margin: 0,
              }}
            >
              Cryptographic Storytelling Timeline
            </h1>
            <p style={{ margin: '2px 0 0', color: '#6B5E4F', fontSize: '14px' }}>
              Booking <strong>#{bookingId}</strong> • Immutable append-only event stream (Auto-refreshes)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '12.5px', color: '#6B5E4F' }}>
              Updated: {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            className="folk-btn-secondary"
            onClick={() => fetchLogs(false)}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '13.5px' }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Log'}
          </button>
        </div>
      </div>

      <TextileBorder height={16} />

      {error && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #EF4444',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#991B1B',
            margin: '18px 0',
          }}
        >
          {error}
        </div>
      )}

      {/* Vertical Storytelling Timeline */}
      <div style={{ position: 'relative', margin: '32px 0 0 20px', paddingLeft: '32px' }}>
        {/* Continuous Vertical Rail Line */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            bottom: '12px',
            left: '12px',
            width: '3px',
            background: 'linear-gradient(180deg, #6B1717 0%, #C69214 50%, #15803D 100%)',
            borderRadius: '3px',
          }}
        />

        {logs.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#6B5E4F' }}>
            No audit records logged yet for booking #{bookingId}.
          </div>
        ) : (
          logs.map((entry, index) => {
            const meta = getActionMeta(entry.action);
            const actor = getActorBadge(entry.actor);
            const eventDate = new Date(entry.timestamp);
            const isExpanded = expandedId === (entry.id || index);

            return (
              <div
                key={entry.id || index}
                style={{
                  position: 'relative',
                  marginBottom: '24px',
                }}
              >
                {/* Node Marker on Rail */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-32px',
                    top: '16px',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: meta.bg,
                    border: `2px solid ${meta.color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: meta.color,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  {meta.icon}
                </div>

                {/* Event Card */}
                <div
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #E8DCCB',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'box-shadow var(--transition-fast)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          backgroundColor: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 'bold',
                        }}
                      >
                        {meta.label}
                      </span>

                      <span
                        style={{
                          backgroundColor: actor.bg,
                          color: actor.color,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {actor.icon} {actor.label}
                      </span>
                    </div>

                    <span style={{ fontSize: '12.5px', color: '#6B7280' }}>
                      {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Summary Details */}
                  {formatDetails(entry.details)}

                  {/* Cryptographic SHA-256 Inspection Toggle */}
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed #E8DCCB' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : (entry.id || index))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6B1717',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600,
                      }}
                    >
                      <span>{isExpanded ? '▼ Hide SHA-256 Payload' : '▶ Inspect Raw Audit Payload'}</span>
                    </button>

                    {isExpanded && (
                      <pre
                        style={{
                          margin: '8px 0 0',
                          padding: '12px',
                          background: '#FAF6EE',
                          border: '1px solid #E8DCCB',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          overflowX: 'auto',
                          fontFamily: 'monospace',
                          color: '#1F2937',
                        }}
                      >
                        {JSON.stringify(entry, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
