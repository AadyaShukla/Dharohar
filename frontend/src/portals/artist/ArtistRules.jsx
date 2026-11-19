import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { updateMyArtistRules, updateMyAvailability, getMyArtistProfile } from '../../api';
import { ErrorBanner } from '../../components/shared/States';

export default function ArtistRules() {
  const { lang, profile, reloadArtistData } = useOutletContext() || {};

  const [minFee, setMinFee] = useState(profile?.fair_floor || profile?.base_honorarium || 10000);
  const [travelKm, setTravelKm] = useState(profile?.travel_range_km || 150);
  const [blackoutDates, setBlackoutDates] = useState(profile?.blackout_dates || []);
  const [newBlackoutDate, setNewBlackoutDate] = useState('2026-12-25');

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (profile) {
      if (profile.fair_floor || profile.base_honorarium) {
        setMinFee(profile.fair_floor || profile.base_honorarium);
      }
      if (profile.travel_range_km) {
        setTravelKm(profile.travel_range_km);
      }
      if (profile.blackout_dates) {
        setBlackoutDates(profile.blackout_dates);
      }
    }
  }, [profile]);

  async function handleSaveRules(e) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await updateMyArtistRules({
        min_fee: Number(minFee),
        travel_range_km: Number(travelKm),
        blackout_dates: blackoutDates,
      });
      setNotice(lang === 'hi' ? '✓ आपके नियम सुरक्षित कर लिए गए हैं!' : '✓ Your rules have been saved successfully!');
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Failed to update rules');
    } finally {
      setSaving(false);
    }
  }

  function handleAddBlackoutDate() {
    if (newBlackoutDate && !blackoutDates.includes(newBlackoutDate)) {
      setBlackoutDates([...blackoutDates, newBlackoutDate]);
    }
  }

  function handleRemoveBlackoutDate(d) {
    setBlackoutDates(blackoutDates.filter((item) => item !== d));
  }

  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0' }}>
          {lang === 'hi' ? 'मेरे प्रदर्शन नियम (My Rules)' : 'My Performance Rules'}
        </h1>
        <p style={{ fontSize: '15px', color: '#525866', margin: 0, lineHeight: 1.5 }}>
          {lang === 'hi'
            ? 'अपनी पसंद का न्यूनतम मानदेय और यात्रा दूरी तय करें। AI एजेंट आपकी शर्तों से नीचे कोई प्रस्ताव नहीं बनने देगा।'
            : 'Set your minimum fee floor and travel radius. The AI agent will strictly reject lowball offers below your floor.'}
        </p>
      </div>

      {error && <ErrorBanner title={lang === 'hi' ? 'त्रुटि' : 'Error'} message={error} />}
      {notice && (
        <div style={{ padding: '14px 18px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', color: '#15803D', fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>
          {notice}
        </div>
      )}

      <form onSubmit={handleSaveRules} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Rule 1: Minimum Honorarium Floor */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#141B2D', marginBottom: '4px' }}>
            {lang === 'hi' ? '१. न्यूनतम मानदेय सीमा (Minimum Fee Floor)' : '1. Minimum Honorarium Floor'}
          </label>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 16px 0' }}>
            {lang === 'hi'
              ? 'इससे कम राशि का कोई भी प्रस्ताव हमारे AI एजेंट द्वारा अस्वीकार कर दिया जाएगा।'
              : 'Our AI agent will automatically reject any offer below this amount.'}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button
              type="button"
              onClick={() => setMinFee((prev) => Math.max(3000, Number(prev) - 1000))}
              style={{ width: '48px', height: '48px', borderRadius: '10px', border: '1.5px solid #D1D5DB', backgroundColor: '#FAF8F4', fontSize: '22px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              -
            </button>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#C2410C', fontFamily: 'monospace' }}>
              ₹{Number(minFee).toLocaleString('en-IN')}
            </div>
            <button
              type="button"
              onClick={() => setMinFee((prev) => Number(prev) + 1000)}
              style={{ width: '48px', height: '48px', borderRadius: '10px', border: '1.5px solid #D1D5DB', backgroundColor: '#FAF8F4', fontSize: '22px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              +
            </button>
          </div>

          <input
            type="range"
            min="3000"
            max="60000"
            step="1000"
            value={minFee}
            onChange={(e) => setMinFee(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#C2410C', height: '6px' }}
          />
        </div>

        {/* Rule 2: Travel Distance Range */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#141B2D', marginBottom: '4px' }}>
            {lang === 'hi' ? '२. अधिकतम यात्रा दूरी (Maximum Travel Distance)' : '2. Maximum Travel Range'}
          </label>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 16px 0' }}>
            {lang === 'hi'
              ? 'आप अपने गाँव/शहर से कितनी दूरी तक जा सकते हैं?'
              : 'How far can your ensemble travel from your home city/village?'}
          </p>

          <div style={{ textAlign: 'center', fontSize: '28px', fontWeight: 800, color: '#1E3A8A', marginBottom: '12px' }}>
            🚗 {travelKm} km
          </div>

          <input
            type="range"
            min="20"
            max="600"
            step="20"
            value={travelKm}
            onChange={(e) => setTravelKm(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#1E3A8A', height: '6px' }}
          />
        </div>

        {/* Rule 3: Blackout Dates */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <label style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: '#141B2D', marginBottom: '4px' }}>
            {lang === 'hi' ? '३. व्यस्त तिथियाँ (Blackout / Unavailable Dates)' : '3. Blackout / Unavailable Dates'}
          </label>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 14px 0' }}>
            {lang === 'hi'
              ? 'जिन तारीखों पर आप किसी अन्य मेले या निजी काम में व्यस्त हैं, उन्हें यहाँ जोड़ें।'
              : 'Add dates when you are busy with regional melas, rituals, or private family events.'}
          </p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              type="date"
              value={newBlackoutDate}
              onChange={(e) => setNewBlackoutDate(e.target.value)}
              style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #D1D5DB', fontSize: '15px' }}
            />
            <button
              type="button"
              onClick={handleAddBlackoutDate}
              style={{ padding: '10px 18px', backgroundColor: '#F3EDE4', color: '#141B2D', border: '1px solid #D1D5DB', borderRadius: '10px', fontWeight: 700, fontSize: '14.5px', cursor: 'pointer' }}
            >
              + {lang === 'hi' ? 'जोड़ें' : 'Add'}
            </button>
          </div>

          {blackoutDates.length === 0 ? (
            <div style={{ fontSize: '14px', color: '#6B7280', fontStyle: 'italic' }}>
              {lang === 'hi' ? 'कोई व्यस्त तारीख नहीं जोड़ी गई है (सभी दिन उपलब्ध हैं)।' : 'No blackout dates listed (currently available everyday).'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {blackoutDates.map((date) => (
                <span
                  key={date}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    backgroundColor: '#FEE2E2',
                    color: '#991B1B',
                    fontSize: '13.5px',
                    fontWeight: 600,
                  }}
                >
                  📅 {date}
                  <button
                    type="button"
                    onClick={() => handleRemoveBlackoutDate(date)}
                    style={{ border: 'none', background: 'transparent', color: '#991B1B', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Big Save Button */}
        <button
          type="submit"
          disabled={saving}
          style={{
            height: '56px',
            backgroundColor: '#C2410C',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '14px',
            fontSize: '18px',
            fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(194, 65, 12, 0.3)',
          }}
        >
          {saving ? 'सुरक्षित हो रहा है...' : lang === 'hi' ? '✓ नियम सुरक्षित करें (Save Rules)' : '✓ Save Rules'}
        </button>
      </form>
    </div>
  );
}

