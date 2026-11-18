import React from 'react';

/**
 * HeritageDivider
 * Elegant Indian ornamental horizontal divider with center traditional motif
 * and flanking filigree lines.
 */
export default function HeritageDivider({
  motif = 'lotus', // 'lotus' | 'diya' | 'paisley' | 'diamond'
  color = '#8F2F14',
  opacity = 0.85,
  width = '100%',
  className = '',
}) {
  return (
    <div
      className={`heritage-divider ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        margin: '18px 0',
        opacity,
      }}
      aria-hidden="true"
    >
      {/* Left Filigree Line */}
      <svg
        height="12"
        style={{ flex: 1, minWidth: '40px' }}
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1="6"
          x2="185"
          y2="6"
          stroke={color}
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
        <circle cx="192" cy="6" r="2.5" fill={color} />
        <circle cx="198" cy="6" r="1.5" fill={color} />
      </svg>

      {/* Center Motif */}
      <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center' }}>
        {motif === 'diya' && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C12 2 15 5 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 5 12 2 12 2Z"
              fill="#D97706"
            />
            <path
              d="M4 13C4 17.42 7.58 21 12 21C16.42 21 20 17.42 20 13H4Z"
              fill={color}
            />
            <ellipse cx="12" cy="13" rx="8" ry="2" fill="#E5B338" />
          </svg>
        )}

        {motif === 'paisley' && (
          <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
            <path d="M12 3C8 3 5 6.5 5 10.5C5 14.5 8 18 12 21C14 21 16 19.5 17 18C18.5 15.5 18 13.5 16.5 12C15 10.5 13.5 11 12.5 10C11.5 9 12 7.5 13.5 7C14.5 6.5 15.5 6.5 16 7C15 4.5 13.5 3 12 3Z" />
          </svg>
        )}

        {motif === 'diamond' && (
          <svg width="22" height="22" viewBox="0 0 24 24" fill={color}>
            <polygon points="12,2 22,12 12,22 2,12" fill="none" stroke={color} strokeWidth="2" />
            <polygon points="12,6 18,12 12,18 6,12" fill={color} />
          </svg>
        )}

        {motif === 'lotus' && (
          <svg width="26" height="22" viewBox="0 0 26 22" fill="none">
            {/* Center petal */}
            <path
              d="M13 2C13 2 9 8 9 14C9 17.5 11 20 13 20C15 20 17 17.5 17 14C17 8 13 2 13 2Z"
              fill={color}
            />
            {/* Left petal */}
            <path
              d="M11 6C11 6 5 10 5 15C5 18 8 20 11 20C9.5 18.5 8 15 11 6Z"
              fill="#D95D39"
            />
            {/* Right petal */}
            <path
              d="M15 6C15 6 21 10 21 15C21 18 18 20 15 20C16.5 18.5 18 15 15 6Z"
              fill="#D95D39"
            />
            {/* Base flourish */}
            <path
              d="M2 19C7 17 19 17 24 19"
              stroke="#C69214"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Right Filigree Line */}
      <svg
        height="12"
        style={{ flex: 1, minWidth: '40px' }}
        viewBox="0 0 200 12"
        preserveAspectRatio="none"
      >
        <circle cx="2" cy="6" r="1.5" fill={color} />
        <circle cx="8" cy="6" r="2.5" fill={color} />
        <line
          x1="15"
          y1="6"
          x2="200"
          y2="6"
          stroke={color}
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />
      </svg>
    </div>
  );
}
