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
import CulturalMotif from './heritage/CulturalMotif';
import FolkPattern from './heritage/FolkPattern';
import TextileBorder from './heritage/TextileBorder';
import AgreementCelebration from './heritage/AgreementCelebration';
import BookingTimeline from './BookingTimeline';

export default function OrganizerChat({
  bookingId,
  setBookingId,
  booking,
  setBooking,
  currentUser,
}) {
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
  const [showCelebration, setShowCelebration] = useState(false);

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
        // Trigger celebration if negotiation succeeded into approval
        if (data.status === 'AWAITING_ARTIST_APPROVAL' && !showCelebration) {
          setShowCelebration(true);
        }
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
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
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

      const userMsg = {
        id: Date.now(),
        sender: 'Organizer',
        content: `Submitted booking request #${newBooking.id} for "${organizerName}" with ${roles.length} roles and total budget ₹${budget}.`,
      };
      setChatMessages((prev) => [...prev, userMsg]);

      // Run multi-agent negotiation
      const negResult = await negotiate(newBooking.id);
      setNegotiationResult(negResult);

      await loadBooking(newBooking.id);

      const agentMsg = {
        id: Date.now() + 1,
        sender: 'Organizer Agent',
        content: `Evaluated available folk artists against budget ₹${budget}. Multi-agent negotiation status: ${negResult.status}.`,
        negotiation: negResult,
      };
      setChatMessages((prev) => [...prev, agentMsg]);

      if (negResult.status === 'AWAITING_ARTIST_APPROVAL') {
        setShowCelebration(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerNegotiate() {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await negotiate(bookingId);
      setNegotiationResult(res);
      await loadBooking(bookingId);
      const agentMsg = {
        id: Date.now(),
        sender: 'Organizer Agent',
        content: `Re-evaluated negotiation rounds for booking #${bookingId}. Current status: ${res.status}.`,
        negotiation: res,
      };
      setChatMessages((prev) => [...prev, agentMsg]);
      if (res.status === 'AWAITING_ARTIST_APPROVAL') {
        setShowCelebration(true);
      }
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
        await pay(bookingId);
        await loadBooking(bookingId);
      } else {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error('Could not load Razorpay Checkout script. Check network connection.');
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
              await verifyPaymentSignature(bookingId, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              await loadBooking(bookingId);
            } catch (vErr) {
              setError(`Payment verification failed: ${vErr.message}`);
            } finally {
              setLoading(false);
            }
          },
          prefill: {
            name: organizerName,
            contact: currentUser?.phone || '9000000099',
          },
          theme: {
            color: '#8B2500',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const negotiatedRoles = booking?.negotiated_roles || negotiationResult?.roles || {};
  const currentStatus = booking?.status || negotiationResult?.status || 'REQUESTED';

  // Calculate total agreed fee
  const totalAgreedPaise = Object.values(negotiatedRoles).reduce((acc, r) => acc + (r.price || 0), 0);
  const totalAgreedInr = totalAgreedPaise > 0 ? totalAgreedPaise / 100 : budget;

  // Calculate Agreement Gauge Percentage (Budget vs Minimum)
  const agreementRatio = Math.min(100, Math.max(20, Math.round((totalAgreedInr / (budget || 1)) * 100)));

  return (
    <div
      style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '24px 16px 48px',
        fontFamily: "'Noto Sans', sans-serif",
      }}
    >
      {/* Celebration Modal on Agreement */}
      {showCelebration && (
        <AgreementCelebration
          bookingId={bookingId}
          finalPrice={totalAgreedInr}
          onProceedToEscrow={handlePay}
          onClose={() => setShowCelebration(false)}
        />
      )}

      {/* Main 3-Column AI Workspace Grid */}
      <div className="negotiation-workspace-grid">
        {/* ==================================================================
            COLUMN 1: BOOKING SPECIFICATION & EVENT CONTEXT
            ================================================================== */}
        <aside className="negotiation-context-sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <CulturalMotif name="dancer" size={26} />
            <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '18px', color: '#6B1717', margin: 0 }}>
              Event Blueprint
            </h3>
          </div>

          {bookingId ? (
            <div>
              <div style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #E8DCCB' }}>
                <div style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>Active Booking</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '15px', color: '#6B1717' }}>
                  #{bookingId}
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '6px',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 'bold',
                    backgroundColor: currentStatus === 'PAID' ? '#ECFDF5' : '#FFFBEB',
                    color: currentStatus === 'PAID' ? '#15803D' : '#B45309',
                    border: `1px solid ${currentStatus === 'PAID' ? '#A7F3D0' : '#FDE68A'}`,
                  }}
                >
                  {currentStatus}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                <div>
                  <span style={{ color: '#6B5E4F' }}>Organizer:</span>
                  <div style={{ fontWeight: 600 }}>{booking?.organizer_name || organizerName}</div>
                </div>

                <div>
                  <span style={{ color: '#6B5E4F' }}>Event Date &amp; Time:</span>
                  <div style={{ fontWeight: 600 }}>{booking?.event_date || eventDate} at {booking?.event_time || eventTime}</div>
                </div>

                <div>
                  <span style={{ color: '#6B5E4F' }}>Venue:</span>
                  <div style={{ fontWeight: 600 }}>{booking?.venue_address || venueAddress || 'Confidential'}</div>
                </div>

                <div>
                  <span style={{ color: '#6B5E4F' }}>Total Budget Ceiling:</span>
                  <div style={{ fontWeight: 'bold', color: '#B84220', fontSize: '16px' }}>
                    ₹{((booking?.budget ? booking.budget / 100 : budget) || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid #E8DCCB', paddingTop: '14px' }}>
                <button
                  type="button"
                  className="folk-btn-secondary"
                  onClick={() => setBookingId('')}
                  style={{ width: '100%', fontSize: '13px', padding: '6px 10px' }}
                >
                  + New Booking Request
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form when no booking is active */
            <form onSubmit={handleSendRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Organizer Name
                </label>
                <input
                  type="text"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '13.5px', border: '1px solid #C4A482', borderRadius: '6px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Event Date &amp; Time
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #C4A482', borderRadius: '6px' }}
                    required
                  />
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #C4A482', borderRadius: '6px' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Venue Address
                </label>
                <input
                  type="text"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '13.5px', border: '1px solid #C4A482', borderRadius: '6px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Budget Ceiling: ₹{Number(budget).toLocaleString('en-IN')}
                </label>
                <input
                  type="range"
                  min="10000"
                  max="60000"
                  step="2000"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#B84220' }}
                />
              </div>

              <button
                type="submit"
                className="folk-btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '10px 14px', fontSize: '14px', marginTop: '6px' }}
              >
                {loading ? 'Evaluating...' : '🚀 Submit & Launch AI'}
              </button>
            </form>
          )}
        </aside>

        {/* ==================================================================
            COLUMN 2: DUAL-AGENT NEGOTIATION CONVERSATION
            ================================================================== */}
        <main className="negotiation-chat-center">
          {/* Header */}
          <div className="negotiation-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Diya size={28} animated />
              <div>
                <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '19px', color: '#6B1717', margin: 0 }}>
                  AI Multi-Agent Negotiation Workspace
                </h3>
                <div style={{ fontSize: '12.5px', color: '#6B5E4F' }}>
                  Organizer Agent 🧑💼 × Artist Representative Agent 🪕
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  background: '#FAF5EE',
                  border: '1px solid #C4A482',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#6B1717',
                }}
              >
                Booking: #{bookingId ? bookingId.slice(0, 10) : 'NEW'}
              </span>

              {bookingId && (
                <button
                  type="button"
                  className="folk-btn-secondary"
                  onClick={handleTriggerNegotiate}
                  disabled={loading}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  title="Run re-negotiation cycle"
                >
                  ⚡ Re-Evaluate
                </button>
              )}
            </div>
          </div>

          {/* Chat Feed */}
          <div className="negotiation-chat-feed">
            {error && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1.5px solid #EF4444',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#991B1B',
                  fontSize: '13.5px',
                }}
              >
                {error}
              </div>
            )}

            {/* Introductory Explanation if chat is empty */}
            {chatMessages.length === 0 && !bookingId && (
              <div className="chat-bubble system">
                <strong>✦ Dual-Agent Negotiation Protocol Ready:</strong>
                <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>
                  Fill the event blueprint on the left or launch a demo scenario to see the Organizer Agent
                  and Artist Representative negotiate fair wages in real-time.
                </p>
              </div>
            )}

            {/* Chat Messages */}
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble ${
                  msg.sender === 'Organizer'
                    ? 'organizer'
                    : msg.sender.includes('Artist')
                    ? 'artist'
                    : 'system'
                }`}
              >
                <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.8 }}>
                  {msg.sender === 'Organizer' ? '🧑💼 Organizer Ingestion' : '🤖 ' + msg.sender}
                </div>
                <div>{msg.content}</div>

                {/* If negotiation roles attached */}
                {msg.negotiation && msg.negotiation.roles && (
                  <div style={{ marginTop: '10px', borderTop: '1px dashed rgba(0,0,0,0.15)', paddingTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Evaluated Roles:</div>
                    {Object.entries(msg.negotiation.roles).map(([rName, rInfo]) => (
                      <div
                        key={rName}
                        style={{
                          fontSize: '12.5px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '3px',
                        }}
                      >
                        <span>{rName}: {rInfo.artist_id || 'Standby Searching'}</span>
                        <strong>₹{((rInfo.price || 0) / 100).toLocaleString('en-IN')} ({rInfo.status})</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Live Booking Negotiated Roles Output */}
            {bookingId && Object.keys(negotiatedRoles).length > 0 && (
              <div className="chat-bubble artist">
                <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', color: '#92400E' }}>
                  🪕 Artist Representative Response
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
                  Matched candidate artists against rate cards and travel distance ({distanceKm} km). All proposed artists satisfy village artisan minimums.
                </p>
                <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '10px', border: '1px solid #FDE68A' }}>
                  {Object.entries(negotiatedRoles).map(([rName, info]) => (
                    <div key={rName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span><strong>{rName}</strong>: {info.artist_id}</span>
                      <span style={{ color: '#15803D', fontWeight: 'bold' }}>
                        ₹{((info.price || 0) / 100).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Typing Indicator */}
            {loading && (
              <div className="chat-bubble system" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ animation: 'pulseSubtle 1s infinite' }}>🤖</span>
                <span>Agents computing rate card compatibility, travel distance &amp; standby availability...</span>
              </div>
            )}
          </div>

          {/* Timeline Footer Component */}
          {booking && <BookingTimeline booking={booking} />}
        </main>

        {/* ==================================================================
            COLUMN 3: NEGOTIATION INTELLIGENCE & TELEMETRY
            ================================================================== */}
        <aside className="negotiation-intel-sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '20px' }}>🧠</span>
            <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '18px', color: '#6B1717', margin: 0 }}>
              Negotiation Intel
            </h3>
          </div>

          {/* Metric 1: Agreed vs Budget */}
          <div style={{ background: '#FAF6EE', border: '1px solid #E8DCCB', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', color: '#6B5E4F', textTransform: 'uppercase' }}>Target Compensation</div>
            <div
              style={{
                fontFamily: "'Yatra One', cursive",
                fontSize: '26px',
                color: '#B84220',
                margin: '2px 0',
              }}
            >
              ₹{totalAgreedInr.toLocaleString('en-IN')}
            </div>

            {/* Agreement Zone Meter */}
            <div className="agreement-zone-meter">
              <div className="agreement-zone-fill" style={{ width: `${agreementRatio}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B5E4F' }}>
              <span>Artist Floor</span>
              <span>{agreementRatio}% Alignment</span>
              <span>Max Budget</span>
            </div>
          </div>

          {/* Metric 2: Standby Candidates Substitution Checks */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#6B1717', marginBottom: '8px' }}>
              Standby &amp; Substitution Checks
            </div>

            {Object.entries(negotiatedRoles).length === 0 ? (
              <p style={{ fontSize: '12.5px', color: '#6B5E4F', margin: 0 }}>
                No active substitutions. Running baseline allocation.
              </p>
            ) : (
              Object.entries(negotiatedRoles).map(([rName, info]) => {
                const needsApproval =
                  info.status === 'STANDBY_CHECKED' ||
                  (info.reasons && info.reasons.some((r) => r.includes('DIFFERENT_ART_FORM') || r.includes('PRICE_ABOVE')));

                return (
                  <div
                    key={rName}
                    style={{
                      background: needsApproval ? '#FFFBEB' : '#FFFFFF',
                      border: `1.5px solid ${needsApproval ? '#F59E0B' : '#E8DCCB'}`,
                      borderRadius: '8px',
                      padding: '10px',
                      marginBottom: '8px',
                      fontSize: '12.5px',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#1F1A14' }}>{rName}</div>
                    <div style={{ color: '#6B5E4F', marginTop: '2px' }}>
                      Candidate: <strong>{info.artist_id || 'Searching'}</strong>
                    </div>

                    {info.reasons && info.reasons.length > 0 && (
                      <div style={{ color: '#B45309', fontSize: '11.5px', marginTop: '4px' }}>
                        ⚠️ {info.reasons.map(formatReason).join('; ')}
                      </div>
                    )}

                    {needsApproval && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                        <button
                          type="button"
                          className="folk-btn-primary"
                          onClick={() => handleApproveChange(rName, info.artist_id)}
                          style={{ padding: '4px 8px', fontSize: '11.5px' }}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="folk-btn-secondary"
                          onClick={() => handleRejectChange(rName)}
                          style={{ padding: '4px 8px', fontSize: '11.5px' }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Payment CTA Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #C4A482',
              borderRadius: '10px',
              padding: '16px',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#6B1717', marginBottom: '6px' }}>
              TrustPay Escrow Funding
            </div>

            {/* Tasteful Simulated Payment Warning Banner */}
            <div
              style={{
                background: '#FFFBEB',
                border: '1.5px dashed #D97706',
                borderRadius: '6px',
                padding: '8px',
                fontSize: '11px',
                color: '#92400E',
                marginBottom: '10px',
                lineHeight: 1.4,
              }}
            >
              🔒 <strong>SIMULATED PAYMENT:</strong> Test provider active. No real credit card or bank funds are debited.
            </div>

            <button
              type="button"
              className="folk-btn-primary"
              onClick={handlePay}
              disabled={loading || !bookingId || currentStatus === 'PAID'}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(184, 66, 32, 0.25)',
                opacity: currentStatus === 'PAID' ? 0.6 : 1,
              }}
            >
              {currentStatus === 'PAID' ? '✓ Escrow Funded' : 'Pay (Simulated Escrow)'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
