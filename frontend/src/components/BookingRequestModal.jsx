import React, { useState, useEffect } from 'react';
import { createBooking, negotiate, quickLoginAs } from '../api';
import Diya from './folk/Diya';
import TextileBorder from './heritage/TextileBorder';
import HeritageDivider from './heritage/HeritageDivider';
import CulturalMotif from './heritage/CulturalMotif';

export default function BookingRequestModal({
  isOpen,
  onClose,
  initialArtist,
  onBookingCreated,
  currentUser,
}) {
  const [step, setStep] = useState(1); // 1: Event | 2: Roles | 3: Budget & Details | 4: Summary

  const [organizerName, setOrganizerName] = useState(
    currentUser?.name || 'Hotel Rajmahal Heritage (fictional)'
  );
  const [eventDate, setEventDate] = useState('2026-11-20');
  const [eventTime, setEventTime] = useState('18:00');
  const [venueAddress, setVenueAddress] = useState('City Palace Courtyard, Udaipur');
  const [distanceKm, setDistanceKm] = useState(100);
  const [budget, setBudget] = useState(30000);
  const [expectedDuration, setExpectedDuration] = useState(90);
  const [groupSize, setGroupSize] = useState(6);
  const [notes, setNotes] = useState('');

  const [roles, setRoles] = useState([
    { role: 'Dance Group', art_form: 'Kalbelia Dance', budget: 16000 },
    { role: 'Musician Ensemble', art_form: 'Manganiyar Folk Music', budget: 14000 },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialArtist) {
      setRoles([
        {
          role: 'Lead Performance',
          art_form: initialArtist.art_form || 'Kalbelia Dance',
          budget: initialArtist.rate_card?.min_fee || initialArtist.min_fee || 15000,
        },
      ]);
      setBudget(initialArtist.rate_card?.min_fee || initialArtist.min_fee || 15000);
      setGroupSize(initialArtist.group_size || 6);
    }
  }, [initialArtist]);

  function handleRoleChange(idx, field, value) {
    const updated = [...roles];
    updated[idx][field] = value;
    setRoles(updated);

    if (field === 'budget') {
      const total = updated.reduce((sum, r) => sum + (Number(r.budget) || 0), 0);
      setBudget(total);
    }
  }

  function handleAddRole() {
    setRoles([
      ...roles,
      {
        role: `Role ${roles.length + 1}`,
        art_form: 'Manganiyar Folk Music',
        budget: 10000,
      },
    ]);
    setBudget((prev) => prev + 10000);
  }

  function handleRemoveRole(idx) {
    if (roles.length <= 1) return;
    const removedBudget = roles[idx].budget || 0;
    const updated = roles.filter((_, i) => i !== idx);
    setRoles(updated);
    setBudget((prev) => Math.max(0, prev - removedBudget));
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!currentUser || currentUser.role !== 'ORGANIZER') {
        try {
          await quickLoginAs('9000000099');
        } catch (_) {}
      }

      const payload = {
        organizer_name: organizerName.trim(),
        roles: roles.map((r) => ({
          role: r.role,
          art_form: r.art_form,
          budget: Number(r.budget),
        })),
        event_date: eventDate,
        event_time: eventTime,
        venue_address: venueAddress.trim(),
        budget: Number(budget),
        distance_km: Number(distanceKm) || 100,
        expected_duration_minutes: Number(expectedDuration),
        duration_minutes: Number(expectedDuration),
        group_size: Number(groupSize),
        notes: notes.trim(),
      };

      const newBooking = await createBooking(payload);

      // Trigger multi-agent negotiation
      const negResult = await negotiate(newBooking.id).catch((err) => ({
        status: 'NEEDS_OPERATOR',
        error: err.message,
      }));

      if (onBookingCreated) {
        onBookingCreated(newBooking, negResult);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(27, 37, 75, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1060,
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div
        style={{
          backgroundColor: '#FFFDF9',
          border: '3px solid #6B1717',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          fontFamily: "'Noto Sans', sans-serif",
          color: '#1F1A14',
          position: 'relative',
        }}
      >
        <TextileBorder height={16} />

        <div style={{ padding: '24px 30px' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px solid #E8DCCB',
              paddingBottom: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CulturalMotif name="dancer" size={34} />
              <div>
                <h2
                  id="booking-modal-title"
                  style={{
                    fontFamily: "'Yatra One', cursive",
                    fontSize: '26px',
                    color: '#6B1717',
                    margin: 0,
                  }}
                >
                  Create Booking Request
                </h2>
                <div style={{ fontSize: '13.5px', color: '#6B5E4F', marginTop: '2px' }}>
                  AI-assisted fair wage negotiation for authentic living traditions
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6B1717',
                fontWeight: 'bold',
                padding: '4px 8px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Textile-Inspired Multi-Step Indicator */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '24px',
            }}
          >
            {[
              { num: 1, label: 'Event Details' },
              { num: 2, label: 'Performers & Roles' },
              { num: 3, label: 'Budget & Terms' },
              { num: 4, label: 'Review & Submit' },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '8px',
                  border: '1.5px solid',
                  borderColor: step === s.num ? '#6B1717' : step > s.num ? '#15803D' : '#E8DCCB',
                  backgroundColor: step === s.num ? '#FFFBEB' : step > s.num ? '#ECFDF5' : '#FFFFFF',
                  color: step === s.num ? '#6B1717' : step > s.num ? '#15803D' : '#6B7280',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div>0{s.num}</div>
                <div style={{ fontSize: '11.5px', marginTop: '2px' }}>{s.label}</div>
              </button>
            ))}
          </div>

          {error && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '2px solid #EF4444',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#991B1B',
                marginBottom: '18px',
              }}
            >
              {error}
            </div>
          )}

          {/* STEP 1: EVENT DETAILS */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                  Organizer / Organization Name
                </label>
                <input
                  type="text"
                  value={organizerName}
                  onChange={(e) => setOrganizerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '15px',
                    border: '1.5px solid var(--dh-border-heritage)',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '15px',
                      border: '1.5px solid var(--dh-border-heritage)',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                    Event Start Time
                  </label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '15px',
                      border: '1.5px solid var(--dh-border-heritage)',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                  Venue Address (Protected until payment confirmation)
                </label>
                <input
                  type="text"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="e.g. City Palace Courtyard, Udaipur"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '15px',
                    border: '1.5px solid var(--dh-border-heritage)',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                  Travel Distance from Artist Hub (km)
                </label>
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '15px',
                    border: '1.5px solid var(--dh-border-heritage)',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="folk-btn-primary"
                  onClick={() => setStep(2)}
                  style={{ padding: '10px 24px', fontSize: '15px' }}
                >
                  Next: Roles &amp; Requirements →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ROLES & REQUIREMENTS */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#6B1717' }}>
                  Required Troupe Roles ({roles.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddRole}
                  style={{
                    background: '#FAF5EE',
                    border: '1px solid #C4A482',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#6B1717',
                  }}
                >
                  + Add Role
                </button>
              </div>

              {roles.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #E8DCCB',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1.2fr 1fr auto',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#6B5E4F', textTransform: 'uppercase' }}>
                      Role Title
                    </label>
                    <input
                      type="text"
                      value={r.role}
                      onChange={(e) => handleRoleChange(idx, 'role', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '13.5px',
                        border: '1px solid #C4A482',
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#6B5E4F', textTransform: 'uppercase' }}>
                      Art Form
                    </label>
                    <input
                      type="text"
                      value={r.art_form}
                      onChange={(e) => handleRoleChange(idx, 'art_form', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '13.5px',
                        border: '1px solid #C4A482',
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#6B5E4F', textTransform: 'uppercase' }}>
                      Allocated (₹)
                    </label>
                    <input
                      type="number"
                      value={r.budget}
                      onChange={(e) => handleRoleChange(idx, 'budget', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '13.5px',
                        border: '1px solid #C4A482',
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                  {roles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(idx)}
                      style={{
                        background: '#FEF2F2',
                        color: '#DC2626',
                        border: 'none',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        marginTop: '16px',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                    Performance Duration (mins)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="360"
                    value={expectedDuration}
                    onChange={(e) => setExpectedDuration(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '15px',
                      border: '1.5px solid var(--dh-border-heritage)',
                      borderRadius: '8px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                    Expected Group Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={groupSize}
                    onChange={(e) => setGroupSize(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '15px',
                      border: '1.5px solid var(--dh-border-heritage)',
                      borderRadius: '8px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <button
                  type="button"
                  className="folk-btn-secondary"
                  onClick={() => setStep(1)}
                  style={{ padding: '10px 20px', fontSize: '15px' }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="folk-btn-primary"
                  onClick={() => setStep(3)}
                  style={{ padding: '10px 24px', fontSize: '15px' }}
                >
                  Next: Budget &amp; Notes →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: BUDGET & NOTES */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: '#FFF8E7',
                  border: '2px dashed #C69214',
                  borderRadius: '12px',
                  padding: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: '#8D5B18', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Budget Ceiling
                  </div>
                  <div style={{ fontFamily: "'Yatra One', cursive", fontSize: '28px', color: '#B84220' }}>
                    ₹{Number(budget).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B5E4F' }}>
                    Sum of all roles with AI fair wage tolerance
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12.5px', color: '#15803D', fontWeight: 600 }}>
                    🛡️ Protected by TrustPay
                  </span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, marginBottom: '6px', color: '#334155' }}>
                  Special Notes or Stage Instructions
                </label>
                <textarea
                  rows="4"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Outdoor royal courtyard performance, sound setup provided, stage size 24x16 ft..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '14.5px',
                    border: '1.5px solid var(--dh-border-heritage)',
                    borderRadius: '8px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <button
                  type="button"
                  className="folk-btn-secondary"
                  onClick={() => setStep(2)}
                  style={{ padding: '10px 20px', fontSize: '15px' }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="folk-btn-primary"
                  onClick={() => setStep(4)}
                  style={{ padding: '10px 24px', fontSize: '15px' }}
                >
                  Next: Final Review →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & SUBMIT */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: '#FFFFFF',
                  border: '2px solid #C4A482',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <h4 style={{ margin: '0 0 12px', fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717' }}>
                  Booking Summary
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <span style={{ color: '#6B5E4F' }}>Organizer:</span> <strong>{organizerName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B5E4F' }}>Event Date:</span> <strong>{eventDate} at {eventTime}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B5E4F' }}>Venue:</span> <strong>{venueAddress}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B5E4F' }}>Distance:</span> <strong>{distanceKm} km</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B5E4F' }}>Duration:</span> <strong>{expectedDuration} minutes</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6B5E4F' }}>Group Size:</span> <strong>{groupSize} artists</strong>
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #E8DCCB', marginTop: '14px', paddingTop: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#6B5E4F', marginBottom: '6px' }}>
                    <strong>Requested Roles:</strong>
                  </div>
                  {roles.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', marginBottom: '4px' }}>
                      <span>{r.role} ({r.art_form})</span>
                      <strong style={{ color: '#B84220' }}>₹{Number(r.budget).toLocaleString('en-IN')}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  background: '#EFF6FF',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  color: '#1E3A8A',
                }}
              >
                🤖 <strong>AI Negotiation Flow:</strong> Submitting will create this booking and immediately launch dual-agent negotiation between your representative and the artists to finalize pricing and standbys.
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <button
                  type="button"
                  className="folk-btn-secondary"
                  onClick={() => setStep(3)}
                  disabled={loading}
                  style={{ padding: '10px 20px', fontSize: '15px' }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="folk-btn-primary"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    padding: '12px 28px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 16px rgba(184, 66, 32, 0.3)',
                  }}
                >
                  {loading ? 'Submitting & Launching AI...' : 'Submit Request & Launch AI Negotiation'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
