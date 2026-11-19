import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { submitArtistForReview, uploadAuditionVideo, uploadPortfolioPhoto, updateMyArtistProfile } from '../../api';
import { ErrorBanner } from '../../components/shared/States';
import { SarangiIcon } from '../../components/shared/CulturalMotifs';

export default function ArtistProfile() {
  const { lang, profile, reloadArtistData } = useOutletContext() || {};

  const [bio, setBio] = useState(profile?.bio || '');
  const [city, setCity] = useState(profile?.city || profile?.region || 'Jodhpur, Rajasthan');
  const [groupSize, setGroupSize] = useState(profile?.max_group_size || 6);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  async function handleSaveBio(e) {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await updateMyArtistProfile({
        bio,
        city,
        max_group_size: Number(groupSize),
      });
      setNotice(lang === 'hi' ? '✓ प्रोफाइल विवरण सुरक्षित कर लिया गया!' : '✓ Profile details updated successfully!');
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e, type) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (type === 'audition') {
        await uploadAuditionVideo(formData);
        setNotice(lang === 'hi' ? '✓ ऑडिशन वीडियो अपलोड हो गया!' : '✓ Audition video uploaded successfully!');
      } else {
        await uploadPortfolioPhoto(formData);
        setNotice(lang === 'hi' ? '✓ पोर्टफोलियो फोटो अपलोड हो गई!' : '✓ Portfolio photo uploaded successfully!');
      }
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitReview() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await submitArtistForReview();
      setNotice(
        lang === 'hi'
          ? '✓ आपका प्रोफाइल ऑपरेटर समीक्षा हेतु जमा कर दिया गया है।'
          : '✓ Profile submitted for review by regional cultural coordinator.'
      );
      if (reloadArtistData) await reloadArtistData();
    } catch (err) {
      setError(err.message || 'Submission failed');
    } finally {
      setSaving(false);
    }
  }

  const isVerified = profile?.verification_status === 'VERIFIED' || profile?.reliability_tier === 'TIER_1_HERITAGE';

  return (
    <div>
      <div style={{ marginBottom: '22px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0' }}>
          {lang === 'hi' ? 'कलाकार प्रोफ़ाइल व प्रमाणन (Profile)' : 'Artist Profile & Heritage Verification'}
        </h1>
        <p style={{ fontSize: '15px', color: '#525866', margin: 0 }}>
          {lang === 'hi'
            ? 'अपनी कला का परिचय, फोटो, और ऑडिशन वीडियो प्रबंधित करें।'
            : 'Manage your artistic lineage, audition recordings, and regional coordinator verification.'}
        </p>
      </div>

      {error && <ErrorBanner title={lang === 'hi' ? 'त्रुटि' : 'Error'} message={error} />}
      {notice && (
        <div style={{ padding: '14px 18px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '12px', color: '#15803D', fontWeight: 700, fontSize: '15.5px', marginBottom: '20px' }}>
          {notice}
        </div>
      )}

      {/* Verification Status Banner */}
      <div
        style={{
          backgroundColor: isVerified ? '#F0FDF4' : '#FFFBEB',
          border: `2px solid ${isVerified ? '#86EFAC' : '#FCD34D'}`,
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '28px' }}>{isVerified ? '🛡️' : '⏳'}</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: isVerified ? '#166534' : '#92400E', textTransform: 'uppercase' }}>
              {lang === 'hi' ? 'प्रमाणन स्थिति' : 'Verification Status'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D' }}>
              {isVerified
                ? lang === 'hi' ? 'प्रमाणित हेरिटेज कलाकार (Tier 1)' : 'Tier 1 Heritage Verified'
                : lang === 'hi' ? 'समीक्षा में (Under Review)' : 'Under Operator Review'}
            </div>
          </div>
        </div>

        {!isVerified && (
          <button
            type="button"
            onClick={handleSubmitReview}
            disabled={saving}
            style={{
              padding: '10px 18px',
              backgroundColor: '#C2410C',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            {lang === 'hi' ? 'समीक्षा हेतु जमा करें' : 'Submit for Review'}
          </button>
        )}
      </div>

      {/* Media Upload Area */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '20px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#141B2D', marginBottom: '12px' }}>
          {lang === 'hi' ? 'ऑडिशन वीडियो एवं तस्वीरें' : 'Audition Video & Portfolio Photos'}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Upload Video */}
          <label
            style={{
              padding: '20px',
              backgroundColor: '#FAF8F4',
              border: '2px dashed #D1D5DB',
              borderRadius: '12px',
              textAlign: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'block',
            }}
          >
            <span style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>🎥</span>
            <strong style={{ fontSize: '14px', color: '#141B2D', display: 'block' }}>
              {lang === 'hi' ? 'ऑडिशन वीडियो' : 'Upload Audition Video'}
            </strong>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>MP4 / WebM</span>
            <input
              type="file"
              accept="video/*"
              disabled={uploading}
              onChange={(e) => handleFileUpload(e, 'audition')}
              style={{ display: 'none' }}
            />
          </label>

          {/* Upload Photo */}
          <label
            style={{
              padding: '20px',
              backgroundColor: '#FAF8F4',
              border: '2px dashed #D1D5DB',
              borderRadius: '12px',
              textAlign: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
              display: 'block',
            }}
          >
            <span style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>📸</span>
            <strong style={{ fontSize: '14px', color: '#141B2D', display: 'block' }}>
              {lang === 'hi' ? 'पोर्टफोलियो फोटो' : 'Upload Photo'}
            </strong>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>JPG / PNG</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => handleFileUpload(e, 'photo')}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Edit Bio & Details */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#141B2D', marginBottom: '16px' }}>
          {lang === 'hi' ? 'विवरण एवं कला परिचय' : 'Bio & Ensemble Details'}
        </h3>

        <form onSubmit={handleSaveBio} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
              {lang === 'hi' ? 'शहर / ज़िला' : 'Home City / District'}
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #D1D5DB', fontSize: '15px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
              {lang === 'hi' ? 'दल में कलाकारों की अधिकतम संख्या' : 'Max Troupe Size'}
            </label>
            <input
              type="number"
              min="1"
              max="25"
              value={groupSize}
              onChange={(e) => setGroupSize(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #D1D5DB', fontSize: '15px' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
              {lang === 'hi' ? 'कला व वंश परंपरा का परिचय (Bio)' : 'Artistic Heritage & Background'}
            </label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="अपनी कला, वाद्ययंत्रों और गुरु परंपरा के बारे में लिखें..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #D1D5DB', fontSize: '15px', fontFamily: 'inherit' }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              height: '52px',
              backgroundColor: '#1E3A8A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16.5px',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'सुरक्षित हो रहा है...' : lang === 'hi' ? 'विवरण सुरक्षित करें' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

