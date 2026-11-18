import React from 'react';
import HeroVisual from './heritage/HeroVisual';
import HeritageDivider from './heritage/HeritageDivider';
import TextileBorder from './heritage/TextileBorder';
import FolkPattern from './heritage/FolkPattern';
import CulturalMotif from './heritage/CulturalMotif';
import Diya from './folk/Diya';
import Marigolds from './folk/Marigolds';

export default function LandingPage({
  onExploreArtists,
  onStartBooking,
  onQuickLogin,
  onRunDemo,
  isProcessing,
}) {
  return (
    <div
      className="landing-page-root"
      style={{
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 16px 64px',
        position: 'relative',
      }}
    >
      {/* Background Ambient Marigold Petals */}
      <Marigolds />

      {/* ====================================================================
          1. HERO SECTION — Tradition Meets Technology
          ==================================================================== */}
      <section
        className="hero-section-editorial"
        style={{
          background: 'linear-gradient(180deg, #FFFDF9 0%, #FAF5EE 100%)',
          borderRadius: '24px',
          border: '2px solid var(--dh-border-heritage)',
          boxShadow: 'var(--shadow-xl)',
          padding: '48px 36px 40px',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '40px',
        }}
      >
        <FolkPattern variant="jaali" opacity={0.04} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(280px, 1fr)',
            gap: '36px',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Left Hero Narrative */}
          <div>
            {/* Cultural Micro-badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#92400E',
                marginBottom: '18px',
                letterSpacing: '0.04em',
              }}
            >
              <span>✦</span>
              <span>परंपरा से भविष्य तक • LIVING HERITAGE ECOSYSTEM</span>
            </div>

            {/* Main Hero Headline */}
            <h1
              style={{
                fontFamily: "'Yatra One', cursive",
                fontSize: 'clamp(36px, 5vw, 56px)',
                lineHeight: 1.15,
                color: '#6B1717',
                margin: '0 0 12px',
                letterSpacing: '-0.5px',
              }}
            >
              धरोहर • DHAROHAR
            </h1>

            <h2
              style={{
                fontFamily: "'Yatra One', cursive",
                fontSize: 'clamp(20px, 3vw, 28px)',
                color: '#B84220',
                margin: '0 0 20px',
                fontWeight: 400,
              }}
            >
              Where Tradition Meets Opportunity.
            </h2>

            <p
              style={{
                fontFamily: "'Noto Sans', sans-serif",
                fontSize: '17px',
                lineHeight: 1.65,
                color: '#334155',
                maxWidth: '540px',
                margin: '0 0 32px',
              }}
            >
              Discover India's master folk artists. Let AI agents negotiate transparent, fair-wage compensation.
              Secure every booking through guaranteed TrustPay milestone escrow.
            </p>

            {/* Primary Action Buttons */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'center',
                marginBottom: '28px',
              }}
            >
              <button
                type="button"
                className="folk-btn-primary"
                onClick={onExploreArtists}
                style={{
                  fontSize: '16px',
                  padding: '14px 28px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 6px 20px rgba(184, 66, 32, 0.3)',
                }}
              >
                <span>🔍</span>
                <strong>EXPLORE ARTISTS</strong>
              </button>

              <button
                type="button"
                className="folk-btn-secondary"
                onClick={onStartBooking}
                style={{
                  fontSize: '16px',
                  padding: '14px 26px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#FFFFFF',
                  borderColor: '#6B1717',
                  color: '#6B1717',
                }}
              >
                <span>🚀</span>
                <strong>START A BOOKING</strong>
              </button>

              <button
                type="button"
                onClick={onRunDemo}
                disabled={isProcessing}
                style={{
                  fontSize: '15px',
                  padding: '13px 22px',
                  cursor: isProcessing ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  border: '2px solid #B45309',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.25)',
                }}
              >
                <span>🎬</span>
                <span>{isProcessing ? 'Simulating...' : 'Run Demo Scenario'}</span>
              </button>
            </div>

            {/* Cultural Trust Metric Tags */}
            <div
              style={{
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap',
                fontSize: '13px',
                color: '#6B5E4F',
                fontWeight: 600,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#15803D' }}>✓</span> 100% Direct Village Remittance
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#C69214' }}>★</span> Dual-Agent Fair-Wage Safeguard
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#B84220' }}>🔒</span> Simulated Milestone Escrow
              </span>
            </div>
          </div>

          {/* Right Hero Visual Showcase: Tradition × Technology */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* Decorative Textile Trim */}
      <TextileBorder height={18} />

      {/* ====================================================================
          2. THE THREE PILLARS OF DHAROHAR
          ==================================================================== */}
      <section style={{ margin: '56px 0 44px' }}>
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 40px' }}>
          <h2
            style={{
              fontFamily: "'Yatra One', cursive",
              fontSize: '34px',
              color: '#6B1717',
              margin: '0 0 10px',
            }}
          >
            A Living Cultural Platform Built for Dignity
          </h2>
          <p style={{ fontSize: '16px', color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
            Replacing exploitative broker middlemen with intelligent, transparent negotiation
            so that India’s timeless folk arts thrive for generations to come.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Pillar 1 */}
          <div
            className="curated-artist-card"
            style={{ padding: '28px', background: '#FFFFFF' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <CulturalMotif name="sarangi" size={36} />
              <h3
                style={{
                  fontFamily: "'Yatra One', cursive",
                  fontSize: '22px',
                  color: '#6B1717',
                  margin: 0,
                }}
              >
                Direct Artisan Discovery
              </h3>
            </div>
            <p style={{ fontSize: '15px', lineHeight: 1.65, color: '#4A3E31', margin: 0 }}>
              Access certified troupes across Kalbelia, Manganiyar, Bhavai, Purulia Chhau, and Kathputli traditions.
              Review authentic video auditions with live spoken phrase verifications, transparent troop sizes, and community coordinator vouches.
            </p>
          </div>

          {/* Pillar 2 */}
          <div
            className="curated-artist-card"
            style={{ padding: '28px', background: '#FFFFFF' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <CulturalMotif name="dancer" size={36} />
              <h3
                style={{
                  fontFamily: "'Yatra One', cursive",
                  fontSize: '22px',
                  color: '#6B1717',
                  margin: 0,
                }}
              >
                Multi-Agent AI Negotiation
              </h3>
            </div>
            <p style={{ fontSize: '15px', lineHeight: 1.65, color: '#4A3E31', margin: 0 }}>
              The Organizer Agent optimizes event programming while the Artist Representative Agent enforces strict
              living-wage floors, travel allowances, and minimum booking duration. Rejects predatory lowball bids automatically.
            </p>
          </div>

          {/* Pillar 3 */}
          <div
            className="curated-artist-card"
            style={{ padding: '28px', background: '#FFFFFF' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <CulturalMotif name="diya" size={36} />
              <h3
                style={{
                  fontFamily: "'Yatra One', cursive",
                  fontSize: '22px',
                  color: '#6B1717',
                  margin: 0,
                }}
              >
                TrustPay Milestone Escrow
              </h3>
            </div>
            <p style={{ fontSize: '15px', lineHeight: 1.65, color: '#4A3E31', margin: 0 }}>
              Organizers deposit funds into simulated milestone escrow. 50% travel advance unlocks on verified troupe check-in;
              the 50% remainder releases upon performance completion, backed by cryptographic immutable event logging.
            </p>
          </div>
        </div>
      </section>

      <HeritageDivider motif="diya" color="#C69214" width="70%" />

      {/* ====================================================================
          3. LIVING TRADITIONS GALLERY TEASER
          ==================================================================== */}
      <section style={{ margin: '48px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2
            style={{
              fontFamily: "'Yatra One', cursive",
              fontSize: '30px',
              color: '#6B1717',
              margin: '0 0 8px',
            }}
          >
            Preserved Art Forms &amp; Cultural Lineages
          </h2>
          <p style={{ fontSize: '15px', color: '#6B5E4F', margin: 0 }}>
            Curated folk styles with centuries of oral history, traditional attire, and master craftsmanship.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '18px',
          }}
        >
          {[
            {
              title: 'Kalbelia Folk Dance',
              region: 'Thar Desert, Rajasthan',
              motif: 'dancer',
              desc: 'UNESCO Intangible Cultural Heritage. Sensuous serpentine movements mirroring the black cobra, accompanied by Poongi and Dholak.',
            },
            {
              title: 'Manganiyar Folk Music',
              region: 'Jaisalmer & Barmer',
              motif: 'sarangi',
              desc: 'Hereditary court musicians with complex vocal improvisations, bowed Kamaicha, Sarangi, and Khartal castanets.',
            },
            {
              title: 'Bhavai Balancing Dance',
              region: 'Rajasthan & Gujarat',
              motif: 'diya',
              desc: 'Awe-inspiring acrobatics where female dancers balance up to 9 brass matkas on their head while pirouetting on sword edges.',
            },
            {
              title: 'Purulia Chhau Mask Dance',
              region: 'Bengal & Jharkhand',
              motif: 'puppet',
              desc: 'Vibrant martial folk-dance enacting sacred epics with grand clay masks, somersaults, and thunderous Nagara drumming.',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                background: '#FFFDF9',
                border: '1.5px solid var(--dh-border-heritage)',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <CulturalMotif name={item.motif} size={28} />
                <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '18px', color: '#6B1717', margin: 0 }}>
                  {item.title}
                </h4>
              </div>
              <div style={{ fontSize: '12px', color: '#B45309', fontWeight: 'bold', marginBottom: '8px' }}>
                📍 {item.region}
              </div>
              <p style={{ fontSize: '13.5px', lineHeight: 1.55, color: '#4A3E31', margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ====================================================================
          4. ONE-CLICK DEMO ROLES (Judges & Evaluation Suite)
          ==================================================================== */}
      <section
        style={{
          background: 'linear-gradient(180deg, #FAF5EE 0%, #F5EFEB 100%)',
          border: '2px dashed var(--dh-border-heritage)',
          borderRadius: '20px',
          padding: '36px 28px',
          marginTop: '44px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span
            style={{
              backgroundColor: '#6B1717',
              color: '#FFFFFF',
              padding: '4px 16px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            Interactive Evaluation Suite
          </span>
          <h2
            style={{
              fontFamily: "'Yatra One', cursive",
              fontSize: '28px',
              color: '#6B1717',
              margin: '12px 0 6px',
            }}
          >
            Experience Dharohar from Four Core Perspectives
          </h2>
          <p style={{ fontSize: '15px', color: '#6B5E4F', margin: 0 }}>
            Instant, single-click access for evaluation without needing SMS codes or passwords.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Card 1: Organizer */}
          <div
            className="curated-artist-card"
            style={{ padding: '22px', background: '#FFFFFF' }}
          >
            <div>
              <div style={{ fontSize: '32px', marginBottom: '6px' }}>👑</div>
              <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: '0 0 6px' }}>
                Event Organizer
              </h4>
              <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 16px' }}>
                <strong>Hotel Rajmahal Heritage</strong> • Search verified troupes, negotiate multi-role bookings with AI, deposit simulated escrow.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              onClick={() => onQuickLogin('9000000099')}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
            >
              Sign In as Organizer
            </button>
          </div>

          {/* Card 2: Artist */}
          <div
            className="curated-artist-card"
            style={{ padding: '22px', background: '#FFFFFF' }}
          >
            <div>
              <div style={{ fontSize: '32px', marginBottom: '6px' }}>🪕</div>
              <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: '0 0 6px' }}>
                Folk Artist Troupe
              </h4>
              <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 16px' }}>
                <strong>Desert Sarangi Swar</strong> • Receive booking offers, approve or decline terms, manage calendar blackouts and rate rules.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              onClick={() => onQuickLogin('9000000005')}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
            >
              Sign In as Artist
            </button>
          </div>

          {/* Card 3: Operator */}
          <div
            className="curated-artist-card"
            style={{ padding: '22px', background: '#FFFFFF' }}
          >
            <div>
              <div style={{ fontSize: '32px', marginBottom: '6px' }}>⚙️</div>
              <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: '0 0 6px' }}>
                Platform Operator
              </h4>
              <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 16px' }}>
                <strong>Dharohar Operations</strong> • Review video auditions, oversee escrow releases, resolve reconciliation tickets.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              onClick={() => onQuickLogin('9000000000')}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
            >
              Sign In as Operator
            </button>
          </div>

          {/* Card 4: Coordinator */}
          <div
            className="curated-artist-card"
            style={{ padding: '22px', background: '#FFFFFF' }}
          >
            <div>
              <div style={{ fontSize: '32px', marginBottom: '6px' }}>📜</div>
              <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '20px', color: '#6B1717', margin: '0 0 6px' }}>
                Cultural Coordinator
              </h4>
              <p style={{ fontSize: '13.5px', color: '#4B5563', lineHeight: 1.5, margin: '0 0 16px' }}>
                <strong>Smt. Sharda Devi</strong> • Vouch for traditional heritage lineages and authenticate village performers.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              onClick={() => onQuickLogin('9000000088')}
              style={{ width: '100%', padding: '10px 14px', fontSize: '14px' }}
            >
              Sign In as Coordinator
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
