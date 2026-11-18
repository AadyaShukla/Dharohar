import React, { useState, useEffect } from 'react';
import { createBooking, negotiate, quickLoginAs } from '../api';
import Diya from './folk/Diya';
import PaisleyBorder from './folk/PaisleyBorder';

export default function BookingRequestModal({
  isOpen,
  onClose,
  initialArtist,
  onBookingCreated,
  currentUser,
}) {
  const [organizerName, setOrganizerName] = useState(
    currentUser?.name || 'Hotel Rajmahal Heritage (fictional)'
  );
  const [eventDate, setEventDate] = useState('2026-11-20');
  const [eventTime, setEventTime] = useState('18:00');
  const [venueAddress, setVenueAddress] = useState('City Palace Courtyard, Udaipur');
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

    // Auto-update total budget if individual role budgets change
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
    e.preventDefault();
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
        distance_km: 100,
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
        backgroundColor: 'rgba(31, 26, 20, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFDF9',
          border: '3px solid #8B2500',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          fontFamily: "'Noto Sans', sans-serif",
          color: '#1F1A14',
          fontSize: '16px',
        }}
      >
        <PaisleyBorder />
        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '2px dashed #D97706',
              paddingBottom: '14px',
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Diya />
              <div>
                <h2
                  style={{
                    fontFamily: "'Yatra One', cursive",
                    fontSize: '24px',
                    color: '#8B2500',
                    margin: 0,
                  }}
                >
                  Create Booking Request
                </h2>
                <div style={{ fontSize: '14px', color: '#6B5E4F', marginTop: '2px' }}>
                  AI multi-agent negotiation with strict venue privacy
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                color: '#8B2500',
                fontWeight: 'bold',
                padding: '4px 8px',
              }}
            >
              ✕
            </button>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '2px solid #DC2626',
                borderRadius: '8px',
                padding: '12px',
                color: '#991B1B',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Roles Needed Section */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                padding: '16px',
                borderRadius: '8px',
                border: '2px solid #C4A482',
                marginBottom: '18px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    color: '#8B2500',
                    fontSize: '18px',
                    fontFamily: "'Yatra One', cursive",
                  }}
                >
                  Roles Needed
                </h4>
                <button
                  type="button"
                  onClick={handleAddRole}
                  style={{
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #166534',
                    color: '#166534',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  + Add Role
                </button>
              </div>

              {roles.map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    marginBottom: '10px',
                    backgroundColor: '#FDFBF7',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #E5D5C5',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    type="text"
                    required
                    value={r.role}
                    onChange={(e) => handleRoleChange(idx, 'role', e.target.value)}
                    placeholder="Role Title"
                    style={{
                      flex: '1 1 120px',
                      padding: '8px 10px',
                      fontSize: '15px',
                      border: '1px solid #C4A482',
                      borderRadius: '4px',
                    }}
                  />
                  <input
                    type="text"
                    required
                    value={r.art_form}
                    onChange={(e) => handleRoleChange(idx, 'art_form', e.target.value)}
                    placeholder="Art Form"
                    style={{
                      flex: '1 1 160px',
                      padding: '8px 10px',
                      fontSize: '15px',
                      border: '1px solid #C4A482',
                      borderRadius: '4px',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold' }}>₹</span>
                    <input
                      type="number"
                      required
                      min={1000}
                      step={500}
                      value={r.budget}
                      onChange={(e) => handleRoleChange(idx, 'budget', Number(e.target.value))}
                      placeholder="Budget"
                      style={{
                        width: '90px',
                        padding: '8px 10px',
                        fontSize: '15px',
                        border: '1px solid #C4A482',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  {roles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRole(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#DC2626',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Event Date, Time & Expected Duration */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                  Event Date *
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                  Event Time *
                </label>
                <input
                  type="time"
                  required
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                  Duration (Mins) *
                </label>
                <input
                  type="number"
                  required
                  min={30}
                  step={15}
                  value={expectedDuration}
                  onChange={(e) => setExpectedDuration(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Total Budget & Group Size */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                  Total Budget (₹ INR) *
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={500}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    fontWeight: 'bold',
                    color: '#8B2500',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                  Expected Group Size (Artists) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={groupSize}
                  onChange={(e) => setGroupSize(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Venue Address with Privacy Notice */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '6px',
                }}
              >
                <label style={{ fontWeight: 'bold' }}>Venue Address *</label>
                <span style={{ fontSize: '13px', color: '#B45309', fontWeight: 'bold' }}>
                  🔒 Hidden from artists until payment
                </span>
              </div>
              <textarea
                required
                rows={2}
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="Exact venue address and landmark..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '16px',
                  border: '2px solid #C4A482',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: "'Noto Sans', sans-serif",
                }}
              />
              <div
                style={{
                  fontSize: '13px',
                  color: '#6B5E4F',
                  marginTop: '4px',
                  backgroundColor: '#FFFBEB',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid #FDE68A',
                }}
              >
                🛡️ Dharohar Privacy Policy: Venue and contact details are masked during negotiation
                and only revealed once escrow deposit is confirmed.
              </div>
            </div>

            {/* Special Instructions / Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px' }}>
                Special Notes / Requirements
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Stage lighting setup, acoustic preferences, arrival timeline..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '16px',
                  border: '2px solid #C4A482',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: "'Noto Sans', sans-serif",
                }}
              />
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid #E5D5C5',
                paddingTop: '16px',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#F3EDE4',
                  border: '2px solid #C4A482',
                  borderRadius: '6px',
                  color: '#4A3E31',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '10px 24px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#8B2500',
                  border: '2px solid #5A1800',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              >
                {loading ? 'Initiating Negotiation...' : 'Submit & Start Negotiation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
