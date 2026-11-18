import React, { useState } from 'react';
import ArtistDashboard from './ArtistDashboard';
import ArtistOnboardingWizard from './ArtistOnboardingWizard';

export default function ArtistProfileWrapper({ currentUser }) {
  const [inWizard, setInWizard] = useState(false);
  const [lang, setLang] = useState('hi');

  return (
    <div>
      {/* Language Switcher Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setLang((prev) => (prev === 'hi' ? 'en' : 'hi'))}
          className="folk-btn-secondary"
          style={{ minHeight: '36px', padding: '0.3rem 0.85rem', fontSize: '0.95rem', fontWeight: 600 }}
          title="Toggle Language"
        >
          🌐 {lang === 'hi' ? 'English' : 'हिन्दी (Hindi)'}
        </button>
      </div>

      {inWizard ? (
        <ArtistOnboardingWizard
          lang={lang}
          onCancel={() => setInWizard(false)}
          onComplete={() => setInWizard(false)}
        />
      ) : (
        <ArtistDashboard
          lang={lang}
          onStartWizard={() => setInWizard(true)}
        />
      )}
    </div>
  );
}
