import React, { useState, useEffect } from 'react';
import { getMyArtistProfile, submitArtistForReview, uploadVoiceNote, confirmVoiceProposal } from '../api';
import { getTranslation } from '../i18n';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import PaisleyBorder from './folk/PaisleyBorder';

export default function ArtistDashboard({ onStartWizard, lang = 'hi' }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  // Voice note state
  const [voiceFile, setVoiceFile] = useState(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [voiceProposal, setVoiceProposal] = useState(null);
  const [confirmingProposal, setConfirmingProposal] = useState(false);

  const t = (key) => getTranslation(key, lang);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyArtistProfile();
      setProfile(data);
    } catch (err) {
      setError(err.message || 'Failed to load artist profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReview() {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await submitArtistForReview();
      setNotice(t('msg_submitted'));
      await loadProfile();
    } catch (err) {
      setError(err.message || 'Failed to submit profile for review');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadVoice() {
    if (!voiceFile) return;
    setUploadingVoice(true);
    setError(null);
    setNotice(null);
    try {
      const res = await uploadVoiceNote(voiceFile);
      setVoiceProposal(res);
      setVoiceFile(null);
    } catch (err) {
      setError(err.message || 'Failed to process voice note');
    } finally {
      setUploadingVoice(false);
    }
  }

  async function handleConfirmVoiceProposal(confirm) {
    if (!voiceProposal) return;
    setConfirmingProposal(true);
    setError(null);
    try {
      const res = await confirmVoiceProposal(voiceProposal.proposal_id, confirm);
      if (confirm) {
        setNotice(lang === 'hi' ? '✓ ध्वनि निर्देश से नियम सफलतापूर्वक अपडेट हुए।' : '✓ Artist rules successfully updated from voice proposal.');
        await loadProfile();
      } else {
        setNotice(lang === 'hi' ? 'ध्वनि प्रस्ताव रद्द किया गया।' : 'Voice proposal discarded.');
      }
      setVoiceProposal(null);
    } catch (err) {
      setError(err.message || 'Failed to confirm proposal');
    } finally {
      setConfirmingProposal(false);
    }
  }

  if (loading) {
    return (
      <div className="folk-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Diya size={40} animated />
        <p style={{ marginTop: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
          ⌛ {lang === 'hi' ? 'प्रोफ़ाइल लोड हो रही है...' : 'Loading artist profile...'}
        </p>
      </div>
    );
  }

  // If user is not yet onboarded, show welcoming prompt
  if (!profile || !profile.is_onboarded) {
    return (
      <div className="folk-card" style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>
        <Diya size={48} animated />
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', margin: '1rem 0 0.5rem 0' }}>
          {lang === 'hi' ? 'धरोहर कलाकार मंच पर आपका स्वागत है' : 'Welcome to Dharohar Folk Artist Protocol'}
        </h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)', maxWidth: '640px', margin: '0 auto 1.75rem auto', lineHeight: 1.6 }}>
          {lang === 'hi'
            ? 'अपनी प्रामाणिक लोक कला विधा, न्यूनतम शुल्क और उपलब्धता निर्धारित करें ताकि पूरे देश के आयोजक आपकी मंडली को सीधे बुक कर सकें।'
            : 'Set your authentic folk art form, performance minimum fee guarantees, and availability calendar so organizers across India can book you securely.'}
        </p>
        <button
          type="button"
          className="folk-btn-primary"
          style={{ padding: '0.85rem 2rem', fontSize: '1.15rem' }}
          onClick={onStartWizard}
        >
          <Ghungroo size={16} /> {lang === 'hi' ? 'कलाकार प्रोफ़ाइल बनाएँ (आरंभ करें)' : 'Start Artist Onboarding Wizard'}
        </button>
      </div>
    );
  }

  const isProfileComplete = Boolean(profile.bio && profile.bio.length >= 10);
  const isRulesComplete = Boolean(profile.min_fee && profile.min_fee > 0);
  const isVideoUploaded = Boolean(profile.video_urls && profile.video_urls.length > 0);
  const isUpiComplete = Boolean(profile.has_upi || profile.upi_id);
  const vouchesCount = profile.vouches_count || 0;
  const isReadyForSubmission = isProfileComplete && isRulesComplete && isVideoUploaded && isUpiComplete;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Notice */}
      {notice && (
        <div className="login-alert-banner alert-warning" role="alert">
          <span>✓</span>
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="login-alert-banner alert-danger" role="alert">
          <span>✖ Error:</span>
          <span>{error}</span>
        </div>
      )}

      {/* Hero Profile Overview Card */}
      <div className="folk-card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Diya size={32} animated />
              <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2.1rem', margin: 0 }}>
                {profile.name}
              </h2>
            </div>
            <p style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--color-dark-maroon)', margin: '0.35rem 0' }}>
              🪕 {profile.art_form} • 📍 {profile.city}, {profile.state}
            </p>
            <p style={{ fontSize: '1rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {profile.bio || 'Heritage folk artist profile on Dharohar protocol.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="folk-btn-secondary"
              onClick={onStartWizard}
              style={{ minHeight: '44px' }}
            >
              ✏️ {lang === 'hi' ? 'प्रोफ़ाइल व नियम संपादित करें' : 'Edit Profile & Rules'}
            </button>
          </div>
        </div>

        <PaisleyBorder height={14} />

        {/* Verification Stage & Listing Status Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          {/* Listing Status */}
          <div
            style={{
              background: profile.listing_status === 'LIVE' ? '#F0FDF4' : profile.listing_status === 'PENDING_REVIEW' ? '#FEF3C7' : '#FFFDF5',
              border: `2px solid ${profile.listing_status === 'LIVE' ? 'var(--color-leaf-green)' : profile.listing_status === 'PENDING_REVIEW' ? '#F59E0B' : 'var(--color-border-dark)'}`,
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Listing Status
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--color-text-main)' }}>
              {profile.listing_status === 'LIVE' && '✓ LIVE (Ready for Bookings)'}
              {profile.listing_status === 'PENDING_REVIEW' && '⌛ PENDING OPERATOR REVIEW'}
              {profile.listing_status === 'DRAFT' && '📝 DRAFT (Incomplete)'}
              {profile.listing_status === 'SUSPENDED' && '✖ SUSPENDED'}
            </div>
            <p style={{ fontSize: '0.95rem', margin: '0.35rem 0 0 0', color: 'var(--color-text-muted)' }}>
              {profile.listing_status === 'LIVE'
                ? 'Your profile is active in search and can be booked by organizers.'
                : profile.listing_status === 'PENDING_REVIEW'
                ? 'Your audition video is currently queued for operator verification.'
                : 'Complete the checklist below and click Submit to request operator review.'}
            </p>
          </div>

          {/* Verification Stage */}
          <div
            style={{
              background: profile.verification_stage === 'TRUSTED' ? '#FEFCE8' : '#F8FAFC',
              border: `2px solid ${profile.verification_stage === 'TRUSTED' ? 'var(--color-amber-gold)' : 'var(--color-border-subtle)'}`,
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Verification Tier
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--color-text-main)' }}>
              {profile.verification_stage === 'TRUSTED' && '★ TRUSTED ARTIST (2+ Vouches & Verified)'}
              {profile.verification_stage === 'VIDEO_REVIEWED' && '✓ VIDEO REVIEWED'}
              {profile.verification_stage === 'COORDINATOR_VOUCHED' && '📜 COORDINATOR VOUCHED'}
              {profile.verification_stage === 'REGISTERED' && '⚪ REGISTERED'}
            </div>
            <p style={{ fontSize: '0.95rem', margin: '0.35rem 0 0 0', color: 'var(--color-text-muted)' }}>
              {vouchesCount >= 2
                ? '✓ 2 Independent Coordinator Vouches recorded.'
                : `${vouchesCount}/2 coordinator vouches received. ${2 - vouchesCount} more needed for Trusted tier.`}
            </p>
          </div>

          {/* Reliability & Bookings */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid var(--color-border-subtle)',
              borderRadius: '8px',
              padding: '1rem',
            }}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Reliability & Stats
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--color-leaf-green)' }}>
              🛡️ {profile.reliability_score || 100.0}% Reliability
            </div>
            <p style={{ fontSize: '0.95rem', margin: '0.35rem 0 0 0', color: 'var(--color-text-muted)' }}>
              {profile.completed_bookings_count || 0} completed bookings • ⭐ {profile.rating || 5.0}/5 rating
            </p>
          </div>
        </div>
      </div>

      {/* Verification Checklist Card: What is Still Needed */}
      <div className="folk-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--color-dark-maroon)' }}>
          {lang === 'hi' ? 'सत्यापन चेकलिस्ट (क्या शेष है)' : 'Listing & Verification Checklist (What is Still Needed)'}
        </h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', marginBottom: '1.25rem' }}>
          {lang === 'hi'
            ? 'आपकी लिस्टिंग को लाइव करने के लिए सभी चरणों का पूर्ण होना अनिवार्य है।'
            : 'All items below must be fulfilled before your profile can be reviewed and go live.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* 1. Bio & Profile */}
          <div className="verified-phone-card" style={{ background: isProfileComplete ? '#F0FDF4' : '#FFFDF5', borderColor: isProfileComplete ? 'var(--color-leaf-green)' : '#F59E0B' }}>
            <div>
              <strong>1. {t('check_profile')}</strong>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
                {isProfileComplete ? '✓ Profile details, art form, and biography completed.' : '⌛ Missing biography or profile details.'}
              </div>
            </div>
            <span style={{ fontWeight: 700, color: isProfileComplete ? 'var(--color-leaf-green)' : '#D97706' }}>
              {isProfileComplete ? '✓ Complete' : '⌛ Incomplete'}
            </span>
          </div>

          {/* 2. Rules */}
          <div className="verified-phone-card" style={{ background: isRulesComplete ? '#F0FDF4' : '#FFFDF5', borderColor: isRulesComplete ? 'var(--color-leaf-green)' : '#F59E0B' }}>
            <div>
              <strong>2. {t('check_rules')}</strong>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
                {isRulesComplete ? `✓ Minimum fee set at ₹${profile.min_fee.toLocaleString('en-IN')}, max travel ${profile.travel_range_km} km.` : '⌛ Minimum performance fee not yet set.'}
              </div>
            </div>
            <span style={{ fontWeight: 700, color: isRulesComplete ? 'var(--color-leaf-green)' : '#D97706' }}>
              {isRulesComplete ? '✓ Complete' : '⌛ Incomplete'}
            </span>
          </div>

          {/* 3. Audition Video */}
          <div className="verified-phone-card" style={{ background: isVideoUploaded ? '#F0FDF4' : '#FFFDF5', borderColor: isVideoUploaded ? 'var(--color-leaf-green)' : '#F59E0B' }}>
            <div>
              <strong>3. {t('check_video')}</strong>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
                {isVideoUploaded ? `✓ Audition video uploaded (${profile.video_urls.length} video)` : '⌛ Audition performance video (.mp4) not yet uploaded.'}
              </div>
            </div>
            <span style={{ fontWeight: 700, color: isVideoUploaded ? 'var(--color-leaf-green)' : '#D97706' }}>
              {isVideoUploaded ? '✓ Complete' : '⌛ Required'}
            </span>
          </div>

          {/* 4. UPI Details */}
          <div className="verified-phone-card" style={{ background: isUpiComplete ? '#F0FDF4' : '#FFFDF5', borderColor: isUpiComplete ? 'var(--color-leaf-green)' : '#F59E0B' }}>
            <div>
              <strong>4. {t('check_upi')}</strong>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
                {isUpiComplete ? `✓ Encrypted UPI ID active (${profile.masked_upi_id})` : '⌛ UPI payout address missing.'}
              </div>
            </div>
            <span style={{ fontWeight: 700, color: isUpiComplete ? 'var(--color-leaf-green)' : '#D97706' }}>
              {isUpiComplete ? '✓ Complete' : '⌛ Required'}
            </span>
          </div>

          {/* 5. Coordinator Vouches */}
          <div className="verified-phone-card" style={{ background: vouchesCount >= 2 ? '#F0FDF4' : '#FFFDF5', borderColor: vouchesCount >= 2 ? 'var(--color-leaf-green)' : '#F59E0B' }}>
            <div>
              <strong>5. {t('check_vouch')}</strong>
              <div style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
                {vouchesCount >= 2 ? '✓ 2 Independent Coordinator Vouches secured (Trusted Tier).' : `${vouchesCount}/2 Coordinator Vouches recorded.`}
              </div>
            </div>
            <span style={{ fontWeight: 700, color: vouchesCount >= 2 ? 'var(--color-leaf-green)' : '#D97706' }}>
              {vouchesCount >= 2 ? '✓ Trusted Tier' : `${vouchesCount}/2`}
            </span>
          </div>
        </div>

        {/* Submit for Review CTA */}
        {profile.listing_status === 'DRAFT' && (
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button
              type="button"
              className="folk-btn-primary"
              style={{ padding: '0.9rem 2.5rem', fontSize: '1.15rem' }}
              onClick={handleSubmitReview}
              disabled={submitting || !isReadyForSubmission}
            >
              <Ghungroo size={16} />{' '}
              {submitting ? '⌛ Submitting...' : isReadyForSubmission ? t('btn_submit_for_review') : 'Complete Required Steps to Submit'}
            </button>
          </div>
        )}
      </div>

      {/* Voice Note Rule Assistant Card */}
      <div className="folk-card" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--color-dark-maroon)' }}>
          🎙️ {lang === 'hi' ? 'ध्वनि निर्देश सहायक (Voice Note Rule Assistant)' : 'Voice Note Rule Assistant'}
        </h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          {lang === 'hi'
            ? 'अपनी बोली (हिंदी या राजस्थानी) में वॉइस नोट भेजकर अपने नियम और न्यूनतम शुल्क प्रस्तावित करें। AI केवल एक प्रस्ताव तैयार करेगा जिसे लागू करने के लिए आपको यहाँ बटन दबाकर पुष्टि करनी होगी।'
            : 'Speak your booking rules (e.g., minimum fee, travel distance) in Hindi or English. AI will parse a structured proposal that is NEVER applied automatically until you confirm it below.'}
        </p>

        {/* Upload Audio Form */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
          <input
            type="file"
            accept="audio/*,.mp3,.m4a,.wav,.ogg"
            onChange={(e) => setVoiceFile(e.target.files?.[0] || null)}
            style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
          />
          <button
            type="button"
            className="folk-btn-secondary"
            onClick={handleUploadVoice}
            disabled={!voiceFile || uploadingVoice}
            style={{ padding: '0.65rem 1.5rem', fontSize: '1rem' }}
          >
            {uploadingVoice ? '⌛ प्रोसेस हो रहा है...' : '🎙️ वॉइस नोट प्रोसेस करें'}
          </button>
        </div>

        {/* Pending Voice Proposal Review Box */}
        {voiceProposal && (
          <div
            style={{
              background: '#FFFDF5',
              border: '2px solid #F59E0B',
              borderRadius: '8px',
              padding: '1.25rem',
              marginTop: '1rem',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#B45309', marginBottom: '0.5rem' }}>
              ⚠️ {lang === 'hi' ? 'प्रस्तावित नियम (पुष्टि प्रतीक्षित)' : 'Proposed Rule Updates (Requires Confirmation)'}
            </div>

            <p style={{ fontStyle: 'italic', background: '#FFFFFF', padding: '0.75rem', borderRadius: '6px', border: '1px solid #FDE68A', fontSize: '1rem' }}>
              "{voiceProposal.transcript}"
            </p>

            <div style={{ margin: '1rem 0' }}>
              <strong>{lang === 'hi' ? 'पहचाने गए नियम बदलाव:' : 'Extracted Proposed Changes:'}</strong>
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                {Object.entries(voiceProposal.proposed_changes || {}).map(([k, v]) => (
                  <li key={k} style={{ fontSize: '1rem' }}>
                    <strong>{k}:</strong> {k === 'min_fee' ? `₹${(v / 100).toLocaleString('en-IN')}` : Array.isArray(v) ? v.join(', ') : v}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="folk-btn-primary"
                onClick={() => handleConfirmVoiceProposal(true)}
                disabled={confirmingProposal}
                style={{ padding: '0.65rem 1.5rem' }}
              >
                ✓ {lang === 'hi' ? 'पुष्टि करें और नियम लागू करें' : 'Confirm & Apply Rule Changes'}
              </button>
              <button
                type="button"
                className="folk-btn-secondary"
                onClick={() => handleConfirmVoiceProposal(false)}
                disabled={confirmingProposal}
                style={{ padding: '0.65rem 1.5rem' }}
              >
                ✕ {lang === 'hi' ? 'रद्द करें' : 'Discard Proposal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
