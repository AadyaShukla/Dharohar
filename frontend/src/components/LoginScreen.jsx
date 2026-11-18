import React, { useState, useEffect, useRef } from 'react';
import {
  createSession,
  registerUser,
  requestOtp,
  verifyOtp,
  getArtists,
} from '../api';
import { setSession } from '../auth';
import {
  isFirebaseConfigured,
  initRecaptchaVerifier,
  sendFirebasePhoneOtp,
} from '../firebase';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import PaisleyBorder from './folk/PaisleyBorder';
import WarliDancers from './folk/WarliDancers';

const FICTIONAL_ARTISTS_FALLBACK = [
  { id: 'dance_kalbelia_01', name: 'Surila Kabilo Troupe', art_form: 'Kalbelia Dance', phone: '9000000001' },
  { id: 'dance_ghoomar_02', name: 'Rangilo Ghoomar Mandali', art_form: 'Ghoomar Dance', phone: '9000000002' },
  { id: 'dance_bhavai_03', name: 'Matka Nritya Sangeet', art_form: 'Bhavai Folk Dance', phone: '9000000003' },
  { id: 'dance_chhau_04', name: 'Purulia Mask Dancers', art_form: 'Chhau Dance', phone: '9000000004' },
  { id: 'music_manganiyar_01', name: 'Desert Sarangi Swar', art_form: 'Manganiyar Folk Music', phone: '9000000005' },
  { id: 'music_pandavani_02', name: 'Surili Tarang Ballad', art_form: 'Manganiyar Folk Music', phone: '9000000006' },
  { id: 'music_sarangi_03', name: 'Swara Shehnai Ensemble', art_form: 'Manganiyar Folk Music', phone: '9000000007' },
  { id: 'puppet_kathputli_01', name: 'Kathputli Kaarwan', art_form: 'Kathputli Puppet Theatre', phone: '9000000008' },
  { id: 'puppet_tholu_02', name: 'Chhaya Shadow Puppets', art_form: 'Tholu Bommalata Shadow Puppetry', phone: '9000000009' },
  { id: 'craft_bluepottery_01', name: 'Neel Mritika Clay Studio', art_form: 'Blue Pottery Craft Demonstration', phone: '9000000010' },
];

const ROLES = [
  {
    id: 'ORGANIZER',
    label: 'Organizer',
    icon: '🏛️',
    defaultPhone: '9000000099',
    desc: 'Create bookings, negotiate artist terms & fund escrow',
  },
  {
    id: 'ARTIST',
    label: 'Folk Artist',
    icon: '🪕',
    defaultPhone: '9000000005',
    desc: 'Receive proposals, approve/decline & verify bank payouts',
  },
  {
    id: 'OPERATOR',
    label: 'Platform Operator',
    icon: '⚙️',
    defaultPhone: '9000000000',
    desc: 'Settle escrow payouts, resolve tickets & run demo scenarios',
  },
  {
    id: 'COORDINATOR',
    label: 'Cultural Coordinator',
    icon: '📜',
    defaultPhone: '9000000088',
    desc: 'Vouch for authenticity of folk artists & review performances',
  },
];

const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'en', label: 'English' },
  { code: 'raj', label: 'राजस्थानी (Rajasthani)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
];

function formatAuthError(err) {
  if (!err) return null;
  const msg = err.message || String(err);
  const code = err.code || '';

  if (
    code === 'auth/invalid-verification-code' ||
    msg.includes('invalid-verification-code') ||
    msg.includes('Invalid OTP')
  ) {
    return '✖ Error: Invalid verification code. Please check the code and try again.';
  }
  if (
    code === 'auth/code-expired' ||
    msg.includes('code-expired') ||
    msg.includes('OTP has expired')
  ) {
    return '✖ Error: Verification code has expired. Please request a new OTP.';
  }
  if (
    code === 'auth/too-many-requests' ||
    msg.includes('too-many-requests') ||
    msg.includes('Rate limit exceeded') ||
    msg.includes('Maximum verification attempts exceeded') ||
    err.status === 429
  ) {
    return '⚠ Warning: Too many attempts. You have been temporarily rate-limited for security. Please wait a moment before trying again.';
  }
  if (code === 'auth/captcha-check-failed' || msg.includes('reCAPTCHA')) {
    return '✖ Error: reCAPTCHA verification failed or cancelled. Please try sending OTP again.';
  }
  if (code === 'auth/invalid-phone-number' || msg.includes('invalid-phone-number')) {
    return '✖ Error: Please enter a valid 10-digit mobile number or standard phone format.';
  }
  if (
    code === 'auth/network-request-failed' ||
    msg.includes('network-request-failed') ||
    msg.includes('Cannot connect to backend') ||
    msg.includes('Failed to fetch')
  ) {
    return '✖ Error: Network connection failed. Please ensure your internet is active and the backend server is running.';
  }
  if (msg.includes('OPERATOR accounts can never self-register')) {
    return '⚠ Warning: Operator accounts are platform-managed and cannot be self-registered.';
  }
  return `✖ Error: ${msg}`;
}

export default function LoginScreen({ onLoginSuccess, initialMessage }) {
  // Navigation & Step State: 'phone' | 'otp' | 'register'
  const [step, setStep] = useState('phone');

  // Phone Step State
  const [selectedRole, setSelectedRole] = useState('ORGANIZER');
  const [phone, setPhone] = useState('9000000099');
  const [selectedArtistId, setSelectedArtistId] = useState('music_manganiyar_01');
  const [artistsList, setArtistsList] = useState(FICTIONAL_ARTISTS_FALLBACK);

  // OTP Verification State
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [demoOtp, setDemoOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isSimulatedAuth, setIsSimulatedAuth] = useState(false);

  // Registration State (for un-registered users from Firebase)
  const [pendingIdToken, setPendingIdToken] = useState('');
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('ORGANIZER');
  const [regLanguage, setRegLanguage] = useState('hi');
  const [regOrgName, setRegOrgName] = useState('');
  const [regOrgType, setRegOrgType] = useState('hotel');
  const [regGstNumber, setRegGstNumber] = useState('');
  const [regWorkEmail, setRegWorkEmail] = useState('');
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // General Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionNotice, setSessionNotice] = useState(initialMessage || null);

  const recaptchaContainerRef = useRef(null);
  const isDemoEnv = import.meta.env.VITE_DEMO_MODE === 'true';

  useEffect(() => {
    // Attempt to load live artist profiles from backend for demo convenience
    getArtists()
      .then((data) => {
        if (data && data.length > 0) {
          const mapped = data.map((a, idx) => ({
            id: a.id,
            name: a.name.replace(' (Simulated)', ''),
            art_form: a.art_form,
            phone:
              FICTIONAL_ARTISTS_FALLBACK[idx]?.phone ||
              `90000000${String(idx + 1).padStart(2, '0')}`,
          }));
          setArtistsList(mapped);
        }
      })
      .catch(() => {});
  }, []);

  function handleRoleChange(roleId) {
    setSelectedRole(roleId);
    setError(null);
    setDemoOtp('');
    setOtpInput('');

    if (roleId === 'ORGANIZER') {
      setPhone('9000000099');
    } else if (roleId === 'OPERATOR') {
      setPhone('9000000000');
    } else if (roleId === 'COORDINATOR') {
      setPhone('9000000088');
    } else if (roleId === 'ARTIST') {
      const art =
        artistsList.find((a) => a.id === selectedArtistId) || artistsList[4];
      setPhone(art.phone);
    }
  }

  function handleArtistSelect(artId) {
    setSelectedArtistId(artId);
    const art = artistsList.find((a) => a.id === artId);
    if (art) {
      setPhone(art.phone);
    }
    setDemoOtp('');
    setOtpInput('');
  }

  // Format phone to E.164 standard for Firebase
  function formatPhoneE164(raw) {
    const clean = raw.trim();
    if (clean.startsWith('+')) {
      return clean.replace(/\s+/g, '');
    }
    const digits = clean.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    return `+${digits}`;
  }

  // Step 1: Send OTP via Firebase Phone Auth (or simulated fallback)
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    if (!phone || phone.trim().length < 6) {
      setError('✖ Error: Please provide a valid mobile phone number.');
      return;
    }

    setLoading(true);
    setError(null);
    setSessionNotice(null);

    const formatted = formatPhoneE164(phone);

    // Try Firebase Phone Auth if configured
    if (isFirebaseConfigured()) {
      try {
        const verifier = initRecaptchaVerifier('recaptcha-container');
        const confirmation = await sendFirebasePhoneOtp(formatted, verifier);
        setConfirmationResult(confirmation);
        setIsSimulatedAuth(false);
        setStep('otp');
      } catch (err) {
        console.error('Firebase Phone Auth send error:', err);
        // If Firebase fails or quota reached and demo mode is active, allow simulated fallback
        if (isDemoEnv) {
          try {
            const res = await requestOtp(phone);
            setIsSimulatedAuth(true);
            setConfirmationResult(null);
            setStep('otp');
            if (res.demo_otp) {
              setDemoOtp(res.demo_otp);
              setOtpInput(res.demo_otp);
            }
          } catch (backendErr) {
            setError(formatAuthError(backendErr));
          }
        } else {
          setError(formatAuthError(err));
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Offline / Demo simulated OTP mode
      try {
        const res = await requestOtp(phone);
        setIsSimulatedAuth(true);
        setConfirmationResult(null);
        setStep('otp');
        if (res.demo_otp) {
          setDemoOtp(res.demo_otp);
          setOtpInput(res.demo_otp);
        }
      } catch (err) {
        setError(formatAuthError(err));
      } finally {
        setLoading(false);
      }
    }
  }

  // Step 2: Verify OTP -> POST /auth/session. If 404 "Not registered", transition to registration
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    if (!otpInput || otpInput.trim().length < 4) {
      setError('✖ Error: Please enter the verification OTP.');
      return;
    }

    setLoading(true);
    setError(null);

    // Flow A: Firebase Phone Auth
    if (confirmationResult && !isSimulatedAuth) {
      try {
        const userCredential = await confirmationResult.confirm(otpInput.trim());
        const idToken = await userCredential.user.getIdToken();
        const verifiedNumber =
          userCredential.user.phoneNumber || formatPhoneE164(phone);

        // Call backend /auth/session
        try {
          const sessionRes = await createSession(idToken);
          setSession(sessionRes.access_token, sessionRes.user);
          if (onLoginSuccess) {
            onLoginSuccess(sessionRes.user);
          }
        } catch (sessionErr) {
          // If 404 "Not registered", launch registration sign-up
          if (
            sessionErr.status === 404 ||
            (sessionErr.message && sessionErr.message.includes('Not registered'))
          ) {
            setPendingIdToken(idToken);
            setVerifiedPhone(verifiedNumber);
            setRegRole(selectedRole === 'OPERATOR' ? 'ORGANIZER' : selectedRole);
            setStep('register');
          } else {
            setError(formatAuthError(sessionErr));
          }
        }
      } catch (fbErr) {
        setError(formatAuthError(fbErr));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Flow B: Simulated OTP Verification
    try {
      const res = await verifyOtp(phone, otpInput.trim());
      setSession(res.access_token, res.user);
      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Complete Registration for new verified users -> POST /auth/register
  async function handleCompleteRegistration(e) {
    if (e) e.preventDefault();

    if (!regName || regName.trim().length < 2) {
      setError('✖ Error: Please provide your full name or troupe name (at least 2 characters).');
      return;
    }
    if (!consentTerms || !consentPrivacy) {
      setError('⚠ Warning: You must review and agree to both the Terms of Service and Privacy Policy.');
      return;
    }
    if (regRole === 'OPERATOR') {
      setError('⚠ Warning: Platform Operator accounts cannot be self-registered.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await registerUser({
        idToken: pendingIdToken,
        name: regName.trim(),
        role: regRole,
        language: regLanguage,
        termsVersion: '1.0',
        privacyVersion: '1.0',
        organization_name: regRole === 'ORGANIZER' ? (regOrgName || regName).trim() : undefined,
        org_type: regRole === 'ORGANIZER' ? regOrgType : undefined,
        gst_number: regRole === 'ORGANIZER' && regGstNumber ? regGstNumber.trim() : undefined,
        work_email: regRole === 'ORGANIZER' && regWorkEmail ? regWorkEmail.trim() : undefined,
      });

      setSession(res.access_token, res.user);
      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  // One-click demo login shortcut for development & judging demo
  async function handleQuickLogin(targetPhone) {
    setLoading(true);
    setError(null);
    setSessionNotice(null);

    try {
      const resOtp = await requestOtp(targetPhone);
      const code = resOtp.demo_otp || '123456';
      const verifyRes = await verifyOtp(targetPhone, code);
      setSession(verifyRes.access_token, verifyRes.user);
      if (onLoginSuccess) {
        onLoginSuccess(verifyRes.user);
      }
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen-wrapper">
      {/* Decorative folk background elements behind content (pointer-events: none) */}
      <div className="login-warli-bg" aria-hidden="true">
        <WarliDancers size={540} opacity={0.06} />
      </div>

      <div className="login-card-container">
        {/* Invisible container for Firebase reCAPTCHA */}
        <div id="recaptcha-container" ref={recaptchaContainerRef} />

        {/* Brand Header Lockup */}
        <div className="login-header-lockup">
          <Diya size={48} animated />
          <div>
            <h1 className="login-brand-title">Dharohar</h1>
            <p className="login-brand-tagline">
              India's Traditional Folk Arts Escrow & Booking Protocol
            </p>
          </div>
        </div>

        <PaisleyBorder height={16} />

        {/* High-Readability Status / Session Notices */}
        {sessionNotice && (
          <div className="login-alert-banner alert-warning" role="alert">
            <span>ℹ Info:</span>
            <span>{sessionNotice}</span>
          </div>
        )}

        {/* High-Readability Error Banner */}
        {error && (
          <div className="login-alert-banner alert-danger" role="alert">
            <span>{error}</span>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STEP 1: Phone Entry & Role Selection                              */}
        {/* ----------------------------------------------------------------- */}
        {step === 'phone' && (
          <div className="login-step-section">
            <label className="login-step-label">
              Step 1: Choose Your Community Role
            </label>
            <div className="role-signboards-grid" role="radiogroup">
              {ROLES.map((r) => {
                const isSelected = selectedRole === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`wooden-signboard-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleRoleChange(r.id)}
                  >
                    <span className="signboard-icon">{r.icon}</span>
                    <span className="signboard-title">{r.label}</span>
                    <span className="signboard-desc">{r.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Fictional Artist Selector (Demo Mode Convenience) */}
            {selectedRole === 'ARTIST' && (
              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label htmlFor="artist-select">
                  Select Seeded Fictional Folk Artist
                </label>
                <select
                  id="artist-select"
                  className="folk-select"
                  value={selectedArtistId}
                  onChange={(e) => handleArtistSelect(e.target.value)}
                >
                  {artistsList.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.name} — {art.art_form} (Ph: {art.phone})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Step 2: Phone Input */}
            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label htmlFor="login-phone">
                Step 2: Enter Mobile Phone Number (OTP via SMS)
              </label>
              <div className="phone-input-row">
                <span className="phone-prefix">+91</span>
                <input
                  id="login-phone"
                  type="tel"
                  className="folk-input"
                  placeholder="e.g. 9876543210 or 9000000099"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={15}
                  required
                />
                <button
                  type="button"
                  className="folk-btn-primary btn-send-otp"
                  onClick={handleSendOtp}
                  disabled={loading || !phone}
                >
                  <Ghungroo size={14} />{' '}
                  {loading ? '⌛ Sending...' : 'Send OTP'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STEP 2: OTP Verification                                          */}
        {/* ----------------------------------------------------------------- */}
        {step === 'otp' && (
          <div className="login-step-section otp-verification-step">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <label className="login-step-label" style={{ marginBottom: 0 }}>
                Step 2: Enter 6-Digit Verification Code
              </label>
              <button
                type="button"
                className="auth-nav-link"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
              >
                ← Change Number
              </button>
            </div>

            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Verification code requested for <strong>{formatPhoneE164(phone)}</strong>.
              {isFirebaseConfigured() && !isSimulatedAuth && (
                <span> (SMS sent via Firebase Authentication)</span>
              )}
            </p>

            {/* Simulated OTP Display Card (when simulated/demo OTP active) */}
            {demoOtp && isSimulatedAuth && (
              <div
                className="simulated-otp-card"
                role="region"
                aria-label="Demo OTP code"
              >
                <span className="otp-card-seal">★</span>
                <div>
                  <strong>
                    SIMULATED OTP (no SMS is sent in offline prototype):
                  </strong>
                  <div className="otp-code-highlight">{demoOtp}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="otp-form">
              <div className="form-group">
                <label htmlFor="otp-input">Enter 6-Digit OTP</label>
                <input
                  id="otp-input"
                  type="text"
                  className="folk-input otp-input-field"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="123456"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="folk-btn-primary btn-verify-login"
                disabled={loading || !otpInput}
              >
                <Ghungroo size={16} />{' '}
                {loading ? '⌛ Verifying...' : 'Verify & Enter Dharohar'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="auth-nav-link"
                  onClick={handleSendOtp}
                  disabled={loading}
                >
                  ↻ Resend OTP
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STEP 3: New User Registration & Legal Consent                     */}
        {/* ----------------------------------------------------------------- */}
        {step === 'register' && (
          <div className="register-step-section">
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.75rem',
                  color: 'var(--color-dark-maroon)',
                  margin: '0 0 0.35rem 0',
                }}
              >
                Create Your Account
              </h2>
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '1rem',
                  margin: 0,
                }}
              >
                Welcome to Dharohar! Your phone number is verified. Complete your
                details below to set up your profile.
              </p>
            </div>

            {/* Verified Phone Badge Card */}
            <div className="verified-phone-card">
              <div className="verified-phone-info">
                <span className="verified-phone-badge">
                  ✓ Phone Verified via OTP
                </span>
                <span className="verified-phone-number">{verifiedPhone}</span>
              </div>
              <button
                type="button"
                className="auth-nav-link"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
              >
                ← Different Phone
              </button>
            </div>

            <form onSubmit={handleCompleteRegistration}>
              {/* Full Name */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="reg-name">
                  Full Name or Troupe Name / नाम *
                </label>
                <input
                  id="reg-name"
                  type="text"
                  className="folk-input"
                  placeholder="e.g. Rameshwar Folk Ensemble or Vikram Rathore"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </div>

              {/* Role Selection */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="login-step-label">
                  Select Your Account Role *
                </label>
                <div
                  className="role-signboards-grid"
                  style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
                >
                  <button
                    type="button"
                    className={`wooden-signboard-card ${
                      regRole === 'ORGANIZER' ? 'selected' : ''
                    }`}
                    onClick={() => setRegRole('ORGANIZER')}
                  >
                    <span className="signboard-icon">🏛️</span>
                    <span className="signboard-title">Event Organizer</span>
                    <span className="signboard-desc">
                      Book folk artists, negotiate terms & fund escrow
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`wooden-signboard-card ${
                      regRole === 'ARTIST' ? 'selected' : ''
                    }`}
                    onClick={() => setRegRole('ARTIST')}
                  >
                    <span className="signboard-icon">🪕</span>
                    <span className="signboard-title">Folk Artist</span>
                    <span className="signboard-desc">
                      Receive performance proposals & receive protected payouts
                    </span>
                  </button>
                </div>

                <div
                  className="register-operator-notice"
                  style={{ marginTop: '0.75rem' }}
                >
                  <span>ℹ Info:</span>
                  <span>
                    Operator accounts are platform-managed and cannot be
                    self-registered.
                  </span>
                </div>
              </div>

              {/* Language Selection */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="reg-lang">
                  Preferred Communication Language / भाषा
                </label>
                <select
                  id="reg-lang"
                  className="folk-select"
                  value={regLanguage}
                  onChange={(e) => setRegLanguage(e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Organizer-Specific Profile Fields */}
              {regRole === 'ORGANIZER' && (
                <div
                  className="organizer-registration-fields"
                  style={{
                    backgroundColor: 'var(--color-bg-alt, #F9F5EB)',
                    border: '1px solid var(--color-border, #E4D9C8)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: '1.15rem',
                      color: 'var(--color-dark-maroon, #4A1525)',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>🏛️ Organization Details</span>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: '#FFF3CD',
                        color: '#856404',
                        fontFamily: 'var(--font-body)',
                        fontWeight: 600,
                      }}
                    >
                      Default: UNVERIFIED
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label htmlFor="reg-org-name">
                      Organization / Entity Name *
                    </label>
                    <input
                      id="reg-org-name"
                      type="text"
                      className="folk-input"
                      placeholder="e.g. Heritage Grand Palace or DPS Cultural Wing"
                      value={regOrgName}
                      onChange={(e) => setRegOrgName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label htmlFor="reg-org-type">Organization Type *</label>
                    <select
                      id="reg-org-type"
                      className="folk-select"
                      value={regOrgType}
                      onChange={(e) => setRegOrgType(e.target.value)}
                    >
                      <option value="hotel">Hotel / Heritage Resort</option>
                      <option value="school">School / University</option>
                      <option value="corporate">Corporate / Event Agency</option>
                      <option value="tour operator">Tour Operator</option>
                      <option value="individual">Individual Private Host</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label htmlFor="reg-work-email">Work Email Address</label>
                    <input
                      id="reg-work-email"
                      type="email"
                      className="folk-input"
                      placeholder="e.g. events@heritagepalace.in"
                      value={regWorkEmail}
                      onChange={(e) => setRegWorkEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label htmlFor="reg-gst">GST Number (Optional)</label>
                    <input
                      id="reg-gst"
                      type="text"
                      className="folk-input"
                      placeholder="e.g. 08AAAAA0000A1Z5"
                      value={regGstNumber}
                      onChange={(e) => setRegGstNumber(e.target.value.toUpperCase())}
                      maxLength={15}
                    />
                  </div>

                  <p
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--color-text-muted, #6C5B4C)',
                      margin: '0.5rem 0 0 0',
                    }}
                  >
                    Note: Unverified organizers can browse and book up to ₹20,000. Verification by platform operators unlocks higher limits.
                  </p>
                </div>
              )}

              {/* Legal Consent Section */}
              <div className="consent-section">
                <div className="consent-title">
                  Mandatory Legal Consent & Agreements
                </div>

                <label className="consent-checkbox-label">
                  <input
                    type="checkbox"
                    className="consent-checkbox-input"
                    checked={consentTerms}
                    onChange={(e) => setConsentTerms(e.target.checked)}
                    required
                  />
                  <span>
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      className="consent-link-btn"
                      onClick={() => setShowTermsModal((prev) => !prev)}
                    >
                      Dharohar Terms of Service (v1.0)
                    </button>
                    , including artist protection escrow guidelines.
                  </span>
                </label>

                {showTermsModal && (
                  <div className="legal-preview-modal" role="region" aria-label="Terms summary">
                    <strong>Dharohar Terms of Service v1.0 Summary:</strong>
                    <p style={{ margin: '0.4rem 0' }}>
                      1. <strong>TrustPay Escrow:</strong> Organizer funds are securely held in
                      escrow until the performance completion condition is verified.
                    </p>
                    <p style={{ margin: '0.4rem 0' }}>
                      2. <strong>Artist Rights:</strong> Folk artists retain full autonomy to
                      accept or decline bookings. Minimum wage guarantees and fair compensation
                      floors are strictly enforced.
                    </p>
                    <p style={{ margin: '0.4rem 0' }}>
                      3. <strong>Anti-Exploitation:</strong> Unilateral contract alterations or
                      delayed payouts trigger automated mediation protocols.
                    </p>
                  </div>
                )}

                <label className="consent-checkbox-label">
                  <input
                    type="checkbox"
                    className="consent-checkbox-input"
                    checked={consentPrivacy}
                    onChange={(e) => setConsentPrivacy(e.target.checked)}
                    required
                  />
                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                      className="consent-link-btn"
                      onClick={() => setShowPrivacyModal((prev) => !prev)}
                    >
                      Dharohar Privacy Policy (v1.0)
                    </button>{' '}
                    and consent to necessary phone verification processing.
                  </span>
                </label>

                {showPrivacyModal && (
                  <div className="legal-preview-modal" role="region" aria-label="Privacy summary">
                    <strong>Dharohar Privacy Policy v1.0 Summary:</strong>
                    <p style={{ margin: '0.4rem 0' }}>
                      1. <strong>Data Collection:</strong> We collect only necessary phone
                      verification data and booking records required for transaction settlement.
                    </p>
                    <p style={{ margin: '0.4rem 0' }}>
                      2. <strong>No Third-Party Reselling:</strong> Personal identifiable data is
                      never sold, monetized, or shared with marketing third parties.
                    </p>
                    <p style={{ margin: '0.4rem 0' }}>
                      3. <strong>Audit Logs:</strong> Financial transactions are immutably logged for
                      dispute resolution transparency.
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="folk-btn-primary btn-verify-login"
                style={{ marginTop: '1.25rem' }}
                disabled={loading || !regName || !consentTerms || !consentPrivacy}
              >
                <Ghungroo size={16} />{' '}
                {loading ? '⌛ Registering...' : 'Complete Registration & Enter'}
              </button>
            </form>
          </div>
        )}

        <PaisleyBorder height={16} />

        {/* Footnote Notice */}
        <p className="login-disclaimer-note">
          Production authentication secured by Firebase Phone OTP and TrustPay. All seeded demo
          accounts are fictional.
        </p>

        {/* Demo Shortcuts: One-click instant bypass in demo mode */}
        {isDemoEnv && (
          <div className="demo-shortcuts-panel">
            <div className="demo-shortcuts-title">
              ⚡ Demo Shortcuts (One-Click Instant Testing)
            </div>
            <div className="demo-shortcuts-buttons">
              <button
                type="button"
                className="btn-shortcut"
                onClick={() => handleQuickLogin('9000000099')}
                disabled={loading}
                title="Hotel Rajmahal Heritage (fictional) - Organizer"
              >
                👑 Login as Organizer
              </button>
              <button
                type="button"
                className="btn-shortcut"
                onClick={() => handleQuickLogin('9000000005')}
                disabled={loading}
                title="Desert Sarangi Swar - Manganiyar Folk Musician"
              >
                🪕 Login as Artist
              </button>
              <button
                type="button"
                className="btn-shortcut"
                onClick={() => handleQuickLogin('9000000000')}
                disabled={loading}
                title="Dharohar Operator (demo) - Platform Operator"
              >
                ⚙️ Login as Operator
              </button>
              <button
                type="button"
                className="btn-shortcut"
                onClick={() => handleQuickLogin('9000000088')}
                disabled={loading}
                title="Smt. Sharda Devi (Cultural Coordinator)"
              >
                📜 Login as Coordinator
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
