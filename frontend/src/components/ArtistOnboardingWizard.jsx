import React, { useState, useEffect } from 'react';
import {
  getMyArtistProfile,
  createArtistProfile,
  updateMyArtistProfile,
  updateMyArtistRules,
  updateMyAvailability,
  updateMyPayout,
  getLivePrompt,
  uploadAuditionVideo,
  uploadPortfolioPhoto,
  submitArtistForReview,
  getControlledArtForms,
} from '../api';
import { getTranslation } from '../i18n';
import Diya from './folk/Diya';
import Ghungroo from './folk/Ghungroo';
import PaisleyBorder from './folk/PaisleyBorder';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ArtistOnboardingWizard({ onComplete, onCancel, lang = 'hi' }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  // Controlled Art Forms list
  const [artForms, setArtForms] = useState([]);

  // Form State
  const [profileId, setProfileId] = useState(null);
  const [name, setName] = useState('');
  const [artForm, setArtForm] = useState('Kalbelia Dance');
  const [customArtForm, setCustomArtForm] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Rajasthan');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState(5);
  const [groupSize, setGroupSize] = useState(4);
  const [equipmentNeeded, setEquipmentNeeded] = useState('');
  const [languages, setLanguages] = useState(['Hindi']);

  // Rules State
  const [minFee, setMinFee] = useState(12000);
  const [travelRangeKm, setTravelRangeKm] = useState(200);
  const [minDurationMinutes, setMinDurationMinutes] = useState(60);
  const [maxGroupSize, setMaxGroupSize] = useState(12);

  // Availability State
  const [blackoutDates, setBlackoutDates] = useState([]);
  const [newDateInput, setNewDateInput] = useState('');
  const [recurringDays, setRecurringDays] = useState([]);

  // Media & Live Challenge State
  const [livePrompt, setLivePrompt] = useState('');
  const [videoUrls, setVideoUrls] = useState([]);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  // Payout State
  const [upiId, setUpiId] = useState('');

  const t = (key) => getTranslation(key, lang);

  useEffect(() => {
    // Load art forms
    getControlledArtForms()
      .then((forms) => {
        if (forms && forms.length > 0) setArtForms(forms);
      })
      .catch(() => {});

    // Load existing profile if present
    getMyArtistProfile()
      .then((data) => {
        if (data && data.is_onboarded) {
          setProfileId(data.id);
          setName(data.name || '');
          if (artForms.includes(data.art_form)) {
            setArtForm(data.art_form);
          } else {
            setArtForm('Other');
            setCustomArtForm(data.art_form || '');
          }
          setCity(data.city || '');
          setState(data.state || 'Rajasthan');
          setBio(data.bio || '');
          setYearsExperience(data.years_experience || 5);
          setGroupSize(data.group_size || 4);
          setEquipmentNeeded(data.equipment_needed || '');
          setLanguages(data.languages || ['Hindi']);
          setMinFee(data.min_fee || 12000);
          setTravelRangeKm(data.travel_range_km || 200);
          setMinDurationMinutes(data.min_duration_minutes || 60);
          setMaxGroupSize(data.max_group_size || 12);
          setBlackoutDates(data.blackout_dates || []);
          setRecurringDays(data.recurring_unavailable_days || []);
          setVideoUrls(data.video_urls || []);
          setPhotoUrls(data.photo_urls || []);
          setLivePrompt(data.live_prompt_phrase || '');
          setUpiId(data.upi_id || '');
        }
      })
      .catch(() => {});

    // Fetch live prompt challenge phrase
    fetchLivePrompt();
  }, []);

  async function fetchLivePrompt() {
    try {
      const res = await getLivePrompt();
      if (res && res.prompt_phrase) {
        setLivePrompt(res.prompt_phrase);
      }
    } catch (_) {}
  }

  // Save current step progress
  async function handleNextStep() {
    setError(null);
    setSuccessNotice(null);

    if (currentStep === 1) {
      // Validate Step 1
      if (!name || name.trim().length < 2) {
        setError('✖ Error: Please provide an artist or troupe name.');
        return;
      }
      if (!city || city.trim().length < 2) {
        setError('✖ Error: Please specify your home city or village.');
        return;
      }
      if (!bio || bio.trim().length < 10) {
        setError('✖ Error: Please provide a biography (at least 10 characters).');
        return;
      }

      setSaving(true);
      const selectedForm = artForm === 'Other' ? (customArtForm.trim() || 'Other Folk Art') : artForm;
      const payload = {
        name: name.trim(),
        art_form: selectedForm,
        city: city.trim(),
        state: state.trim(),
        bio: bio.trim(),
        languages,
        years_experience: Number(yearsExperience),
        group_size: Number(groupSize),
        equipment_needed: equipmentNeeded.trim(),
        min_fee: Number(minFee),
        travel_range_km: Number(travelRangeKm),
        min_duration_minutes: Number(minDurationMinutes),
        max_group_size: Number(maxGroupSize),
        upi_id: upiId ? upiId.trim() : null,
      };

      try {
        if (!profileId) {
          const res = await createArtistProfile(payload);
          setProfileId(res.id);
        } else {
          await updateMyArtistProfile(payload);
        }
        setSuccessNotice(t('msg_saved_step'));
        setCurrentStep(2);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    } else if (currentStep === 2) {
      // Validate Step 2
      if (!minFee || Number(minFee) < 500) {
        setError('✖ Error: Minimum fee must be at least ₹500.');
        return;
      }

      setSaving(true);
      try {
        await updateMyArtistRules({
          min_fee: Number(minFee),
          travel_range_km: Number(travelRangeKm),
          min_duration_minutes: Number(minDurationMinutes),
          max_group_size: Number(maxGroupSize),
        });
        setSuccessNotice(t('msg_saved_step'));
        setCurrentStep(3);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    } else if (currentStep === 3) {
      // Save Availability
      setSaving(true);
      try {
        await updateMyAvailability({
          blackout_dates: blackoutDates,
          recurring_unavailable_days: recurringDays,
        });
        setSuccessNotice(t('msg_saved_step'));
        setCurrentStep(4);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    } else if (currentStep === 4) {
      // Media step
      if (videoUrls.length === 0) {
        setError('⚠ Warning: Please upload at least one audition video (.mp4) reciting the live challenge code.');
        return;
      }
      setSuccessNotice(t('msg_saved_step'));
      setCurrentStep(5);
    } else if (currentStep === 5) {
      // Payout step
      if (!upiId || !upiId.includes('@')) {
        setError('✖ Error: Please provide a valid UPI ID (e.g. 9876543210@okhdfcbank).');
        return;
      }

      setSaving(true);
      try {
        await updateMyPayout({ upi_id: upiId.trim() });
        setSuccessNotice(t('msg_saved_step'));
        setCurrentStep(6);
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleFinalSubmit() {
    setSaving(true);
    setError(null);
    try {
      await submitArtistForReview();
      setSuccessNotice(t('msg_submitted'));
      if (onComplete) {
        setTimeout(onComplete, 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle Video Upload
  async function handleVideoUpload() {
    if (!videoFile) {
      setError('Please choose an MP4 video file first.');
      return;
    }
    if (!videoFile.name.toLowerCase().endsWith('.mp4')) {
      setError('Only MP4 video files are accepted.');
      return;
    }
    if (videoFile.size > 100 * 1024 * 1024) {
      setError('Video file size exceeds maximum allowed limit of 100MB.');
      return;
    }

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', videoFile);
    if (livePrompt) {
      formData.append('live_prompt', livePrompt);
    }

    try {
      const res = await uploadAuditionVideo(formData);
      setVideoUrls((prev) => [...prev, res.video_url]);
      setVideoFile(null);
      setSuccessNotice('✓ Audition video uploaded successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Handle Photo Upload
  async function handlePhotoUpload() {
    if (!photoFile) {
      setError('Please choose an image file first.');
      return;
    }

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', photoFile);

    try {
      const res = await uploadPortfolioPhoto(formData);
      setPhotoUrls((prev) => [...prev, res.photo_url]);
      setPhotoFile(null);
      setSuccessNotice('✓ Portfolio photo uploaded successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleAddBlackoutDate() {
    if (!newDateInput) return;
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRegex.test(newDateInput.trim())) {
      setError('Date format must be YYYY-MM-DD (e.g. 2026-12-25)');
      return;
    }
    const cleanDate = newDateInput.trim();
    if (!blackoutDates.includes(cleanDate)) {
      setBlackoutDates((prev) => [...prev, cleanDate].sort());
      setNewDateInput('');
    }
  }

  function handleRemoveBlackoutDate(d) {
    setBlackoutDates((prev) => prev.filter((date) => date !== d));
  }

  function handleToggleRecurringDay(day) {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  return (
    <div className="folk-card" style={{ padding: '2rem' }}>
      {/* Wizard Header Lockup */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Diya size={36} animated />
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', margin: 0, color: 'var(--color-dark-maroon)' }}>
              {lang === 'hi' ? 'कलाकार पंजीकरण एवं लिस्टिंग विज़ार्ड' : 'Artist Onboarding & Listing Wizard'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-muted)' }}>
              {lang === 'hi' ? 'चरणबद्ध मार्गदर्शिका द्वारा अपनी प्रामाणिक कला लिस्टिंग तैयार करें' : 'Step-by-step guidance to set up your verified folk artist profile'}
            </p>
          </div>
        </div>

        {onCancel && (
          <button type="button" className="auth-nav-link" onClick={onCancel}>
            {t('btn_back_to_dashboard')}
          </button>
        )}
      </div>

      <PaisleyBorder height={14} />

      {/* Big Step Navigation Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 0', margin: '0.5rem 0 1.5rem 0' }}>
        {[
          { num: 1, label: t('step_profile') },
          { num: 2, label: t('step_rules') },
          { num: 3, label: t('step_availability') },
          { num: 4, label: t('step_media') },
          { num: 5, label: t('step_upi') },
          { num: 6, label: t('step_review') },
        ].map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num)}
              style={{
                flex: '1 1 auto',
                minWidth: '150px',
                padding: '0.75rem 0.6rem',
                borderRadius: '8px',
                border: `2px solid ${isActive ? 'var(--color-vermilion)' : isDone ? 'var(--color-leaf-green)' : 'var(--color-border-subtle)'}`,
                background: isActive ? '#FEF2F2' : isDone ? '#F0FDF4' : '#FFFFFF',
                color: isActive ? 'var(--color-vermilion)' : isDone ? 'var(--color-leaf-green)' : 'var(--color-text-main)',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {isDone ? `✓ ${s.label}` : s.label}
            </button>
          );
        })}
      </div>

      {/* Status Alerts */}
      {successNotice && (
        <div className="login-alert-banner alert-warning" role="alert" style={{ background: '#F0FDF4', color: '#166534', borderColor: '#22C55E' }}>
          <span>✓</span>
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="login-alert-banner alert-danger" role="alert">
          <span>{error}</span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 1: Profile Details                                            */}
      {/* ----------------------------------------------------------------- */}
      {currentStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: 0, color: 'var(--color-dark-maroon)' }}>
            {t('step_profile')}
          </h3>

          <div className="form-group">
            <label htmlFor="troupe-name">{t('label_troupe_name')} *</label>
            <input
              id="troupe-name"
              type="text"
              className="folk-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Surila Kabilo Troupe or Ustad Rahim Khan"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="art-form-select">{t('label_art_form')} *</label>
              <select
                id="art-form-select"
                className="folk-select"
                value={artForm}
                onChange={(e) => setArtForm(e.target.value)}
              >
                {artForms.map((form) => (
                  <option key={form} value={form}>
                    {form}
                  </option>
                ))}
              </select>
            </div>

            {artForm === 'Other' && (
              <div className="form-group">
                <label htmlFor="custom-art-form">Specify Folk Art Form *</label>
                <input
                  id="custom-art-form"
                  type="text"
                  className="folk-input"
                  value={customArtForm}
                  onChange={(e) => setCustomArtForm(e.target.value)}
                  placeholder="e.g. Terah Taali Folk Dance"
                  required
                />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="artist-city">{t('label_city')} *</label>
              <input
                id="artist-city"
                type="text"
                className="folk-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Jodhpur, Barmer, or Jaipur"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="artist-state">{t('label_state')} *</label>
              <input
                id="artist-state"
                type="text"
                className="folk-input"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="artist-bio">{t('label_bio')} *</label>
            <textarea
              id="artist-bio"
              className="folk-input"
              style={{ minHeight: '110px', resize: 'vertical' }}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your tradition, guru lineage, festival achievements, and instruments played..."
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="experience-years">{t('label_experience')}</label>
              <input
                id="experience-years"
                type="number"
                className="folk-input"
                min={0}
                max={70}
                value={yearsExperience}
                onChange={(e) => setYearsExperience(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="group-size">{t('label_group_size')}</label>
              <input
                id="group-size"
                type="number"
                className="folk-input"
                min={1}
                max={150}
                value={groupSize}
                onChange={(e) => setGroupSize(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="equipment-needed">{t('label_equipment')}</label>
            <input
              id="equipment-needed"
              type="text"
              className="folk-input"
              value={equipmentNeeded}
              onChange={(e) => setEquipmentNeeded(e.target.value)}
              placeholder="e.g. 2 vocal mics, 2 instrument pickup mics, monitor speaker"
            />
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 2: Performance Rules & Fees                                  */}
      {/* ----------------------------------------------------------------- */}
      {currentStep === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: '0 0 0.35rem 0', color: 'var(--color-dark-maroon)' }}>
              {t('rules_title')}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
              {t('rules_subtitle')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="min-fee">{t('label_min_fee')} *</label>
              <input
                id="min-fee"
                type="number"
                className="folk-input"
                min={500}
                step={500}
                value={minFee}
                onChange={(e) => setMinFee(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Any booking offer below this minimum will be automatically blocked by Dharohar.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="travel-range">{t('label_travel_range')} *</label>
              <input
                id="travel-range"
                type="number"
                className="folk-input"
                min={10}
                max={2000}
                step={10}
                value={travelRangeKm}
                onChange={(e) => setTravelRangeKm(e.target.value)}
                required
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', display: 'block' }}>
                Organizers farther than this distance cannot book without negotiated travel allowances.
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="min-duration">{t('label_min_duration')} *</label>
              <input
                id="min-duration"
                type="number"
                className="folk-input"
                min={15}
                max={480}
                step={15}
                value={minDurationMinutes}
                onChange={(e) => setMinDurationMinutes(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="max-group-size">{t('label_max_group_size')} *</label>
              <input
                id="max-group-size"
                type="number"
                className="folk-input"
                min={1}
                max={200}
                value={maxGroupSize}
                onChange={(e) => setMaxGroupSize(e.target.value)}
                required
              />
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 3: Availability Calendar                                     */}
      {/* ----------------------------------------------------------------- */}
      {currentStep === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: '0 0 0.35rem 0', color: 'var(--color-dark-maroon)' }}>
              {t('avail_title')}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
              {t('avail_subtitle')}
            </p>
          </div>

          {/* Add Blackout Date */}
          <div className="form-group">
            <label htmlFor="new-date">{t('label_add_blackout_date')}</label>
            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <input
                id="new-date"
                type="date"
                className="folk-input"
                value={newDateInput}
                onChange={(e) => setNewDateInput(e.target.value)}
              />
              <button
                type="button"
                className="folk-btn-secondary"
                onClick={handleAddBlackoutDate}
                disabled={!newDateInput}
                style={{ whiteSpace: 'nowrap' }}
              >
                {t('btn_add_date')}
              </button>
            </div>
          </div>

          {/* Blackout Dates Chips List */}
          <div>
            <label style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>
              Current Blocked Dates ({blackoutDates.length})
            </label>
            {blackoutDates.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                No blackout dates added. You are marked available for all upcoming dates.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {blackoutDates.map((d) => (
                  <span
                    key={d}
                    style={{
                      background: '#FEE2E2',
                      border: '1.5px solid var(--color-vermilion)',
                      borderRadius: '20px',
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: 'var(--color-vermilion)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    📅 {d}
                    <button
                      type="button"
                      onClick={() => handleRemoveBlackoutDate(d)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-vermilion)', fontWeight: 800 }}
                      title="Remove date"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Recurring Unavailable Days */}
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>
              {t('label_recurring_days')}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {DAYS_OF_WEEK.map((day) => {
                const isChecked = recurringDays.includes(day);
                return (
                  <label
                    key={day}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      border: `1.5px solid ${isChecked ? 'var(--color-vermilion)' : 'var(--color-border-subtle)'}`,
                      borderRadius: '8px',
                      background: isChecked ? '#FFF5F5' : '#FFFFFF',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleRecurringDay(day)}
                      style={{ accentColor: 'var(--color-vermilion)', width: '18px', height: '18px' }}
                    />
                    <span>{day}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 4: Media Upload & Live Prompt                                */}
      {/* ----------------------------------------------------------------- */}
      {currentStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: '0 0 0.35rem 0', color: 'var(--color-dark-maroon)' }}>
              {t('media_title')}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
              {t('media_subtitle')}
            </p>
          </div>

          {/* Live Prompt Box */}
          <div
            style={{
              background: '#FFFDF0',
              border: '2px dashed var(--color-amber-gold)',
              borderRadius: '8px',
              padding: '1.25rem',
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-dark-maroon)' }}>
              {t('live_prompt_title')}
            </div>
            <p style={{ margin: '0.35rem 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
              {t('live_prompt_desc')}
            </p>
            <div
              style={{
                background: '#FFFFFF',
                border: '2px solid var(--color-border-dark)',
                borderRadius: '6px',
                padding: '0.75rem 1.25rem',
                fontSize: '1.35rem',
                fontWeight: 800,
                color: 'var(--color-vermilion)',
                letterSpacing: '0.04em',
                textAlign: 'center',
              }}
            >
              "{livePrompt || 'Dharohar Kalakar - Live Code'}"
            </div>
            <button
              type="button"
              className="auth-nav-link"
              onClick={fetchLivePrompt}
              style={{ marginTop: '0.5rem' }}
            >
              {t('btn_refresh_prompt')}
            </button>
          </div>

          {/* Video Upload Field */}
          <div className="form-group">
            <label htmlFor="audition-file">{t('label_select_video')} *</label>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              <input
                id="audition-file"
                type="file"
                accept="video/mp4"
                className="folk-input"
                onChange={(e) => setVideoFile(e.target.files[0])}
              />
              <button
                type="button"
                className="folk-btn-primary"
                onClick={handleVideoUpload}
                disabled={saving || !videoFile}
                style={{ whiteSpace: 'nowrap', minHeight: '44px' }}
              >
                {saving ? '⌛ Uploading...' : t('btn_upload_video')}
              </button>
            </div>
          </div>

          {/* Uploaded Videos List */}
          {videoUrls.length > 0 && (
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>
                Uploaded Audition Videos ({videoUrls.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {videoUrls.map((url, idx) => (
                  <div key={idx} className="verified-phone-card" style={{ background: '#F0FDF4', borderColor: 'var(--color-leaf-green)' }}>
                    <span>🎥 Audition Video #{idx + 1} ({url.split('/').pop()})</span>
                    <a href={url} target="_blank" rel="noreferrer" className="auth-nav-link">
                      Preview Video ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo Upload Field */}
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label htmlFor="photo-file">{t('label_select_photo')}</label>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              <input
                id="photo-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="folk-input"
                onChange={(e) => setPhotoFile(e.target.files[0])}
              />
              <button
                type="button"
                className="folk-btn-secondary"
                onClick={handlePhotoUpload}
                disabled={saving || !photoFile}
                style={{ whiteSpace: 'nowrap', minHeight: '44px' }}
              >
                {saving ? '⌛ Uploading...' : t('btn_upload_photo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 5: UPI Payout Account                                        */}
      {/* ----------------------------------------------------------------- */}
      {currentStep === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: '0 0 0.35rem 0', color: 'var(--color-dark-maroon)' }}>
              {t('upi_title')}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
              {t('upi_subtitle')}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="payout-upi">{t('label_upi_id')} *</label>
            <input
              id="payout-upi"
              type="text"
              className="folk-input"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. 9876543210@okhdfcbank or rajashthan.folk@sbi"
              required
            />
          </div>

          <div
            style={{
              background: '#F0FDF4',
              border: '1.5px solid var(--color-leaf-green)',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              fontSize: '0.95rem',
              lineHeight: 1.5,
              color: '#166534',
            }}
          >
            {t('upi_security_note')}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* STEP 6: Review & Final Submission                                 */}
      {/* ----------------------------------------------------------------- */}
      {currentStep === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', margin: '0 0 0.35rem 0', color: 'var(--color-dark-maroon)' }}>
              {t('review_title')}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '1rem' }}>
              {t('review_subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="verified-phone-card" style={{ background: name ? '#F0FDF4' : '#FFF5F5' }}>
              <span>1. {t('check_profile')}: <strong>{name} ({artForm})</strong></span>
              <span style={{ fontWeight: 700 }}>{name ? '✓ Complete' : '⌛ Incomplete'}</span>
            </div>

            <div className="verified-phone-card" style={{ background: minFee ? '#F0FDF4' : '#FFF5F5' }}>
              <span>2. {t('check_rules')}: <strong>₹{Number(minFee).toLocaleString('en-IN')} min fee • {travelRangeKm} km travel</strong></span>
              <span style={{ fontWeight: 700 }}>{minFee ? '✓ Complete' : '⌛ Incomplete'}</span>
            </div>

            <div className="verified-phone-card" style={{ background: videoUrls.length > 0 ? '#F0FDF4' : '#FFF5F5' }}>
              <span>3. {t('check_video')}: <strong>{videoUrls.length} Video Uploaded</strong></span>
              <span style={{ fontWeight: 700 }}>{videoUrls.length > 0 ? '✓ Complete' : '⌛ Required'}</span>
            </div>

            <div className="verified-phone-card" style={{ background: upiId ? '#F0FDF4' : '#FFF5F5' }}>
              <span>4. {t('check_upi')}: <strong>{upiId ? 'Encrypted UPI Set' : 'Missing'}</strong></span>
              <span style={{ fontWeight: 700 }}>{upiId ? '✓ Complete' : '⌛ Required'}</span>
            </div>
          </div>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              type="button"
              className="folk-btn-primary"
              style={{ padding: '0.95rem 2.5rem', fontSize: '1.15rem' }}
              onClick={handleFinalSubmit}
              disabled={saving || !name || !minFee || videoUrls.length === 0 || !upiId}
            >
              <Ghungroo size={16} />{' '}
              {saving ? '⌛ Submitting...' : t('btn_submit_for_review')}
            </button>
          </div>
        </div>
      )}

      {/* Wizard Footer Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.75rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border-subtle)' }}>
        {currentStep > 1 ? (
          <button
            type="button"
            className="folk-btn-secondary"
            onClick={() => setCurrentStep((prev) => prev - 1)}
            disabled={saving}
          >
            {t('btn_prev')}
          </button>
        ) : <div />}

        {currentStep < 6 && (
          <button
            type="button"
            className="folk-btn-primary"
            onClick={handleNextStep}
            disabled={saving}
            style={{ minHeight: '44px' }}
          >
            {saving ? '⌛ Saving...' : t('btn_save_next')}
          </button>
        )}
      </div>
    </div>
  );
}
