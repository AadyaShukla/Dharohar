import React from 'react';

/**
 * FolkPattern
 * Lightweight SVG background micro-pattern for cards, headers, and section fills.
 */
export default function FolkPattern({
  variant = 'jaali', // 'jaali' | 'warli' | 'mandala' | 'dots'
  opacity = 0.05,
  color = '#8F2F14',
  style = {},
}) {
  return (
    <div
      className="folk-pattern-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
        opacity,
        overflow: 'hidden',
        ...style,
      }}
      aria-hidden="true"
    >
      <svg width="100%" height="100%">
        <defs>
          {variant === 'jaali' && (
            <pattern
              id="jaaliPattern"
              x="0"
              y="0"
              width="36"
              height="36"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="1" />
              <circle cx="0" cy="0" r="14" fill="none" stroke={color} strokeWidth="1" />
              <circle cx="36" cy="0" r="14" fill="none" stroke={color} strokeWidth="1" />
              <circle cx="0" cy="36" r="14" fill="none" stroke={color} strokeWidth="1" />
              <circle cx="36" cy="36" r="14" fill="none" stroke={color} strokeWidth="1" />
              <circle cx="18" cy="18" r="2.5" fill={color} />
            </pattern>
          )}

          {variant === 'warli' && (
            <pattern
              id="warliPattern"
              x="0"
              y="0"
              width="64"
              height="64"
              patternUnits="userSpaceOnUse"
            >
              {/* Warli triangle dancer */}
              <circle cx="20" cy="12" r="3" fill={color} />
              <polygon points="20,15 14,24 26,24" fill={color} />
              <polygon points="20,33 14,24 26,24" fill={color} />
              <line x1="20" y1="33" x2="16" y2="42" stroke={color} strokeWidth="1.5" />
              <line x1="20" y1="33" x2="24" y2="42" stroke={color} strokeWidth="1.5" />
              <line x1="20" y1="20" x2="12" y2="18" stroke={color} strokeWidth="1.5" />
              <line x1="20" y1="20" x2="28" y2="18" stroke={color} strokeWidth="1.5" />

              {/* Musical instrument (Tarpa / Horn) */}
              <circle cx="48" cy="32" r="2" fill={color} />
              <path d="M48 34 Q 54 44 48 52" fill="none" stroke={color} strokeWidth="1.5" />
            </pattern>
          )}

          {variant === 'dots' && (
            <pattern
              id="dotsPattern"
              x="0"
              y="0"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="12" cy="12" r="1.5" fill={color} />
            </pattern>
          )}
        </defs>

        <rect
          width="100%"
          height="100%"
          fill={`url(#${variant === 'warli' ? 'warliPattern' : variant === 'dots' ? 'dotsPattern' : 'jaaliPattern'})`}
        />
      </svg>
    </div>
  );
}
