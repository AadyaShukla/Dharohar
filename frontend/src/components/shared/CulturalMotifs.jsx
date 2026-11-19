import React from 'react';

export function JaaliDivider({ className = '' }) {
  return (
    <div className={`flex items-center gap-4 my-6 jaali-divider-wrap ${className}`} aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(180, 83, 9, 0.3), rgba(20, 27, 45, 0.2), transparent)' }} />
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ color: '#B45309', flexShrink: 0 }}>
        <path d="M14 2L17.2 10.8L26 14L17.2 17.2L14 26L10.8 17.2L2 14L10.8 10.8L14 2Z" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="14" cy="14" r="3" stroke="currentColor" strokeWidth="1.1" />
      </svg>
      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(20, 27, 45, 0.2), rgba(180, 83, 9, 0.3), transparent)' }} />
    </div>
  );
}

export function AnimatedDiya({ size = 36, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={`diya-motif ${className}`} aria-hidden="true" style={{ flexShrink: 0, display: 'inline-block' }}>
      <circle cx="20" cy="13" r="9" fill="#F59E0B" opacity="0.2" />
      <path d="M20 5C20 5 25 11.5 25 15.2C25 18 22.8 20 20 20C17.2 20 15 18 15 15.2C15 11.5 20 5 20 5Z" fill="#D97706" />
      <path d="M20 9.5C20 9.5 22.4 13.5 22.4 15.8C22.4 17.3 21.3 18.5 20 18.5C18.7 18.5 17.6 17.3 17.6 15.8C17.6 13.5 20 9.5 20 9.5Z" fill="#FEF3C7" />
      <path d="M8 22C8 22 12.5 20.5 20 20.5C27.5 20.5 32 22 32 22C31.5 27.5 26.8 31 20 31C13.2 31 8.5 27.5 8 22Z" fill="#92400E" stroke="#141B2D" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M10.5 23.5H29.5" stroke="#FBBF24" strokeWidth="0.9" strokeOpacity="0.65" />
      <path d="M14.5 33.5H25.5" stroke="#141B2D" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function AnimatedSitar({ size = 48, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ flexShrink: 0 }}>
      <g transform="rotate(-30 32 34)">
        <circle cx="32" cy="46" r="11" fill="#92400E" stroke="#141B2D" strokeWidth="1.3" />
        <circle cx="32" cy="46" r="6.5" stroke="#FBBF24" strokeWidth="0.8" strokeOpacity="0.55" />
        <rect x="29.5" y="10" width="5" height="28" rx="1.5" fill="#B45309" stroke="#141B2D" strokeWidth="1.1" />
        <line x1="31" y1="12" x2="31" y2="38" stroke="#FEF3C7" strokeWidth="0.6" />
        <line x1="33" y1="12" x2="33" y2="38" stroke="#FEF3C7" strokeWidth="0.6" />
        <circle cx="32" cy="8" r="3.5" fill="#78350F" stroke="#141B2D" strokeWidth="1" />
      </g>
    </svg>
  );
}

export function AnimatedTabla({ size = 44, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true" style={{ flexShrink: 0 }}>
      {/* Bayan (Left bass drum) */}
      <ellipse cx="23" cy="38" rx="13" ry="11" fill="#78350F" stroke="#141B2D" strokeWidth="1.2" />
      <ellipse cx="23" cy="33" rx="11" ry="6" fill="#FDE68A" stroke="#141B2D" strokeWidth="1" />
      <circle cx="23" cy="33" r="3" fill="#1C1917" />
      {/* Dayan (Right treble drum) */}
      <ellipse cx="43" cy="39" rx="11" ry="10" fill="#92400E" stroke="#141B2D" strokeWidth="1.2" />
      <ellipse cx="43" cy="34" rx="9" ry="5.5" fill="#FEF3C7" stroke="#141B2D" strokeWidth="1" />
      <circle cx="43" cy="34" r="2.8" fill="#1C1917" />
    </svg>
  );
}

export function SarangiIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="11" y="4" width="10" height="24" rx="3" fill="#92400E" stroke="#1F1A14" strokeWidth="1.2" />
      <circle cx="16" cy="18" r="3" fill="#F59E0B" />
      <line x1="14" y1="6" x2="14" y2="26" stroke="#FEF3C7" strokeWidth="0.8" />
      <line x1="16" y1="6" x2="16" y2="26" stroke="#FEF3C7" strokeWidth="0.8" />
      <line x1="18" y1="6" x2="18" y2="26" stroke="#FEF3C7" strokeWidth="0.8" />
    </svg>
  );
}
