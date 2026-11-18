import React, { useState, useEffect } from 'react';
import {
  createBooking,
  negotiate,
  getBooking,
  organizerApproveChange,
  createPaymentOrder,
  verifyPaymentSignature,
  pay,
  getPublicConfig,
  loadRazorpayScript,
} from '../api';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import PaisleyBorder from './folk/PaisleyBorder';
import WarliDancers from './folk/WarliDancers';
import BookingTimeline from './BookingTimeline';

export default function OrganizerChat({ bookingId, setBookingId, booking, setBooking, currentUser }) {
  // Form State
  const [organizerName, setOrganizerName] = useState(
    currentUser?.role === 'ORGANIZER' && currentUser?.name
      ? currentUser.name
      : 'Hotel Rajmahal Heritage (fictional)'
  );
  const [eventDate, setEventDate] = useState('2026-11-20');
  const [eventTime, setEventTime] = useState('18:00');
  const [venueAddress, setVenueAddress] = useState('City Palace Courtyard, Udaipur');
  const [notes, setNotes] = useState('');
  const [budget, setBudget] = useState(30000);
  const [distanceKm, setDistanceKm] = useState(100);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [groupSize, setGroupSize] = useState(6);

  // Default roles
  const [roles, setRoles] = useState([
    { role: 'Dance group', art_form: 'Kalbelia Dance', budget: 16000 },
    { role: 'Musician', art_form: 'Manganiyar Folk Music', budget: 14000 },
  ]);

  // Chat / Interaction State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [negotiationResult, setNegotiationResult] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState('mock');

  // Load backend configuration for payment provider
  useEffect(() => {
    async function initConfig() {
      try {
        const cfg = await getPublicConfig();
        if (cfg && cfg.payment_provider) {
          setPaymentProvider(cfg.payment_provider);
        }
      } catch {
        setPaymentProvider('mock');
      }
    }
    initConfig();
  }, []);

  // Fetch booking details on mount or bookingId change
  useEffect(() => {
    if (bookingId) {
      loadBooking(bookingId);
    }
  }, [bookingId]);

  async function loadBooking(id) {
    try {
      setError(null);
      const data = await getBooking(id);
      setBooking(data);
      if (data.negotiated_roles && Object.keys(data.negotiated_roles).length > 0) {
        setNegotiationResult({ roles: data.negotiated_roles, status: data.status });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  function handleRoleChange(index, field, value) {
    const updated = [...roles];
    updated[index][field] = value;
    setRoles(updated);
  }

  function handleAddRole() {
    setRoles([...roles, { role: 'Folk Performer', art_form: 'Kathputli Puppet Theatre', budget: 8000 }]);
  }

  function handleRemoveRole(index) {
    if (roles.length <= 1) return;
    setRoles(roles.filter((_, i) => i !== index));
  }

  // Format reason tokens into plain language
  function formatReason(reasonStr) {
    if (!reasonStr) return '';
    if (reasonStr.includes('DIFFERENT_ART_FORM')) {
      return 'Different art form than requested';
    }
    if (reasonStr.includes('PRICE_ABOVE_TOLERANCE')) {
      return 'Price exceeds budget tolerance threshold';
    }
    if (reasonStr.includes('DIFFERENT_DURATION')) {
      return 'Performance duration differs from requested duration';
    }
    return reasonStr;
  }

  async function handleSendRequest(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Post new booking
      const payload = {
        organizer_name: organizerName,
        roles: roles.map((r) => ({
          role: r.role,
          art_form: r.art_form,
          budget: Number(r.budget),
        })),
        event_date: eventDate,
        event_time: eventTime,
        venue_address: venueAddress,
        expected_duration_minutes: Number(durationMinutes),
        budget: Number(budget),
        distance_km: Number(distanceKm),
        duration_minutes: Number(durationMinutes),
        group_size: Number(groupSize),
        notes: notes,
      };

      const newBooking = await createBooking(payload);
      setBookingId(newBooking.id);
      setBooking(newBooking);

      // Add user message to chat stream
      const userMsg = {
        id: Date.now(),
        sender: 'Organizer',
        content: `Submitted booking request #${newBooking.id} for "${organizerName}" with ${roles.length} roles and total budget ₹${budget}.`,
      };
      setChatMessages((prev) => [...prev, userMsg]);

      // 2. Run multi-agent negotiation
      const negResult = await negotiate(newBooking.id);
      setNegotiationResult(negResult);

      // Reload fresh booking state
      await loadBooking(newBooking.id);

      // Add agent response message
      const agentMsg = {
        id: Date.now() + 1,
        sender: 'Organizer Agent',
        content: `Evaluated available folk artists against budget ₹${budget}. Negotiation status: ${negResult.status}.`,
        negotiation: negResult,
      };
      setChatMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveChange(roleName, artistId) {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      await organizerApproveChange(bookingId, {
        role: roleName,
        artist_id: artistId,
        reason: 'Organizer explicitly approved candidate substitution',
      });
      await loadBooking(bookingId);
      if (negotiationResult && negotiationResult.roles && negotiationResult.roles[roleName]) {
        setNegotiationResult({
          ...negotiationResult,
          roles: {
            ...negotiationResult.roles,
            [roleName]: {
              ...negotiationResult.roles[roleName],
              status: 'VALID',
              reasons: ['Approved by Organizer'],
            },
          },
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectChange(roleName) {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      if (negotiationResult && negotiationResult.roles && negotiationResult.roles[roleName]) {
        setNegotiationResult({
          ...negotiationResult,
          roles: {
            ...negotiationResult.roles,
            [roleName]: {
              ...negotiationResult.roles[roleName],
              status: 'NO_CANDIDATE',
              reasons: ['Rejected by Organizer'],
            },
          },
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      if (paymentProvider === 'mock') {
        // Mock provider: directly confirm simulated payment, do NOT load Razorpay SDK or open Checkout
        await pay(bookingId);
        await loadBooking(bookingId);
      } else {
        // Razorpay provider: dynamically load checkout SDK and open Checkout modal
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error('Could not load Razorpay Checkout script. Please check your network connection.');
        }

        const orderData = await createPaymentOrder(bookingId);
        if (!orderData || !orderData.order_id) {
          throw new Error('Failed to create Razorpay payment order.');
        }

        const options = {
          key: orderData.key_id,
          amount: orderData.amount_paise,
          currency: orderData.currency || 'INR',
          name: 'धरोहर • Dharohar Folk Escrow',
          description: `TrustPay Escrow Deposit • Booking #${bookingId}`,
          order_id: orderData.order_id,
          handler: async function (response) {
            try {
              setLoading(true);
              // Send verified payment signature to backend to move booking to PAID
              await verifyPaymentSignature(bookingId, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              await loadBooking(bookingId);
            } catch (vErr) {
              setError(`Signature Verification Failed: ${vErr.message}`);
            } finally {
              setLoading(false);
            }
          },
          prefill: {
            name: currentUser?.name || organizerName,
            contact: currentUser?.phone || '9000000099',
          },
          theme: {
            color: '#8B2500',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          setError(`Razorpay Payment Failed: ${resp.error.description}`);
          setLoading(false);
        });
        rzp.open();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const isApproved = booking?.status === 'APPROVED';

  return (
    <div className="organizer-chat-layout">
      {/* Top Controls & Status Bar */}
      <div className="booking-status-header">
        <div className="booking-meta">
          <span className="booking-id-label">Active Booking:</span>
          <strong>{bookingId ? `#${bookingId}` : 'None (Submit request below)'}</strong>
        </div>

        <div className="status-badge-container">
          <span className="status-chip-label">Status:</span>
          <span className={`status-chip status-${booking?.status?.toLowerCase() || 'none'}`}>
            {booking?.status || 'NOT_STARTED'}
          </span>
        </div>

        <div className="pay-action-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <button
            type="button"
            className="btn-pay folk-btn-primary"
            disabled={!isApproved || loading}
            onClick={handlePay}
            title={
              !isApproved
                ? 'Requires human artist approval first'
                : paymentProvider === 'mock'
                ? 'Deposit funds using simulated test provider'
                : 'Deposit funds into escrow via Razorpay Checkout'
            }
          >
            <Ghungroo size={15} /> {loading ? 'Processing...' : paymentProvider === 'mock' ? 'Pay (simulated)' : 'Pay Escrow Deposit'}
          </button>
          {paymentProvider === 'mock' && (
            <span
              className="simulated-payment-label"
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#8B2500',
                backgroundColor: '#FFF2EE',
                border: '1px solid #FFCCBC',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
              }}
            >
              SIMULATED PAYMENT (test provider, no real money)
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          <strong>Backend Error: </strong> {error}
        </div>
      )}

      {booking && (
        <BookingTimeline
          booking={booking}
          currentUser={currentUser}
          onRefresh={() => loadBooking(bookingId)}
        />
      )}

      {/* Main Chat Stream */}
      <div className="chat-stream">
        {/* Welcome Agent Bubble */}
        <div className="chat-bubble agent-bubble">
          <div className="bubble-sender" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Diya size={22} /> Organizer Desk AI Agent
          </div>
          <div className="bubble-text">
            Welcome to Dharohar. Specify your event requirements and roles below. I will represent
            your budget, evaluate artist constraints, and negotiate offers automatically.
          </div>
        </div>

        {/* User Form Container inside a chat card */}
        <div className="chat-bubble user-bubble form-bubble">
          <div className="bubble-sender">Organizer Event Request 📝</div>

          <form onSubmit={handleSendRequest} className="booking-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Organizer / Organisation Name</label>
                <input
                  type="text"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Event Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Event Time</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label>Venue Address</label>
                  <span style={{ fontSize: '12px', color: '#B45309', fontWeight: 'bold' }}>
                    🔒 Hidden from artists until payment
                  </span>
                </div>
                <input
                  type="text"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="Exact venue address and landmark..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Total Budget (₹ INR)</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Max Distance (km)</label>
                <input
                  type="number"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Duration (mins)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Audience / Group Size</label>
                <input
                  type="number"
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            {/* Requested Roles Subsection */}
            <div className="roles-section">
              <div className="roles-header">
                <label>Requested Performance Roles</label>
                <button
                  type="button"
                  className="btn-add-role"
                  onClick={handleAddRole}
                >
                  + Add Role
                </button>
              </div>

              {roles.map((r, idx) => (
                <div key={idx} className="role-row">
                  <input
                    type="text"
                    placeholder="Role Title (e.g. Dance group)"
                    value={r.role}
                    onChange={(e) => handleRoleChange(idx, 'role', e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Folk Art Form (e.g. Kalbelia Dance)"
                    value={r.art_form}
                    onChange={(e) => handleRoleChange(idx, 'art_form', e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Role Budget (₹)"
                    value={r.budget}
                    onChange={(e) => handleRoleChange(idx, 'budget', e.target.value)}
                    required
                  />
                  {roles.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove-role"
                      onClick={() => handleRemoveRole(idx)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="btn-submit-request"
              disabled={loading}
            >
              <Ghungroo size={16} /> {loading ? 'Evaluating & Negotiating Offers...' : 'Send Request'}
            </button>
          </form>
        </div>

        {/* Dynamic Chat Messages History */}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${msg.sender.includes('Agent') ? 'agent-bubble' : 'user-bubble'}`}
          >
            <div className="bubble-sender">
              {msg.sender.includes('Agent') ? 'Organizer Agent 🤖' : 'Organizer 👤'}
            </div>
            <div className="bubble-text">{msg.content}</div>
          </div>
        ))}

        {/* Results Card Display */}
        {negotiationResult && negotiationResult.roles && (
          <div className="chat-bubble agent-bubble negotiation-card-bubble">
            <div className="bubble-sender" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Diya size={20} /> Negotiation Findings & Offers
            </div>
            <PaisleyBorder height={18} />
            <div className="roles-results-grid">
              {Object.entries(negotiationResult.roles).map(([roleName, info]) => {
                const status = info.status || 'NO_CANDIDATE';
                const isNeedsApproval = status === 'NEEDS_ORGANIZER_APPROVAL';

                return (
                  <div key={roleName} className={`role-result-card border-${status.toLowerCase()}`}>
                    <div className="role-card-header">
                      <h3>{roleName}</h3>
                      <span className={`status-badge badge-${status.toLowerCase()}`}>
                        {status}
                      </span>
                    </div>

                    <div className="role-card-body">
                      <p>
                        <strong>Artist ID:</strong> {info.artist_id || 'None available'}
                      </p>
                      <p>
                        <strong>Proposed Price:</strong>{' '}
                        {info.price ? `₹${info.price.toLocaleString('en-IN')}` : 'N/A'}
                      </p>

                      {info.reasons && info.reasons.length > 0 && (
                        <div className="reasons-box">
                          <strong>Details / Notes:</strong>
                          <ul>
                            {info.reasons.map((r, i) => (
                              <li key={i}>{formatReason(r)}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Approval Buttons for Flagged Standbys */}
                      {isNeedsApproval && (
                        <div className="approval-actions">
                          <button
                            type="button"
                            className="btn-approve-change"
                            onClick={() => handleApproveChange(roleName, info.artist_id)}
                            disabled={loading}
                          >
                            Approve Change
                          </button>
                          <button
                            type="button"
                            className="btn-reject-change"
                            onClick={() => handleRejectChange(roleName)}
                            disabled={loading}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
