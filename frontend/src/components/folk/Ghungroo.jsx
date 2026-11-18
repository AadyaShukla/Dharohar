import React from 'react';

/**
 * Ghungroo: Traditional Indian dancing bell that jingles on hover.
 */
export default function Ghungroo({ size = 18, className = '' }) {
  return (
    <span
      className={`ghungroo-icon ${className}`}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        verticalAlign: 'middle',
        transformOrigin: 'top center',
      }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        {/* Top Tie Ring */}
        <circle cx="12" cy="4" r="2.5" fill="none" stroke="var(--color-dark-maroon)" strokeWidth="1.5" />
        <circle cx="12" cy="4" r="1.2" fill="var(--color-gold)" />

        {/* Brass Bell Body */}
        <path
          d="M6,13 C6,8.5 8.7,6.5 12,6.5 C15.3,6.5 18,8.5 18,13 C18,17.5 15.3,19.5 12,19.5 C8.7,19.5 6,17.5 6,13 Z"
          fill="var(--color-turmeric)"
          stroke="var(--color-dark-maroon)"
          strokeWidth="1.3"
        />

        {/* Highlights */}
        <path d="M9,9 C10,8 11.5,7.8 13,8" fill="none" stroke="#FFF7D6" strokeWidth="1" strokeLinecap="round" />

        {/* Cross Slit Opening of Bell */}
        <line x1="8.5" y1="16" x2="15.5" y2="16" stroke="var(--color-dark-maroon)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1.5" fill="var(--color-dark-maroon)" />
      </svg>
    </span>
  );
}
