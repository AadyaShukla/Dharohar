import React, { useState, useEffect, useRef } from 'react';
import {
  createSession,
  registerUser,
  requestOtp,
  verifyOtp,
  getArtists,
  seed,
} from '../api';
import { setSession } from '../auth';
import {
  isFirebaseConfigured,
  initRecaptchaVerifier,
  sendFirebasePhoneOtp,
} from '../firebase';
import Diya from './folk/Diya';
import FolkMandalaMotif from './shared/FolkMandalaMotif';
import LightSaffronDivider from './shared/LightSaffronDivider';
import './LoginScreen.css';

const ROLES = [
  {
    id: 'ORGANIZER',
    labelEn: 'Organizer',
    labelHi: 'आयोजक',
    icon: '🏛️',
    defaultPhone: '9000000099',
    descEn: 'Find artists and book events with protected payment',
    descHi: 'कलाकारों को खोजें और सुरक्षित भुगतान से कार्यक्रम बुक करें',
  },
  {
    id: 'ARTIST',
    labelEn: 'Folk Artist',
    labelHi: 'लोक कलाकार',
    icon: '🪕',
    defaultPhone: '9000000001',
    descEn: 'Receive offers, approve bookings and track payouts',
    descHi: 'प्रस्ताव प्राप्त करें, बुकिंग स्वीकार करें और भुगतान ट्रैक करें',
  },
  {
    id: 'OPERATOR',
    labelEn: 'Platform Operator',
    labelHi: 'प्लेटफॉर्म ऑपरेटर',
    icon: '⚙️',
    defaultPhone: '9000000000',
    descEn: 'Review artists, resolve disputes and monitor payments',
    descHi: 'कलाकारों की समीक्षा करें, विवाद सुलझाएं और भुगतान ट्रैक करें',
  },
  {
    id: 'COORDINATOR',
    labelEn: 'Cultural Coordinator',
    labelHi: 'सांस्कृतिक समन्वयक',
    icon: '📜',
    defaultPhone: '9000000088',
    descEn: 'Vouch for artists you know and support onboarding',
    descHi: 'परिचित कलाकारों का सत्यापन करें और मंच पर लाएं',
  },
];

const FICTIONAL_ARTISTS_FALLBACK = [
  { id: 'dance_kalbelia_01', name: 'Surila Kabilo Troupe', art_form: 'Kalbelia Dance', phone: '9000000001' },
  { id: 'dance_ghoomar_02', name: 'Rangilo Ghoomar Mandali', art_form: 'Ghoomar Dance', phone: '9000000002' },
  { id: 'dance_bhavai_03', name: 'Matka Nritya Sangeet', art_form: 'Bhavai Folk Dance', phone: '9000000003' },
  { id: 'dance_chhau_04', name: 'Purulia Mask Dancers', art_form: 'Chhau Dance', phone: '9000000004' },
  { id: 'music_manganiyar_01', name: 'Desert Sarangi Swar', art_form: 'Manganiyar Folk Music', phone: '9000000005' },
  { id: 'music_sarangi_03', name: 'Swara Shehnai Ensemble', art_form: 'Manganiyar Folk Music', phone: '9000000007' },
  { id: 'puppet_kathputli_01', name: 'Kathputli Kaarwan', art_form: 'Kathputli Puppet Theatre', phone: '9000000008' },
  { id: 'craft_bluepottery_01', name: 'Neel Mritika Clay Studio', art_form: 'Blue Pottery Craft Demonstration', phone: '9000000010' },
];

const LANGUAGES = [
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'en', label: 'English' },
  { code: 'raj', label: 'राजस्थानी (Rajasthani)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
];

function formatAuthError(err, lang = 'en') {
  if (!err) return null;
  const msg = err.message || String(err);
  const code = err.code || '';

  if (
    code === 'auth/invalid-verification-code' ||
    msg.includes('invalid-verification-code') ||
    msg.includes('Invalid OTP')
  ) {
    return lang === 'hi'
      ? '✖ गलत कोड: कृपया 6 अंकों का कोड जाँचें और पुनः प्रयास करें।'
      : '✖ Error: Invalid verification code. Please check the code and try again.';
  }
  if (
    code === 'auth/code-expired' ||
    msg.includes('code-expired') ||
    msg.includes('OTP has expired')
  ) {
    return lang === 'hi'
      ? '✖ कोड समाप्त हो गया है: कृपया नया ओटीपी माँगें।'
      : '✖ Error: Verification code has expired. Please request a new OTP.';
  }
  if (
    code === 'auth/too-many-requests' ||
    msg.includes('too-many-requests') ||
    msg.includes('Rate limit exceeded') ||
    err.status === 429
  ) {
    return lang === 'hi'
      ? '⚠ चेतावनी: बहुत अधिक प्रयास किए गए। कृपया कुछ क्षण प्रतीक्षा करें।'
      : '⚠ Warning: Too many attempts. Please wait a moment before trying again.';
  }
  if (code === 'auth/invalid-phone-number' || msg.includes('invalid-phone-number')) {
    return lang === 'hi'
      ? '✖ कृपया एक मान्य 10 अंकों का मोबाइल नंबर दर्ज करें।'
      : '✖ Error: Please enter a valid 10-digit mobile phone number.';
  }
  if (msg.includes('Cannot connect to backend') || msg.includes('Failed to fetch')) {
    return lang === 'hi'
      ? '✖ सर्वर से संपर्क नहीं हो सका। सुनिश्चित करें कि बैकएंड चालू है।'
      : '✖ Error: Cannot connect to backend server. Ensure server is running on port 8000.';
  }
  if (msg.includes('OPERATOR accounts can never self-register')) {
    return lang === 'hi'
      ? '⚠ ऑपरेटर खाते केवल व्यवस्थापक द्वारा प्रबंधित होते हैं।'
      : '⚠ Warning: Platform Operator accounts cannot be self-registered.';
  }
  return `✖ ${msg}`;
}

export default function LoginScreen({
  onLoginSuccess,
  initialMessage,
  onBack,
  initialMode = 'login',
}) {
  // Language State: 'en' | 'hi'
  const [lang, setLang] = useState(() => localStorage.getItem('dharohar_login_lang') || 'en');

  // Navigation / Wizard Step: 'role' | 'phone' | 'otp' | 'register'
  const [step, setStep] = useState(initialMode === 'register' ? 'register' : 'phone');

  // Role & Phone States
  const [selectedRole, setSelectedRole] = useState('ORGANIZER');
  const [phone, setPhone] = useState('9000000099');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [artistsList, setArtistsList] = useState(FICTIONAL_ARTISTS_FALLBACK);
  const [selectedArtistId, setSelectedArtistId] = useState('dance_kalbelia_01');

  // OTP State (6 Digits)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInput = otpDigits.join('');
  const digitRefs = useRef([]);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [demoOtp, setDemoOtp] = useState('');
  const [isSimulatedAuth, setIsSimulatedAuth] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(30);

  // Registration State
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

  // Status & Environment States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionNotice, setSessionNotice] = useState(initialMessage || null);
  const recaptchaContainerRef = useRef(null);

  const isDemoEnv = import.meta.env.VITE_DEMO_MODE === 'true';

  useEffect(() => {
    localStorage.setItem('dharohar_login_lang', lang);
  }, [lang]);

  // Load live artists list for demo dropdown
  useEffect(() => {
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

  // Resend OTP countdown timer
  useEffect(() => {
    let interval = null;
    if (step === 'otp' && resendSeconds > 0) {
      interval = setInterval(() => {
        setResendSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, resendSeconds]);

  // Clean phone number helper
  const cleanPhoneDigits = phone.replace(/\D/g, '');
  const isPhoneValid = cleanPhoneDigits.length === 10;
  const showPhoneError = phoneTouched && cleanPhoneDigits.length > 0 && !isPhoneValid;

  function handleRoleSelect(roleId) {
    setSelectedRole(roleId);
    setError(null);
    setDemoOtp('');
    setOtpDigits(['', '', '', '', '', '']);

    const roleObj = ROLES.find((r) => r.id === roleId);
    if (roleObj) {
      if (roleId === 'ARTIST') {
        const art = artistsList.find((a) => a.id === selectedArtistId) || artistsList[0];
        setPhone(art?.phone || '9000000001');
      } else {
        setPhone(roleObj.defaultPhone);
      }
    }
  }

  function handleArtistSelect(artId) {
    setSelectedArtistId(artId);
    const art = artistsList.find((a) => a.id === artId);
    if (art) {
      setPhone(art.phone);
    }
    setDemoOtp('');
    setOtpDigits(['', '', '', '', '', '']);
  }

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

  // -------------------------------------------------------------------------
  // Send OTP (Firebase Phone Auth or Simulated Fallback)
  // -------------------------------------------------------------------------
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    setPhoneTouched(true);

    if (!isPhoneValid) {
      setError(
        lang === 'hi'
          ? '✖ कृपया एक मान्य 10 अंकों का मोबाइल नंबर दर्ज करें।'
          : '✖ Please enter a valid 10-digit mobile number.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSessionNotice(null);
    setResendSeconds(30);

    const formatted = formatPhoneE164(phone);

    if (isFirebaseConfigured()) {
      try {
        const verifier = initRecaptchaVerifier('recaptcha-container');
        const confirmation = await sendFirebasePhoneOtp(formatted, verifier);
        setConfirmationResult(confirmation);
        setIsSimulatedAuth(false);
        setStep('otp');
        setTimeout(() => digitRefs.current[0]?.focus(), 100);
      } catch (err) {
        console.error('Firebase Auth error:', err);
        if (isDemoEnv) {
          try {
            const res = await requestOtp(phone);
            setIsSimulatedAuth(true);
            setConfirmationResult(null);
            setStep('otp');
            if (res.demo_otp) {
              setDemoOtp(res.demo_otp);
              fillOtpDigits(res.demo_otp);
            }
          } catch (backendErr) {
            setError(formatAuthError(backendErr, lang));
          }
        } else {
          setError(formatAuthError(err, lang));
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
          fillOtpDigits(res.demo_otp);
        } else {
          setTimeout(() => digitRefs.current[0]?.focus(), 100);
        }
      } catch (err) {
        setError(formatAuthError(err, lang));
      } finally {
        setLoading(false);
      }
    }
  }

  function fillOtpDigits(code) {
    const chars = String(code).split('').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    chars.forEach((c, i) => {
      next[i] = c;
    });
    setOtpDigits(next);
  }

  // -------------------------------------------------------------------------
  // Verify OTP
  // -------------------------------------------------------------------------
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    if (!otpInput || otpInput.trim().length < 4) {
      setError(
        lang === 'hi'
          ? '✖ कृपया 6 अंकों का ओटीपी दर्ज करें।'
          : '✖ Please enter the 6-digit OTP verification code.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    // Firebase flow
    if (confirmationResult && !isSimulatedAuth) {
      try {
        const userCredential = await confirmationResult.confirm(otpInput.trim());
        const idToken = await userCredential.user.getIdToken();
        const verifiedNumber = userCredential.user.phoneNumber || formatPhoneE164(phone);

        try {
          const sessionRes = await createSession(idToken);
          setSession(sessionRes.access_token, sessionRes.user);
          if (onLoginSuccess) {
            onLoginSuccess(sessionRes.user);
          }
        } catch (sessionErr) {
          if (
            sessionErr.status === 404 ||
            (sessionErr.message && sessionErr.message.includes('Not registered'))
          ) {
            setPendingIdToken(idToken);
            setVerifiedPhone(verifiedNumber);
            setRegRole(selectedRole === 'OPERATOR' ? 'ORGANIZER' : selectedRole);
            setStep('register');
          } else {
            setError(formatAuthError(sessionErr, lang));
          }
        }
      } catch (fbErr) {
        setError(formatAuthError(fbErr, lang));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Simulated flow
    try {
      const res = await verifyOtp(phone, otpInput.trim());
      setSession(res.access_token, res.user);
      if (onLoginSuccess) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError(formatAuthError(err, lang));
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Registration Completion
  // -------------------------------------------------------------------------
  async function handleCompleteRegistration(e) {
    if (e) e.preventDefault();

    if (!regName || regName.trim().length < 2) {
      setError(
        lang === 'hi'
          ? '✖ कृपया अपना पूरा नाम या दल का नाम दर्ज करें।'
          : '✖ Please provide your full name or troupe name.'
      );
      return;
    }
    if (!consentTerms || !consentPrivacy) {
      setError(
        lang === 'hi'
          ? '⚠ आपको सेवा की शर्तों और गोपनीयता नीति दोनों से सहमत होना आवश्यक है।'
          : '⚠ You must review and agree to both the Terms of Service and Privacy Policy.'
      );
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
      setError(formatAuthError(err, lang));
    } finally {
      setLoading(false);
    }
  }

  // Quick Demo Login Shortcut
  async function handleQuickLogin(targetPhone) {
    setLoading(true);
    setError(null);
    setSessionNotice(null);

    try {
      let resOtp;
      try {
        resOtp = await requestOtp(targetPhone);
      } catch (reqErr) {
        if (reqErr.status === 404 || String(reqErr.message).includes('404')) {
          await seed();
          resOtp = await requestOtp(targetPhone);
        } else {
          throw reqErr;
        }
      }
      const code = resOtp.demo_otp || '123456';
      const verifyRes = await verifyOtp(targetPhone, code);
      setSession(verifyRes.access_token, verifyRes.user);
      if (onLoginSuccess) {
        onLoginSuccess(verifyRes.user);
      }
    } catch (err) {
      setError(formatAuthError(err, lang));
    } finally {
      setLoading(false);
    }
  }

  // 6-Digit OTP Box Handlers
  function handleDigitChange(idx, val) {
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...otpDigits];
      next[idx] = '';
      setOtpDigits(next);
      return;
    }
    const digit = cleaned.slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);

    if (idx < 5) {
      digitRefs.current[idx + 1]?.focus();
    }
  }

  function handleDigitKeyDown(idx, e) {
    if (e.key === 'Backspace') {
      if (otpDigits[idx] === '' && idx > 0) {
        const next = [...otpDigits];
        next[idx - 1] = '';
        setOtpDigits(next);
        digitRefs.current[idx - 1]?.focus();
      } else {
        const next = [...otpDigits];
        next[idx] = '';
        setOtpDigits(next);
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      digitRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      digitRefs.current[idx + 1]?.focus();
    }
  }

  function handleDigitPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);
    const targetIdx = Math.min(pasted.length, 5);
    digitRefs.current[targetIdx]?.focus();
  }

  return (
    <div className="dharohar-auth-container">
      {/* Invisible container for Firebase Phone reCAPTCHA */}
      <div id="recaptcha-container" ref={recaptchaContainerRef} />

      {/* ====================================================================
          LEFT PANEL (About 45% Width on Desktop, Indigo Background)
          ==================================================================== */}
      <aside className="dharohar-auth-left">
        {/* Subtle folk geometric pattern overlay (10% opacity) */}
        <div className="auth-folk-pattern-overlay" aria-hidden="true" />

        {/* Slow rotating continuous mandala motif behind content (12% opacity) */}
        <div className="auth-left-mandala" aria-hidden="true">
          <FolkMandalaMotif size={520} />
        </div>

        {/* Content */}
        <div className="auth-left-content">
          <div className="auth-brand-lockup">
            <div className="auth-brand-logo-row">
              <Diya size={48} animated />
              <h1 className="auth-brand-title">Dharohar</h1>
            </div>
            <p className="auth-brand-tagline">
              {lang === 'hi'
                ? 'सच्ची लोक विरासत को बुक करें। गाँव का पैसा गाँव में रहे।'
                : 'Book authentic heritage. Keep the money in the village.'}
            </p>
          </div>

          {/* Three Short Trust Points */}
          <div className="auth-trust-points">
            <div className="auth-trust-point">
              <span className="auth-trust-icon" aria-hidden="true">🪕</span>
              <span>
                {lang === 'hi'
                  ? 'कलाकार प्रत्येक बुकिंग को स्वयं मंज़ूरी देते हैं'
                  : 'Artists approve every booking'}
              </span>
            </div>

            <div className="auth-trust-point">
              <span className="auth-trust-icon" aria-hidden="true">⚖️</span>
              <span>
                {lang === 'hi'
                  ? 'मानदेय नियमों द्वारा सुरक्षित है, अंदाजे से नहीं'
                  : 'Prices protected by rules, not guesswork'}
              </span>
            </div>

            <div className="auth-trust-point">
              <span className="auth-trust-icon" aria-hidden="true">🔒</span>
              <span>
                {lang === 'hi'
                  ? 'भुगतान कलाकार तक पहुँचने तक सुरक्षित ट्रैक होता है'
                  : 'Payment tracked until it reaches the artist'}
              </span>
            </div>
          </div>
        </div>

        {/* Left Panel Footer Note */}
        <div className="auth-left-footer">
          {lang === 'hi'
            ? 'भारतीय लोक परंपराओं का संरक्षण एवं सीधा पारदर्शी मंच।'
            : 'Preserving India’s living cultural heritage with direct, transparent patronage.'}
        </div>
      </aside>

      {/* ====================================================================
          RIGHT PANEL (White Centered Form Card)
          ==================================================================== */}
      <main className="dharohar-auth-right">
        <div className="auth-form-card">
          {/* Top Bar: Return Link & Language Switcher */}
          <div className="auth-card-top-bar">
            {onBack ? (
              <button type="button" onClick={onBack} className="auth-return-link">
                ← {lang === 'hi' ? 'मुख्य पृष्ठ' : 'Home'}
              </button>
            ) : (
              <span />
            )}

            {/* Language Toggle */}
            <div className="auth-lang-toggle" role="group" aria-label="Language selection">
              <button
                type="button"
                className={`auth-lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                English
              </button>
              <button
                type="button"
                className={`auth-lang-btn ${lang === 'hi' ? 'active' : ''}`}
                onClick={() => setLang('hi')}
              >
                हिन्दी
              </button>
            </div>
          </div>

          {/* Form Header */}
          <div className="auth-card-header">
            <h2 className="auth-card-title">
              {step === 'register'
                ? lang === 'hi' ? 'खाता बनाएं' : 'Create an Account'
                : lang === 'hi' ? 'धरोहर में आपका स्वागत है' : 'Welcome to Dharohar'}
            </h2>
            <p className="auth-card-subline">
              {step === 'register'
                ? lang === 'hi' ? 'पंजीकरण पूरा करने के लिए विवरण भरें' : 'Complete your details to join'
                : lang === 'hi' ? 'आगे बढ़ने के लिए लॉग इन करें' : 'Log in to continue'}
            </p>
            {/* Thin Light-Saffron Ornamental Divider (1-2px, 40% opacity) */}
            <LightSaffronDivider />
          </div>

          {/* Step Indicator (1 Role, 2 Phone, 3 Verify) */}
          {step !== 'register' && (
            <div className="auth-step-indicator" role="navigation" aria-label="Sign-in steps">
              <div className={`auth-step-pill ${step === 'phone' ? 'active' : ''}`}>
                <span>1</span>
                <span>{lang === 'hi' ? 'भूमिका' : 'Role'}</span>
              </div>
              <span className="auth-step-divider">›</span>
              <div className={`auth-step-pill ${step === 'phone' ? 'active' : ''}`}>
                <span>2</span>
                <span>{lang === 'hi' ? 'फ़ोन' : 'Phone'}</span>
              </div>
              <span className="auth-step-divider">›</span>
              <div className={`auth-step-pill ${step === 'otp' ? 'active' : ''}`}>
                <span>3</span>
                <span>{lang === 'hi' ? 'सत्यापन' : 'Verify'}</span>
              </div>
            </div>
          )}

          {/* Session / Alert Banner */}
          {sessionNotice && (
            <div
              style={{
                backgroundColor: '#FEF3C7',
                border: '1.5px solid #F59E0B',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '14px',
                color: '#92400E',
                marginBottom: '16px',
                fontWeight: 600,
              }}
              role="alert"
            >
              ℹ {sessionNotice}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1.5px solid #EF4444',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '14px',
                color: '#991B1B',
                marginBottom: '16px',
                fontWeight: 600,
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 1 & 2: ROLE PICKER & PHONE INPUT
              ---------------------------------------------------------------- */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp}>
              {/* Role Picker (2x2 Grid) */}
              <div className="auth-field-group">
                <label className="auth-field-label">
                  {lang === 'hi' ? '१. अपनी भूमिका चुनें:' : '1. Choose Your Role:'}
                </label>

                <div className="auth-role-grid" role="radiogroup">
                  {ROLES.map((r) => {
                    const isSelected = selectedRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`auth-role-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleRoleSelect(r.id)}
                      >
                        {isSelected && <span className="auth-role-check">✓</span>}
                        <span className="auth-role-icon">{r.icon}</span>
                        <span className="auth-role-name">
                          {lang === 'hi' ? r.labelHi : r.labelEn}
                        </span>
                        <span className="auth-role-desc">
                          {lang === 'hi' ? r.descHi : r.descEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seeded Artist Selection (Demo Convenience) */}
              {selectedRole === 'ARTIST' && (
                <div className="auth-field-group">
                  <label htmlFor="artist-select" className="auth-field-label">
                    {lang === 'hi' ? 'कलाकार प्रोफ़ाइल चुनें:' : 'Select Artist Identity:'}
                  </label>
                  <select
                    id="artist-select"
                    value={selectedArtistId}
                    onChange={(e) => handleArtistSelect(e.target.value)}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '14.5px',
                      backgroundColor: '#FAF8F4',
                      color: '#1F1A14',
                    }}
                  >
                    {artistsList.map((art) => (
                      <option key={art.id} value={art.id}>
                        {art.name} — {art.art_form}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Phone Input with +91 Prefix Attached */}
              <div className="auth-field-group">
                <label htmlFor="login-phone" className="auth-field-label">
                  {lang === 'hi' ? '२. मोबाइल फ़ोन नंबर:' : '2. Mobile Phone Number:'}
                </label>

                <div className={`auth-phone-input-wrap ${showPhoneError ? 'has-error' : ''}`}>
                  <span className="auth-phone-prefix">+91</span>
                  <input
                    id="login-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="9000000099"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (!phoneTouched) setPhoneTouched(true);
                    }}
                    onBlur={() => setPhoneTouched(true)}
                    maxLength={15}
                    className="auth-phone-input"
                    required
                  />
                </div>

                {showPhoneError ? (
                  <div className="auth-inline-error">
                    {lang === 'hi'
                      ? '⚠ कृपया एक मान्य 10 अंकों का मोबाइल नंबर दर्ज करें'
                      : '⚠ Please enter a valid 10-digit mobile number'}
                  </div>
                ) : (
                  <div className="auth-field-helper">
                    {lang === 'hi'
                      ? 'हम आपके फ़ोन पर 6 अंकों का सत्यापन कोड भेजेंगे'
                      : 'We will send a 6-digit code to this number'}
                  </div>
                )}
              </div>

              {/* Solid Saffron Send OTP Button (48px height, white text) */}
              <button
                type="submit"
                className="auth-primary-btn"
                disabled={loading || !phone || showPhoneError}
              >
                {loading
                  ? lang === 'hi' ? '⌛ कोड भेजा जा रहा है...' : '⌛ Sending OTP...'
                  : lang === 'hi' ? 'ओटीपी भेजें (Send OTP)' : 'Send OTP'}
              </button>
            </form>
          )}

          {/* ----------------------------------------------------------------
              STEP 3: 6-DIGIT OTP VERIFICATION
              ---------------------------------------------------------------- */}
          {step === 'otp' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="auth-field-label" style={{ margin: 0 }}>
                  {lang === 'hi' ? '३. सत्यापन कोड दर्ज करें:' : '3. Enter 6-Digit Code:'}
                </label>
                <button
                  type="button"
                  className="auth-text-link"
                  onClick={() => {
                    setStep('phone');
                    setError(null);
                  }}
                >
                  {lang === 'hi' ? '← नंबर बदलें' : '← Change Number'}
                </button>
              </div>

              <div style={{ fontSize: '14px', color: '#64748B', marginBottom: '14px' }}>
                {lang === 'hi' ? 'कोड भेजा गया' : 'Code sent to'}{' '}
                <strong style={{ color: '#1F2A5C' }}>{formatPhoneE164(phone)}</strong>
              </div>

              {/* Simulated OTP Display Box if demo mode is active */}
              {demoOtp && isSimulatedAuth && (
                <div
                  style={{
                    backgroundColor: '#FFFBEB',
                    border: '1.5px dashed #F59E0B',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#92400E', fontWeight: 600 }}>
                    {lang === 'hi' ? 'सिम्युलेटेड टेस्ट कोड:' : 'Simulated Test Code:'}
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'monospace', color: '#C2410C', letterSpacing: '2px' }}>
                    {demoOtp}
                  </span>
                </div>
              )}

              {/* 6 Separate Digit Boxes */}
              <form onSubmit={handleVerifyOtp}>
                <div className="auth-otp-row" onPaste={handleDigitPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (digitRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e.target)}
                      className="auth-otp-box"
                      autoFocus={idx === 0}
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>

                {/* Resend Timer & Action */}
                <div className="auth-resend-row">
                  <span className="auth-resend-timer">
                    {resendSeconds > 0
                      ? lang === 'hi' ? `${resendSeconds}s में पुनः भेजें` : `Resend in ${resendSeconds}s`
                      : ''}
                  </span>

                  <button
                    type="button"
                    className="auth-text-link"
                    disabled={resendSeconds > 0 || loading}
                    onClick={handleSendOtp}
                  >
                    ↻ {lang === 'hi' ? 'ओटीपी पुनः भेजें' : 'Resend OTP'}
                  </button>
                </div>

                {/* Verify Button */}
                <button
                  type="submit"
                  className="auth-primary-btn"
                  style={{ marginTop: '16px' }}
                  disabled={loading || otpInput.length < 4}
                >
                  {loading
                    ? lang === 'hi' ? '⌛ सत्यापित हो रहा है...' : '⌛ Verifying...'
                    : lang === 'hi' ? 'सत्यापित करें और प्रवेश करें' : 'Verify & Enter Dharohar'}
                </button>
              </form>
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 4: REGISTRATION STEP FOR NEW USERS
              ---------------------------------------------------------------- */}
          {step === 'register' && (
            <form onSubmit={handleCompleteRegistration}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', color: '#15803D', fontWeight: 700 }}>
                  ✓ {verifiedPhone || formatPhoneE164(phone)} Verified
                </span>
                <button
                  type="button"
                  className="auth-text-link"
                  onClick={() => {
                    setStep('phone');
                    setError(null);
                  }}
                >
                  ← {lang === 'hi' ? 'लॉग इन पर वापस' : 'Back to Login'}
                </button>
              </div>

              {/* Full Name */}
              <div className="auth-field-group">
                <label htmlFor="reg-name" className="auth-field-label">
                  {lang === 'hi' ? 'पूरा नाम या दल का नाम *' : 'Full Name or Troupe Name *'}
                </label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="e.g. Rameshwar Folk Ensemble"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '15px',
                  }}
                  required
                />
              </div>

              {/* Account Role */}
              <div className="auth-field-group">
                <label className="auth-field-label">
                  {lang === 'hi' ? 'खाता भूमिका चुनें *' : 'Choose Account Role *'}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className={`auth-role-card ${regRole === 'ORGANIZER' ? 'selected' : ''}`}
                    onClick={() => setRegRole('ORGANIZER')}
                  >
                    {regRole === 'ORGANIZER' && <span className="auth-role-check">✓</span>}
                    <span className="auth-role-icon">🏛️</span>
                    <span className="auth-role-name">Organizer</span>
                    <span className="auth-role-desc">Book artists with protected payment</span>
                  </button>

                  <button
                    type="button"
                    className={`auth-role-card ${regRole === 'ARTIST' ? 'selected' : ''}`}
                    onClick={() => setRegRole('ARTIST')}
                  >
                    {regRole === 'ARTIST' && <span className="auth-role-check">✓</span>}
                    <span className="auth-role-icon">🪕</span>
                    <span className="auth-role-name">Folk Artist</span>
                    <span className="auth-role-desc">Receive offers & track payouts</span>
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              <div className="auth-field-group">
                <label htmlFor="reg-lang" className="auth-field-label">
                  {lang === 'hi' ? 'संवाद भाषा' : 'Communication Language'}
                </label>
                <select
                  id="reg-lang"
                  value={regLanguage}
                  onChange={(e) => setRegLanguage(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '14.5px',
                    backgroundColor: '#FAF8F4',
                  }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Organizer Fields */}
              {regRole === 'ORGANIZER' && (
                <div style={{ backgroundColor: '#FAF8F4', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#1F2A5C', marginBottom: '10px' }}>
                    🏛️ Organization Details
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Heritage Grand Palace"
                      value={regOrgName}
                      onChange={(e) => setRegOrgName(e.target.value)}
                      style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Organization Type *
                    </label>
                    <select
                      value={regOrgType}
                      onChange={(e) => setRegOrgType(e.target.value)}
                      style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                    >
                      <option value="hotel">Hotel / Heritage Resort</option>
                      <option value="school">School / University</option>
                      <option value="corporate">Corporate / Event Agency</option>
                      <option value="tour operator">Tour Operator</option>
                      <option value="individual">Individual Private Host</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Work Email
                    </label>
                    <input
                      type="email"
                      placeholder="events@heritagepalace.in"
                      value={regWorkEmail}
                      onChange={(e) => setRegWorkEmail(e.target.value)}
                      style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px' }}
                    />
                  </div>
                </div>
              )}

              {/* Legal Consents */}
              <div style={{ margin: '14px 0', fontSize: '13px', color: '#475569' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={consentTerms}
                    onChange={(e) => setConsentTerms(e.target.checked)}
                    required
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal((prev) => !prev)}
                      style={{ border: 'none', background: 'transparent', color: '#B45309', fontWeight: 700, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Terms of Service (v1.0)
                    </button>
                  </span>
                </label>

                {showTermsModal && (
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px', fontSize: '12px', marginBottom: '8px' }}>
                    <strong>Terms Summary:</strong> Guaranteed artist protection, fair compensation floors, and direct milestone payouts.
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={consentPrivacy}
                    onChange={(e) => setConsentPrivacy(e.target.checked)}
                    required
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                      onClick={() => setShowPrivacyModal((prev) => !prev)}
                      style={{ border: 'none', background: 'transparent', color: '#B45309', fontWeight: 700, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      Privacy Policy (v1.0)
                    </button>
                  </span>
                </label>

                {showPrivacyModal && (
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px', fontSize: '12px', marginTop: '6px' }}>
                    <strong>Privacy Summary:</strong> Essential phone verification only. No data reselling or marketing sharing.
                  </div>
                )}
              </div>

              {/* Submit Registration Button */}
              <button
                type="submit"
                className="auth-primary-btn"
                disabled={loading || !regName || !consentTerms || !consentPrivacy}
              >
                {loading
                  ? lang === 'hi' ? '⌛ पंजीकरण हो रहा है...' : '⌛ Registering...'
                  : lang === 'hi' ? 'पंजीकरण पूरा करें' : 'Complete Registration & Enter'}
              </button>
            </form>
          )}

          {/* ----------------------------------------------------------------
              FOOTER: SWITCH LINK & FOOTER NOTE
              ---------------------------------------------------------------- */}
          <div className="auth-card-footer">
            {step === 'register' ? (
              <button
                type="button"
                className="auth-text-link"
                style={{ fontSize: '14.5px', marginBottom: '8px', display: 'inline-block' }}
                onClick={() => setStep('phone')}
              >
                {lang === 'hi' ? 'पहले से खाता है? लॉग इन करें' : 'Already have an account? Log in'}
              </button>
            ) : (
              <button
                type="button"
                className="auth-text-link"
                style={{ fontSize: '14.5px', marginBottom: '8px', display: 'inline-block' }}
                onClick={() => setStep('register')}
              >
                {lang === 'hi' ? 'नए हैं? खाता बनाएं' : 'New here? Create an account'}
              </button>
            )}

            <p className="auth-footer-note">
              {lang === 'hi'
                ? 'लॉग इन आपके फ़ोन पर भेजे गए एकमुश्त कोड का उपयोग करता है।'
                : 'Login uses a one-time code sent to your phone.'}
            </p>
          </div>

          {/* ----------------------------------------------------------------
              PROTOTYPE CHIP & SHORTCUTS (SHOW ONLY WHEN DEMO_MODE IS TRUE)
              ---------------------------------------------------------------- */}
          {isDemoEnv && (
            <div className="auth-demo-box">
              <span className="auth-demo-badge">
                ★ {lang === 'hi' ? 'प्रोटोटाइप: केवल परीक्षण नंबर' : 'Prototype: test numbers only'}
              </span>

              <div className="auth-demo-btn-grid">
                <button
                  type="button"
                  className="auth-demo-btn"
                  onClick={() => handleQuickLogin('9000000099')}
                  disabled={loading}
                  title="Organizer: Hotel Rajmahal Heritage"
                >
                  🏛️ Organizer (9000000099)
                </button>
                <button
                  type="button"
                  className="auth-demo-btn"
                  onClick={() => handleQuickLogin('9000000001')}
                  disabled={loading}
                  title="Folk Artist: Surila Kabilo Troupe"
                >
                  🪕 Folk Artist (9000000001)
                </button>
                <button
                  type="button"
                  className="auth-demo-btn"
                  onClick={() => handleQuickLogin('9000000000')}
                  disabled={loading}
                  title="Platform Operator"
                >
                  ⚙️ Operator (9000000000)
                </button>
                <button
                  type="button"
                  className="auth-demo-btn"
                  onClick={() => handleQuickLogin('9000000088')}
                  disabled={loading}
                  title="Cultural Coordinator"
                >
                  📜 Coordinator (9000000088)
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
