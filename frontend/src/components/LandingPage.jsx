import React from 'react';
import Diya from './folk/Diya';
import Toran from './folk/Toran';
import Marigolds from './folk/Marigolds';
import PaisleyBorder from './folk/PaisleyBorder';
import WarliDancers from './folk/WarliDancers';

export default function LandingPage({
  onExploreArtists,
  onStartBooking,
  onQuickLogin,
  onRunDemo,
  isProcessing,
}) {
  return (
    <div className="landing-page-wrapper" style={{ width: '100%', maxWidth: '1240px', margin: '0 auto', padding: '0 16px 48px' }}>
      {/* Background Animated Petals */}
      <Marigolds />

      {/* Hero Section */}
      <section
        className="hero-section"
        style={{
          textAlign: 'center',
          padding: '48px 24px 36px',
          background: 'linear-gradient(180deg, #FFFDF9 0%, #FAF5EE 100%)',
          borderRadius: '16px',
          border: '2px solid #C4A482',
          boxShadow: '0 12px 32px rgba(90, 24, 0, 0.08)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '36px',
        }}
      >
        {/* Subtle folk backdrop art */}
        <div style={{ position: 'absolute', top: -30, right: -40, opacity: 0.07, pointerEvents: 'none' }}>
          <WarliDancers size={320} />
        </div>
        <div style={{ position: 'absolute', bottom: -30, left: -40, opacity: 0.07, pointerEvents: 'none' }}>
          <WarliDancers size={320} />
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <Diya size={48} animated />
          <h1
            style={{
              fontFamily: "'Yatra One', cursive",
              fontSize: '44px',
              color: '#8B2500',
              margin: 0,
              letterSpacing: '1px',
              textShadow: '1px 1px 0 #FAF5EE',
            }}
          >
            धरोहर • Dharohar
          </h1>
          <Diya size={48} animated />
        </div>

        <h2
          style={{
            fontFamily: "'Yatra One', cursive",
            fontSize: '24px',
            color: '#B45309',
            marginTop: 0,
            marginBottom: '16px',
            fontWeight: 400,
          }}
        >
          Where Tradition Meets Opportunity
        </h2>

        <p
          style={{
            fontSize: '18px',
            lineHeight: 1.6,
            color: '#4A3E31',
            maxWidth: '780px',
            margin: '0 auto 28px',
          }}
        >
          India’s AI-powered booking and escrow protocol for traditional folk artists.
          Connecting cultural organizers with verified village troupes through fair-wage AI negotiation
          and guaranteed TrustPay milestone escrow.
        </p>

        {/* Primary Call-to-Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}
        >
          <button
            type="button"
            className="folk-btn-primary"
            onClick={onExploreArtists}
            style={{
              fontSize: '18px',
              padding: '14px 28px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 6px 16px rgba(139, 37, 0, 0.25)',
            }}
          >
            <span>🔍</span>
            <strong>Explore Artists</strong>
          </button>

          <button
            type="button"
            className="folk-btn-secondary"
            onClick={onStartBooking}
            style={{
              fontSize: '18px',
              padding: '14px 28px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#FFFFFF',
              borderColor: '#8B2500',
              color: '#8B2500',
            }}
          >
            <span>🚀</span>
            <strong>Sign In / Start Booking</strong>
          </button>

          <button
            type="button"
            onClick={onRunDemo}
            disabled={isProcessing}
            style={{
              fontSize: '18px',
              padding: '14px 28px',
              cursor: isProcessing ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              border: '2px solid #B45309',
              borderRadius: '8px',
              fontWeight: 'bold',
              boxShadow: '0 6px 16px rgba(217, 119, 6, 0.25)',
            }}
          >
            <span>🎬</span>
            <strong>{isProcessing ? 'Running Scenario...' : 'Run Demo Scenario'}</strong>
          </button>
        </div>

        <div style={{ fontSize: '14px', color: '#786C5E' }}>
          ✨ No credit card required • Full guest exploration • Deterministic simulated mode
        </div>
      </section>

      {/* Decorative Divider */}
      <PaisleyBorder height={20} />

      {/* 3 Pillars of Dharohar */}
      <section style={{ margin: '40px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2
            style={{
              fontFamily: "'Yatra One', cursive",
              fontSize: '32px',
              color: '#8B2500',
              margin: '0 0 8px',
            }}
          >
            Built for Authentic Heritage & Fair Compensation
          </h2>
          <p style={{ fontSize: '16px', color: '#6B5E4F', margin: 0 }}>
            Every interaction is designed to keep money in rural artisan communities and eliminate exploitative middlemen.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              background: '#FFFDF9',
              border: '2px solid #C4A482',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🪕</div>
            <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '22px', color: '#8B2500', margin: '0 0 8px' }}>
              Authentic Folk Discovery
            </h3>
            <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#4A3E31' }}>
              Explore certified troupes across Kalbelia Dance, Manganiyar Folk Music, Bhavai, Chhau, Kathputli,
              and traditional Blue Pottery craft demonstrations. Direct video auditions, transparent group sizes, and verified reviews.
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              background: '#FFFDF9',
              border: '2px solid #C4A482',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🤖</div>
            <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '22px', color: '#8B2500', margin: '0 0 8px' }}>
              Multi-Agent AI Negotiation
            </h3>
            <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#4A3E31' }}>
              Our dual-agent negotiation engine matches organizer requirements with artist minimum fee constraints,
              travel distance thresholds, and group sizes. Rejects lowball offers automatically to guarantee a dignified livelihood.
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              background: '#FFFDF9',
              border: '2px solid #C4A482',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
            <h3 style={{ fontFamily: "'Yatra One', cursive", fontSize: '22px', color: '#8B2500', margin: '0 0 8px' }}>
              TrustPay Milestone Escrow
            </h3>
            <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#4A3E31' }}>
              Organizer funds are locked safely in simulated escrow. 50% advance released on arrival, 50% remainder on successful performance.
              Guarantees artists get paid on time while protecting event organizers with dispute reconciliation.
            </p>
          </div>
        </div>
      </section>

      {/* One-Click Demo Role Cards */}
      <section
        style={{
          background: '#FAF5EE',
          border: '2px dashed #C4A482',
          borderRadius: '16px',
          padding: '32px 24px',
          marginTop: '36px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span
            style={{
              backgroundColor: '#8B2500',
              color: '#FFFFFF',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            One-Click Demo Roles
          </span>
          <h2
            style={{
              fontFamily: "'Yatra One', cursive",
              fontSize: '28px',
              color: '#8B2500',
              margin: '10px 0 6px',
            }}
          >
            Experience Dharohar from Any Perspective
          </h2>
          <p style={{ fontSize: '15px', color: '#6B5E4F', margin: 0 }}>
            Click any role to test the live platform with instant pre-configured credentials.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '18px',
          }}
        >
          {/* Organizer Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #C4A482',
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>👑</div>
              <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '18px', margin: '0 0 4px', color: '#8B2500' }}>
                Event Organizer
              </h4>
              <p style={{ fontSize: '13px', color: '#6B5E4F', margin: '0 0 12px' }}>
                Hotel Rajmahal Heritage • Submit booking inquiries, negotiate pricing with AI, deposit simulated escrow.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              style={{ padding: '8px 12px', fontSize: '14px', width: '100%' }}
              onClick={() => onQuickLogin('9000000099')}
            >
              Sign In as Organizer
            </button>
          </div>

          {/* Artist Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #C4A482',
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🪕</div>
              <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '18px', margin: '0 0 4px', color: '#8B2500' }}>
                Folk Artist
              </h4>
              <p style={{ fontSize: '13px', color: '#6B5E4F', margin: '0 0 12px' }}>
                Desert Sarangi Swar • Receive booking offers, approve or decline terms, manage availability and bank details.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              style={{ padding: '8px 12px', fontSize: '14px', width: '100%' }}
              onClick={() => onQuickLogin('9000000005')}
            >
              Sign In as Artist
            </button>
          </div>

          {/* Operator Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #C4A482',
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚙️</div>
              <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '18px', margin: '0 0 4px', color: '#8B2500' }}>
                Platform Operator
              </h4>
              <p style={{ fontSize: '13px', color: '#6B5E4F', margin: '0 0 12px' }}>
                Dharohar Operations • Review video auditions, oversee simulated escrow releases, resolve reconciliation tickets.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              style={{ padding: '8px 12px', fontSize: '14px', width: '100%' }}
              onClick={() => onQuickLogin('9000000000')}
            >
              Sign In as Operator
            </button>
          </div>

          {/* Coordinator Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #C4A482',
              borderRadius: '10px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📜</div>
              <h4 style={{ fontFamily: "'Yatra One', cursive", fontSize: '18px', margin: '0 0 4px', color: '#8B2500' }}>
                Cultural Coordinator
              </h4>
              <p style={{ fontSize: '13px', color: '#6B5E4F', margin: '0 0 12px' }}>
                Smt. Sharda Devi • Vouch for traditional lineage and village authenticity to unlock trusted status for troupes.
              </p>
            </div>
            <button
              type="button"
              className="folk-btn-primary"
              style={{ padding: '8px 12px', fontSize: '14px', width: '100%' }}
              onClick={() => onQuickLogin('9000000088')}
            >
              Sign In as Coordinator
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
