import React from 'react';

/**
 * TextileBorder
 * Indian hand-block printing border pattern (Ajrakh / Bagru textile inspired)
 */
export default function TextileBorder({
  height = 18,
  primaryColor = '#8F2F14',
  secondaryColor = '#C69214',
  className = '',
}) {
  return (
    <div
      className={`textile-border-container ${className}`}
      style={{
        width: '100%',
        height: `${height}px`,
        overflow: 'hidden',
        lineHeight: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height={height}
        viewBox="0 0 480 18"
        preserveAspectRatio="repeat-x"
        style={{ display: 'block' }}
      >
        <pattern
          id="textilePattern"
          x="0"
          y="0"
          width="48"
          height="18"
          patternUnits="userSpaceOnUse"
        >
          {/* Top trim line */}
          <line x1="0" y1="1" x2="48" y2="1" stroke={primaryColor} strokeWidth="1" />

          {/* Repeating Diamond & Lotus motif */}
          <polygon
            points="24,3 32,9 24,15 16,9"
            fill="none"
            stroke={secondaryColor}
            strokeWidth="1.2"
          />
          <circle cx="24" cy="9" r="2" fill={primaryColor} />

          {/* Flanking triangles */}
          <polygon points="0,9 6,5 6,13" fill={primaryColor} />
          <polygon points="48,9 42,5 42,13" fill={primaryColor} />

          {/* Dots */}
          <circle cx="10" cy="9" r="1.2" fill={secondaryColor} />
          <circle cx="38" cy="9" r="1.2" fill={secondaryColor} />

          {/* Bottom trim line */}
          <line x1="0" y1="17" x2="48" y2="17" stroke={primaryColor} strokeWidth="1" />
        </pattern>
        <rect width="100%" height="18" fill="url(#textilePattern)" />
      </svg>
    </div>
  );
}
