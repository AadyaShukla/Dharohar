import React, { useState, useEffect } from 'react';
import { getOrganizerProfile, updateOrganizerProfile } from '../api';
import Diya from './folk/Diya';
import PaisleyBorder from './folk/PaisleyBorder';

export default function OrganizerProfileModal({ isOpen, onClose, onUpdated }) {
  const [profile, setProfile] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('hotel');
  const [gstNumber, setGstNumber] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrganizerProfile();
      setProfile(data);
      setOrgName(data.organization_name || '');
      setOrgType(data.org_type || 'hotel');
      setGstNumber(data.gst_number || '');
      setWorkEmail(data.work_email || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const res = await updateOrganizerProfile({
        organization_name: orgName.trim(),
        org_type: orgType,
        gst_number: gstNumber.trim() || null,
        work_email: workEmail.trim() || null,
      });
      setProfile(res.profile);
      setSuccessNotice('Organization profile saved successfully!');
      if (onUpdated) onUpdated(res.profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const isVerified = profile?.verification_status === 'VERIFIED';

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
          maxWidth: '560px',
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
              <h2
                style={{
                  fontFamily: "'Yatra One', cursive",
                  fontSize: '24px',
                  color: '#8B2500',
                  margin: 0,
                }}
              >
                Organizer Profile
              </h2>
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

          {/* Verification Status Pill Banner */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              backgroundColor: isVerified ? '#ECFDF5' : '#FFFBEB',
              border: `2px solid ${isVerified ? '#166534' : '#D97706'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 'bold',
                  color: isVerified ? '#166534' : '#B45309',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{isVerified ? '🛡️ VERIFIED ORGANIZER' : '⚠️ UNVERIFIED ORGANIZER'}</span>
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#4A3E31',
                  marginTop: '4px',
                }}
              >
                {isVerified
                  ? 'Unlimited bookings and high-value escrow payments enabled.'
                  : 'Escrow payment capped at ₹20,000 until operator verification is completed.'}
              </div>
            </div>
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
                fontSize: '15px',
              }}
            >
              {error}
            </div>
          )}

          {successNotice && (
            <div
              style={{
                backgroundColor: '#F0FDF4',
                border: '2px solid #16A34A',
                borderRadius: '8px',
                padding: '12px',
                color: '#166534',
                marginBottom: '16px',
                fontSize: '15px',
                fontWeight: 'bold',
              }}
            >
              {successNotice}
            </div>
          )}

          {loading ? (
            <p style={{ textAlign: 'center', color: '#6B5E4F', padding: '20px' }}>
              Loading profile details...
            </p>
          ) : (
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 'bold',
                    color: '#2D241E',
                    marginBottom: '6px',
                  }}
                >
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Hotel Rajmahal Heritage"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                    color: '#1F1A14',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 'bold',
                    color: '#2D241E',
                    marginBottom: '6px',
                  }}
                >
                  Organization Type *
                </label>
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                    color: '#1F1A14',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="hotel">Hotel / Heritage Resort</option>
                  <option value="school">School / College / University</option>
                  <option value="corporate">Corporate / Event Agency</option>
                  <option value="tour operator">Tour Operator / Travel Agency</option>
                  <option value="individual">Individual Cultural Enthusiast</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 'bold',
                    color: '#2D241E',
                    marginBottom: '6px',
                  }}
                >
                  GST Number (Optional)
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 08AAAAA0000A1Z5"
                  maxLength={15}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                    color: '#1F1A14',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 'bold',
                    color: '#2D241E',
                    marginBottom: '6px',
                  }}
                >
                  Work Email
                </label>
                <input
                  type="email"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="events@yourdomain.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '16px',
                    border: '2px solid #C4A482',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                    color: '#1F1A14',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

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
                  disabled={saving}
                  style={{
                    padding: '10px 24px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    backgroundColor: '#8B2500',
                    border: '2px solid #5A1800',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
