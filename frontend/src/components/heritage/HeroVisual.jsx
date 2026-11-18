import React from 'react';

/**
 * HeroVisual — TRADITION × TECHNOLOGY
 * The primary visual centerpiece of Dharohar.
 * Depicts an authentic Indian folk sarangi master and dancer silhouetted inside
 * a sacred architectural jharokha arch, seamlessly merged with floating algorithmic
 * neural nodes, digital golden ratio grids, and ambient marigold petals.
 */
export default function HeroVisual({ className = '' }) {
  return (
    <div
      className={`hero-visual-composition ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '560px',
        margin: '0 auto',
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label="Cultural illustration: Folk artist empowered by AI technology"
    >
      <svg
        viewBox="0 0 500 500"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'visible',
          filter: 'drop-shadow(0 16px 36px rgba(107, 23, 23, 0.12))',
        }}
      >
        <defs>
          {/* Luminous heritage background gradient */}
          <radialGradient id="haloGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#FDE68A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFFDF9" stopOpacity="0" />
          </radialGradient>

          {/* Golden AI Circuit Linear Gradient */}
          <linearGradient id="aiTechBeam" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E2958" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#D97706" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#B84220" stopOpacity="0.8" />
          </linearGradient>

          {/* Jharokha arch clip path */}
          <clipPath id="jharokhaClip">
            <path d="M 120 440 L 120 190 C 120 120, 200 90, 250 50 C 300 90, 380 120, 380 190 L 380 440 Z" />
          </clipPath>
        </defs>

        {/* ====================================================================
            LAYER 1: Ambient Halo & Subtle Digital AI Grid (Technology)
            ==================================================================== */}
        <circle cx="250" cy="250" r="220" fill="url(#haloGlow)" />

        {/* Digital isometric wireframe & coordinate grid behind arch */}
        <g opacity="0.18">
          {/* Vertical code / calculation grid lines */}
          <line x1="80" y1="100" x2="80" y2="400" stroke="#1E2958" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="160" y1="60" x2="160" y2="440" stroke="#1E2958" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="250" y1="30" x2="250" y2="470" stroke="#D97706" strokeWidth="1.2" strokeDasharray="4 2" />
          <line x1="340" y1="60" x2="340" y2="440" stroke="#1E2958" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="420" y1="100" x2="420" y2="400" stroke="#1E2958" strokeWidth="1" strokeDasharray="3 4" />

          {/* Horizontal pulse coordinates */}
          <line x1="50" y1="150" x2="450" y2="150" stroke="#1E2958" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="30" y1="250" x2="470" y2="250" stroke="#1E2958" strokeWidth="1" strokeDasharray="3 4" />
          <line x1="50" y1="350" x2="450" y2="350" stroke="#1E2958" strokeWidth="1" strokeDasharray="3 4" />

          {/* Concentric rotating radar rings (AI matching zone) */}
          <circle cx="250" cy="250" r="190" fill="none" stroke="#C69214" strokeWidth="1" strokeDasharray="6 8" />
          <circle cx="250" cy="250" r="130" fill="none" stroke="#B84220" strokeWidth="1" strokeDasharray="4 6" />
        </g>

        {/* Floating AI Neural Data Nodes */}
        <g className="floating-ai-nodes" style={{ animation: 'floatSlow 6s ease-in-out infinite' }}>
          {/* Node 1: Fair Wage Algorithm */}
          <circle cx="95" cy="170" r="4.5" fill="#D97706" />
          <circle cx="95" cy="170" r="10" fill="none" stroke="#D97706" strokeWidth="0.8" opacity="0.6" />
          <line x1="95" y1="170" x2="160" y2="200" stroke="url(#aiTechBeam)" strokeWidth="1.2" />

          {/* Node 2: TrustPay Escrow Lock */}
          <circle cx="410" cy="160" r="5" fill="#15803D" />
          <circle cx="410" cy="160" r="11" fill="none" stroke="#15803D" strokeWidth="0.8" opacity="0.6" />
          <line x1="410" y1="160" x2="340" y2="210" stroke="url(#aiTechBeam)" strokeWidth="1.2" />

          {/* Node 3: Multi-Agent Negotiator */}
          <circle cx="110" cy="360" r="4" fill="#B84220" />
          <line x1="110" y1="360" x2="180" y2="340" stroke="url(#aiTechBeam)" strokeWidth="1.2" />

          {/* Node 4: Verified Lineage */}
          <circle cx="390" cy="340" r="4.5" fill="#C69214" />
          <line x1="390" y1="340" x2="320" y2="320" stroke="url(#aiTechBeam)" strokeWidth="1.2" />
        </g>

        {/* ====================================================================
            LAYER 2: Rajasthani Jharokha Palace Arch (Tradition)
            ==================================================================== */}
        {/* Outer carved decorative arch border */}
        <path
          d="M 100 450 L 100 190 C 100 110, 190 75, 250 30 C 310 75, 400 110, 400 190 L 400 450 Z"
          fill="#FAF6EE"
          stroke="#6B1717"
          strokeWidth="4"
        />

        {/* Inner scalloped arch fill with traditional Ajrakh textile border */}
        <path
          d="M 115 445 L 115 190 C 115 118, 195 86, 250 45 C 305 86, 385 118, 385 190 L 385 445 Z"
          fill="#FFFDF9"
          stroke="#C69214"
          strokeWidth="2"
          strokeDasharray="5 3"
        />

        {/* Arch top finial / Kalash */}
        <path d="M 250 15 C 245 23, 245 28, 250 30 C 255 28, 255 23, 250 15 Z" fill="#C69214" />
        <circle cx="250" cy="12" r="3" fill="#B84220" />

        {/* Corner Mandala medallions */}
        <circle cx="100" cy="100" r="16" fill="none" stroke="#C69214" strokeWidth="1.2" opacity="0.4" />
        <circle cx="400" cy="100" r="16" fill="none" stroke="#C69214" strokeWidth="1.2" opacity="0.4" />

        {/* ====================================================================
            LAYER 3: Authentic Folk Performers Silhouette & Artwork
            ==================================================================== */}
        <g clipPath="url(#jharokhaClip)">
          {/* Desert dune horizon silhouette */}
          <path d="M 120 380 Q 200 350 280 390 T 380 375 L 380 440 L 120 440 Z" fill="#EADBBE" opacity="0.6" />

          {/* Primary Folk Figure: Manganiyar Sarangi Virtuoso */}
          {/* Traditional Royal Rajasthani Pagri (Turban) */}
          <path
            d="M 215 165 C 215 145, 240 135, 260 140 C 275 145, 280 160, 275 172 C 265 176, 220 178, 215 165 Z"
            fill="#D97706"
          />
          {/* Turban fold lines */}
          <path d="M 222 152 Q 248 142 272 155" stroke="#B45309" strokeWidth="1.5" />
          <path d="M 220 162 Q 250 154 274 165" stroke="#B45309" strokeWidth="1.5" />
          {/* Turra (turban feather/jewel crest) */}
          <circle cx="262" cy="138" r="3" fill="#6B1717" />

          {/* Face profile */}
          <ellipse cx="248" cy="180" rx="14" ry="16" fill="#C4A482" />
          {/* Traditional mustache */}
          <path d="M 242 186 Q 252 188 262 184" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />

          {/* Traditional White / Cream Angrakha Kurta */}
          <path
            d="M 220 196 L 195 330 C 195 350, 305 350, 305 330 L 278 196 C 265 192, 235 192, 220 196 Z"
            fill="#F4ECE1"
            stroke="#C4A482"
            strokeWidth="1.5"
          />
          {/* Angrakha side-tie sash (Patka) */}
          <path d="M 248 200 L 235 280" stroke="#6B1717" strokeWidth="2.5" />
          <polygon points="230,280 240,280 245,310 225,310" fill="#6B1717" />

          {/* Classical Folk Instrument: Sarangi */}
          <g transform="translate(15, -5)">
            {/* Wooden resonator & body */}
            <path
              d="M 270 215 C 268 200, 282 195, 282 180 L 282 170 H 295 L 295 180 C 295 195, 309 200, 307 215 C 305 240, 272 240, 270 215 Z"
              fill="#8F2F14"
            />
            {/* Skin head parchment */}
            <ellipse cx="288" cy="225" rx="11" ry="8" fill="#E5B338" />
            {/* Bridge & sympathetic strings */}
            <line x1="288" y1="172" x2="288" y2="235" stroke="#FAF6EE" strokeWidth="1.2" />
            <line x1="285" y1="175" x2="285" y2="233" stroke="#FAF6EE" strokeWidth="0.8" />
            <line x1="291" y1="175" x2="291" y2="233" stroke="#FAF6EE" strokeWidth="0.8" />

            {/* Horsehair Gaz (Bow) */}
            <path d="M 255 245 Q 290 228 325 210" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="255" y1="245" x2="325" y2="210" stroke="#C69214" strokeWidth="1" />
          </g>

          {/* Second Folk Figure: Graceful Kalbelia / Ghoomar Swirling Silhouette */}
          <g opacity="0.85" transform="translate(-18, 20)">
            {/* Odhani (veil) swirling in air */}
            <path
              d="M 180 210 C 160 190, 140 230, 135 260 C 145 250, 165 240, 175 235 Z"
              fill="#B84220"
              opacity="0.9"
            />
            {/* Head & Odhani contour */}
            <circle cx="178" cy="225" r="7" fill="#6B1717" />
            {/* Flared Kalbelia tiered skirt with mirrorwork border */}
            <path
              d="M 175 245 C 160 265, 130 310, 125 340 C 155 350, 195 345, 205 330 C 195 295, 185 265, 175 245 Z"
              fill="#1F2A5C"
            />
            <path
              d="M 125 340 Q 165 352 205 330"
              stroke="#D97706"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Mirrorwork dots */}
            <circle cx="145" cy="340" r="2" fill="#FFFFFF" />
            <circle cx="165" cy="342" r="2" fill="#FFFFFF" />
            <circle cx="185" cy="338" r="2" fill="#FFFFFF" />
          </g>

          {/* Diya flame of living tradition */}
          <g transform="translate(236, 345)">
            <ellipse cx="14" cy="18" rx="14" ry="4" fill="#B84220" />
            <path d="M 14 6 Q 20 12 14 17 Q 8 12 14 6 Z" fill="#F59E0B" style={{ animation: 'flameGlow 2s ease-in-out infinite' }} />
          </g>
        </g>

        {/* Ambient marigold petal accents drifting */}
        <g opacity="0.75" style={{ animation: 'gentleDrift 7s ease-in-out infinite' }}>
          <circle cx="120" cy="130" r="5" fill="#D97706" />
          <circle cx="370" cy="280" r="4" fill="#D97706" />
          <circle cx="350" cy="110" r="4.5" fill="#B84220" />
          <circle cx="110" cy="310" r="3.5" fill="#C69214" />
        </g>
      </svg>
    </div>
  );
}
