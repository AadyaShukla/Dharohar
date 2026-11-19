import React from 'react';

export default function LightSaffronDivider({ className = '' }) {
  return (
    <svg
      width="100%"
      height="14"
      viewBox="0 0 320 14"
      fill="none"
      className={className}
      style={{
        opacity: 0.4,
        margin: '8px auto 16px',
        display: 'block',
        maxWidth: '320px',
        color: '#E8590C',
      }}
      aria-hidden="true"
    >
      <line x1="10" y1="7" x2="135" y2="7" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="145" cy="7" r="2" fill="currentColor" />
      <path d="M160 2L165 7L160 12L155 7Z" fill="currentColor" />
      <circle cx="175" cy="7" r="2" fill="currentColor" />
      <line x1="185" y1="7" x2="310" y2="7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
