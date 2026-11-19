import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { artistApprove, artistDecline, uploadVoiceNote, confirmVoiceProposal } from '../../api';
import { ErrorBanner, EmptyState } from '../../components/shared/States';

export default function ArtistOffers() {
  const { lang, artistId, myOffers, reloadArtistData } = useOutletContext() || {};

  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // Simulated Voice Note State
  const [activeVoiceOfferId, setActiveVoiceOfferId] = useState(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState(null);
  const [confirmingProposal, setConfirmingProposal] = useState(false);

  async function handleApprove(bookingId) {
    setLoadingId(bookingId);
    setError(null);
    setNotice(null);
    try {
      await artistApprove(bookingId, artistId);
      setNotice(lang === 'hi' ? '✓ प्रस्ताव सफलतापूर्वक स्वीकृत कर लिया गया!' : '✓ Offer successfully accepted!');
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Approval failed');
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDecline(bookingId) {
    setLoadingId(bookingId);
    setError(null);
    setNotice(null);
    try {
      await artistDecline(bookingId, artistId);
      setNotice(lang === 'hi' ? 'प्रस्ताव अस्वीकार कर दिया गया।' : 'Offer declined.');
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Decline failed');
    } finally {
      setLoadingId(null);
    }
  }

  function handleSimulateVoiceNote(offerId, currentFee) {
    setActiveVoiceOfferId(offerId);
    setVoicePlaying(true);
    setVoiceTranscript(null);

    // Simulate audio playback and AI Whisper transcription
    setTimeout(() => {
      setVoicePlaying(false);
      const proposedMin = (currentFee || 10000) + 2000;
      setVoiceTranscript({
        proposalId: `prop_${Date.now()}`,
        audioText: lang === 'hi'
          ? `नमस्ते, इस तारीख के लिए हमारा न्यूनतम मानदेय ₹${proposedMin.toLocaleString('en-IN')} होगा क्योंकि दल में 6 कलाकार हैं।`
          : `Hello, for this date our minimum fee proposal will be ₹${proposedMin.toLocaleString('en-IN')} as we have 6 ensemble performers.`,
        proposedMinFee: proposedMin,
      });
    }, 1800);
  }

  async function handleConfirmProposal(confirm) {
    if (!voiceTranscript) return;
    setConfirmingProposal(true);
    try {
      if (confirm) {
        setNotice(
          lang === 'hi'
            ? `✓ नियम प्रस्ताव स्वीकृत! आपका न्यूनतम मानदेय ₹${voiceTranscript.proposedMinFee.toLocaleString('en-IN')} प्रस्तावित किया गया।`
            : `✓ Voice proposal confirmed! Proposed min fee ₹${voiceTranscript.proposedMinFee.toLocaleString('en-IN')} saved.`
        );
      } else {
        setNotice(lang === 'hi' ? 'आवाज़ प्रस्ताव रद्द कर दिया गया।' : 'Voice proposal discarded.');
      }
      setVoiceTranscript(null);
      setActiveVoiceOfferId(null);
    } catch (err) {
      setError(err.message || 'Failed to confirm voice proposal');
    } finally {
      setConfirmingProposal(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 4px 0' }}>
          {lang === 'hi' ? 'आयोजक प्रस्ताव संदेश (WhatsApp शैली)' : 'Organizer Offer Messages'}
        </h1>
        <p style={{ fontSize: '14.5px', color: '#525866', margin: 0 }}>
          {lang === 'hi'
            ? 'यहाँ आप सीधे आयोजकों के प्रस्ताव पढ़ सकते हैं और मंज़ूरी दे सकते हैं।'
            : 'Review direct organizer booking requests formatted in easy-to-read WhatsApp cards.'}
        </p>
      </div>

      {error && <ErrorBanner title={lang === 'hi' ? 'त्रुटि' : 'Error'} message={error} />}
      {notice && (
        <div style={{ padding: '14px 18px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', color: '#15803D', fontWeight: 700, fontSize: '15.5px', marginBottom: '20px' }}>
          {notice}
        </div>
      )}

      {(myOffers || []).length === 0 ? (
        <EmptyState
          title={lang === 'hi' ? 'कोई प्रस्ताव प्राप्त नहीं हुआ' : 'No Offers Received Yet'}
          description={
            lang === 'hi'
              ? 'जब कोई आयोजक आपकी कला का चयन करेगा तो संदेश यहाँ आएगा।'
              : 'When event organizers request your performance, full offer cards will appear here.'
          }
          icon="📩"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {(myOffers || []).map((offer) => {
            const roleMatch = offer.negotiated_roles
              ? Object.entries(offer.negotiated_roles).find(([_, r]) => r.artist_id === artistId)
              : null;
            const offerPrice = roleMatch ? roleMatch[1].price / 100 : (offer.budget_paise ? offer.budget_paise / 100 : offer.budget) || 14000;
            const isApproved = offer.artist_approvals?.[artistId] === 'APPROVED';
            const isDeclined = offer.artist_approvals?.[artistId] === 'DECLINED';

            return (
              <div
                key={offer.id}
                style={{
                  backgroundColor: '#DCF8C6', // WhatsApp incoming message tint
                  border: '2px solid #A7F3D0',
                  borderRadius: '18px 18px 18px 4px', // WhatsApp speech bubble shape
                  padding: '18px 20px',
                  boxShadow: '0 3px 12px rgba(0,0,0,0.06)',
                  position: 'relative',
                }}
              >
                {/* Header Tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🏛️</span>
                    <div>
                      <strong style={{ fontSize: '16px', color: '#065F46' }}>
                        {offer.organizer_name || 'होटल / आयोजक (Patron)'}
                      </strong>
                      <div style={{ fontSize: '12px', color: '#047857' }}>
                        {offer.organizer_phone ? `+91 ${offer.organizer_phone}` : 'Verified Organizer'}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: isApproved ? '#15803D' : isDeclined ? '#DC2626' : '#F59E0B',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 800,
                    }}
                  >
                    {isApproved
                      ? lang === 'hi' ? 'स्वीकृत ✓' : 'Accepted ✓'
                      : isDeclined
                      ? lang === 'hi' ? 'अस्वीकृत ✕' : 'Declined ✕'
                      : lang === 'hi' ? 'नया प्रस्ताव ✦' : 'New Offer ✦'}
                  </span>
                </div>

                {/* Offer Details Body */}
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    border: '1px solid #D1FAE5',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #F3F4F6', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '14px', color: '#4B5563', fontWeight: 600 }}>
                      {lang === 'hi' ? 'प्रस्तावित मानदेय' : 'Proposed Honorarium'}:
                    </span>
                    <span style={{ fontSize: '26px', fontWeight: 900, color: '#15803D' }}>
                      ₹{offerPrice.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px', color: '#374151' }}>
                    <div>
                      <span style={{ color: '#6B7280', fontSize: '12px', display: 'block' }}>
                        {lang === 'hi' ? 'कार्यक्रम तारीख' : 'Event Date'}
                      </span>
                      <strong>📅 {offer.event_date || '2026-12-20'}</strong>
                    </div>

                    <div>
                      <span style={{ color: '#6B7280', fontSize: '12px', display: 'block' }}>
                        {lang === 'hi' ? 'समय व अवधि' : 'Time & Duration'}
                      </span>
                      <strong>⏰ {offer.event_time || '18:00'} ({offer.expected_duration_minutes || 60}m)</strong>
                    </div>

                    <div>
                      <span style={{ color: '#6B7280', fontSize: '12px', display: 'block' }}>
                        {lang === 'hi' ? 'कला शैली' : 'Art Form'}
                      </span>
                      <strong>🪕 {offer.art_form_requested || 'Folk Music / Dance'}</strong>
                    </div>

                    <div>
                      <span style={{ color: '#6B7280', fontSize: '12px', display: 'block' }}>
                        {lang === 'hi' ? 'दल का आकार' : 'Group Size'}
                      </span>
                      <strong>👥 {offer.group_size || 6} {lang === 'hi' ? 'कलाकार' : 'artists'}</strong>
                    </div>
                  </div>

                  {offer.notes && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F3F4F6', fontSize: '13.5px', color: '#4B5563', fontStyle: 'italic' }}>
                      "{offer.notes}"
                    </div>
                  )}
                </div>

                {/* Voice Note Simulation Area */}
                <div style={{ marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => handleSimulateVoiceNote(offer.id, offerPrice)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid #059669',
                      borderRadius: '12px',
                      color: '#065F46',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>🎙️</span>
                    <span>
                      {voicePlaying && activeVoiceOfferId === offer.id
                        ? lang === 'hi' ? 'आवाज़ रिकॉर्डिंग सुन रहे हैं...' : 'Transcribing voice note...'
                        : lang === 'hi' ? 'आवाज़ संदेश (Voice note simulated)' : 'Voice note (simulated)'}
                    </span>
                  </button>

                  {/* Transcript Proposal Card if voice note simulated */}
                  {voiceTranscript && activeVoiceOfferId === offer.id && (
                    <div
                      style={{
                        marginTop: '12px',
                        backgroundColor: '#FFFBEB',
                        border: '2px solid #F59E0B',
                        borderRadius: '12px',
                        padding: '16px',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', marginBottom: '6px' }}>
                        🎙️ {lang === 'hi' ? 'आवाज़ संदेश ट्रांसक्रिप्ट (Speech-to-Text)' : 'Voice Note Transcript'}
                      </div>
                      <p style={{ fontSize: '14.5px', color: '#1F1A14', fontStyle: 'italic', margin: '0 0 10px 0' }}>
                        "{voiceTranscript.audioText}"
                      </p>
                      <div style={{ fontSize: '14px', color: '#92400E', fontWeight: 600, marginBottom: '12px' }}>
                        {lang === 'hi' ? 'प्रस्तावित नया मानदेय:' : 'Proposed Rule Change:'} ₹{voiceTranscript.proposedMinFee.toLocaleString('en-IN')}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => handleConfirmProposal(true)}
                          disabled={confirmingProposal}
                          style={{
                            padding: '10px',
                            backgroundColor: '#15803D',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: 'pointer',
                          }}
                        >
                          {lang === 'hi' ? 'प्रस्ताव भेजें' : 'Confirm Change'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmProposal(false)}
                          disabled={confirmingProposal}
                          style={{
                            padding: '10px',
                            backgroundColor: '#F3EDE4',
                            color: '#141B2D',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: 'pointer',
                          }}
                        >
                          {lang === 'hi' ? 'रद्द करें' : 'Discard'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Big Approve / Decline Buttons */}
                {!isApproved && !isDeclined ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => handleApprove(offer.id)}
                      disabled={loadingId === offer.id}
                      style={{
                        height: '54px',
                        backgroundColor: '#15803D',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '17px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(21, 128, 61, 0.3)',
                      }}
                    >
                      {loadingId === offer.id ? '...' : lang === 'hi' ? '✓ स्वीकार करें (Approve)' : '✓ Approve Offer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecline(offer.id)}
                      disabled={loadingId === offer.id}
                      style={{
                        height: '54px',
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        border: '1.5px solid #FCA5A5',
                        borderRadius: '12px',
                        fontSize: '16px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {lang === 'hi' ? '✕ अस्वीकार' : '✕ Decline'}
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '8px', fontWeight: 700, fontSize: '15px', color: isApproved ? '#15803D' : '#991B1B' }}>
                    {isApproved
                      ? lang === 'hi' ? '✓ यह कार्यक्रम आपके द्वारा स्वीकृत है' : '✓ You have accepted this booking'
                      : lang === 'hi' ? '✕ आपने यह प्रस्ताव अस्वीकार कर दिया है' : '✕ You declined this offer'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

