import React from 'react';

/**
 * PaisleyBorder: Traditional Indian Kalka / Paisley & Diamond decorative border strip.
 */
export default function PaisleyBorder({ height = 28, className = '' }) {
  return (
    <div
      className={`paisley-border-strip ${className}`}
      style={{
        width: '100%',
        height: `${height}px`,
        overflow: 'hidden',
        lineHeight: 0,
        margin: '0.5rem 0',
      }}
    >
      <svg
        width="100%"
        height={height}
        viewBox="0 0 800 28"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="paisleyPattern" width="80" height="28" patternUnits="userSpaceOnUse">
            {/* Top & Bottom Thin Lines */}
            <line x1="0" y1="2" x2="80" y2="2" stroke="var(--color-dark-maroon)" strokeWidth="1.5" />
            <line x1="0" y1="26" x2="80" y2="26" stroke="var(--color-dark-maroon)" strokeWidth="1.5" />

            {/* Geometric Diamond Divider */}
            <polygon points="8,14 14,8 20,14 14,20" fill="var(--color-vermilion)" stroke="var(--color-dark-maroon)" strokeWidth="1" />
            <circle cx="14" cy="14" r="2" fill="var(--color-turmeric)" />

            {/* Traditional Paisley / Kalka Silhouette */}
            <path
              d="M32,20 C24,20 22,14 26,9 C29,5 37,5 40,8 C43,11 41,15 47,15 C52,15 50,11 48,10 C46,9 44,11 43,10 C41,8 46,4 51,6 C57,9 56,19 46,20 C40,21 36,20 32,20 Z"
              fill="var(--color-marigold)"
              stroke="var(--color-dark-maroon)"
              strokeWidth="1.2"
            />
            {/* Paisley Inner Eye / Flower */}
            <circle cx="34" cy="14" r="2.5" fill="var(--color-indigo)" />
            <circle cx="43" cy="13" r="1.5" fill="var(--color-vermilion)" />

            {/* Trailing Leaf Accents */}
            <polygon points="62,14 68,9 74,14 68,19" fill="var(--color-leaf-green)" stroke="var(--color-dark-maroon)" strokeWidth="1" />
            <circle cx="68" cy="14" r="1.5" fill="var(--color-cream-paper)" />
          </pattern>
        </defs>

        <rect width="100%" height={height} fill="url(#paisleyPattern)" />
      </svg>
    </div>
  );
}
