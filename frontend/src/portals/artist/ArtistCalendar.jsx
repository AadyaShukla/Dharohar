import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { updateMyAvailability } from '../../api';
import { ErrorBanner } from '../../components/shared/States';

export default function ArtistCalendar() {
  const { lang, profile, artistId, myOffers, reloadArtistData } = useOutletContext() || {};

  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  // Blackout dates from profile
  const blackoutDates = profile?.blackout_dates || [];

  // Booked dates from offers where artist approved or status is PAID/ESCROW
  const bookedDates = (myOffers || [])
    .filter((b) => b.artist_approvals?.[artistId] === 'APPROVED' || b.status === 'PAID' || b.status === 'ESCROW_HELD')
    .map((b) => b.event_date);

  // Simple visual 30-day projection starting from Dec 1, 2026 or today
  const baseDate = new Date(2026, 11 + currentMonthOffset, 1);
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const monthName = baseDate.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', { month: 'long', year: 'numeric' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const isBooked = bookedDates.includes(dateString);
    const isBlackout = blackoutDates.includes(dateString);
    return { dayNum, dateString, isBooked, isBlackout };
  });

  async function handleToggleDate(dateString, isCurrentlyBlackout) {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      let updated;
      if (isCurrentlyBlackout) {
        updated = blackoutDates.filter((d) => d !== dateString);
      } else {
        updated = [...blackoutDates, dateString];
      }
      await updateMyAvailability({ blackout_dates: updated });
      setNotice(
        isCurrentlyBlackout
          ? lang === 'hi' ? `✓ ${dateString} अब उपलब्ध चिह्नित कर दिया गया है` : `✓ ${dateString} marked as Available`
          : lang === 'hi' ? `✕ ${dateString} व्यस्त (Blackout) चिह्नित किया गया` : `✕ ${dateString} marked as Blackout / Busy`
      );
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Failed to update calendar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0' }}>
          {lang === 'hi' ? 'कार्यक्रम कैलेंडर (Calendar)' : 'Performance Schedule & Calendar'}
        </h1>
        <p style={{ fontSize: '15px', color: '#525866', margin: 0 }}>
          {lang === 'hi'
            ? 'अपनी उपलब्धता देखें। किसी भी तारीख को छूकर व्यस्त (Blackout) या उपलब्ध बदलें।'
            : 'Tap any day to toggle between Available and Blackout/Busy. Confirmed shows are highlighted.'}
        </p>
      </div>

      {error && <ErrorBanner title={lang === 'hi' ? 'त्रुटि' : 'Error'} message={error} />}
      {notice && (
        <div style={{ padding: '12px 16px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', color: '#15803D', fontWeight: 700, fontSize: '15px', marginBottom: '18px' }}>
          {notice}
        </div>
      )}

      {/* Calendar Card */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #E5E7EB',
          borderRadius: '18px',
          padding: '20px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          marginBottom: '24px',
        }}
      >
        {/* Month Header with Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <button
            type="button"
            onClick={() => setCurrentMonthOffset((prev) => prev - 1)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FAF8F4', fontWeight: 700, cursor: 'pointer' }}
          >
            ← {lang === 'hi' ? 'पिछला' : 'Prev'}
          </button>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#C2410C', margin: 0 }}>
            {monthName}
          </h2>
          <button
            type="button"
            onClick={() => setCurrentMonthOffset((prev) => prev + 1)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FAF8F4', fontWeight: 700, cursor: 'pointer' }}
          >
            {lang === 'hi' ? 'अगला' : 'Next'} →
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#15803D' }} />
            {lang === 'hi' ? 'पक्का शो' : 'Confirmed Show'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
            {lang === 'hi' ? 'व्यस्त' : 'Blackout / Busy'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#E5E7EB' }} />
            {lang === 'hi' ? 'उपलब्ध' : 'Available'}
          </span>
        </div>

        {/* Calendar Grid (7 columns) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
          {['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'].map((weekday, idx) => (
            <div key={idx} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#6B7280', padding: '4px' }}>
              {lang === 'hi' ? weekday : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][idx]}
            </div>
          ))}

          {days.map(({ dayNum, dateString, isBooked, isBlackout }) => {
            let bg = '#FAF8F4';
            let color = '#1F1A14';
            let border = '1px solid #E5E7EB';

            if (isBooked) {
              bg = '#DCFCE7';
              color = '#14532D';
              border = '2px solid #15803D';
            } else if (isBlackout) {
              bg = '#FEE2E2';
              color = '#991B1B';
              border = '2px solid #DC2626';
            }

            return (
              <button
                key={dateString}
                type="button"
                disabled={isBooked || saving}
                onClick={() => handleToggleDate(dateString, isBlackout)}
                style={{
                  height: '52px',
                  borderRadius: '10px',
                  backgroundColor: bg,
                  color: color,
                  border: border,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isBooked ? 'default' : 'pointer',
                  fontWeight: 700,
                  fontSize: '15px',
                  transition: 'transform 0.1s ease',
                }}
                title={isBooked ? 'Confirmed Show' : isBlackout ? 'Click to mark Available' : 'Click to mark Busy'}
              >
                <span>{dayNum}</span>
                <span style={{ fontSize: '10px', marginTop: '2px' }}>
                  {isBooked ? '🎉 Show' : isBlackout ? '✕ Busy' : '✓'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

