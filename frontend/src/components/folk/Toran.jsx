import React from 'react';

/**
 * Toran: Traditional Indian auspicious doorway hanging with swaying mango leaves & marigold flowers.
 */
export default function Toran({ className = '' }) {
  // Repeating scallops across the header
  const scallops = Array.from({ length: 12 }, (_, i) => {
    const x = i * 80;
    const isEven = i % 2 === 0;

    return (
      <g key={i} transform={`translate(${x}, 0)`}>
        {/* Curved string / garland arc */}
        <path
          d="M0,8 Q40,24 80,8"
          fill="none"
          stroke="var(--color-dark-maroon)"
          strokeWidth="2.5"
          strokeDasharray="4 2"
        />

        {/* Mango Leaf / Triangular Pennant */}
        <path
          d="M40,20 C32,24 30,42 40,56 C50,42 48,24 40,20 Z"
          fill={isEven ? 'var(--color-leaf-green)' : 'var(--color-vermilion)'}
          stroke="var(--color-dark-maroon)"
          strokeWidth="1.5"
        />
        {/* Leaf central vein */}
        <line x1="40" y1="23" x2="40" y2="48" stroke="var(--color-gold)" strokeWidth="1" />

        {/* Marigold Flower Ball at the junction */}
        <circle cx="80" cy="8" r="9" fill="var(--color-marigold)" stroke="var(--color-dark-maroon)" strokeWidth="1.2" />
        <circle cx="80" cy="8" r="6" fill="var(--color-turmeric)" />
        <circle cx="80" cy="8" r="2.5" fill="var(--color-vermilion)" />

        {/* Side mini marigold on leaf */}
        <circle cx="40" cy="58" r="4.5" fill="var(--color-turmeric)" stroke="var(--color-dark-maroon)" strokeWidth="1" />
      </g>
    );
  });

  return (
    <div
      className={`toran-banner ${className}`}
      style={{
        width: '100%',
        height: '62px',
        overflow: 'hidden',
        pointerEvents: 'none',
        animation: 'toranSway 8s ease-in-out infinite',
        transformOrigin: 'top center',
      }}
    >
      <svg
        width="100%"
        height="62"
        viewBox="0 0 960 62"
        preserveAspectRatio="xMidYMin slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top Header Cord */}
        <line x1="0" y1="4" x2="960" y2="4" stroke="var(--color-dark-maroon)" strokeWidth="3" />
        <line x1="0" y1="6" x2="960" y2="6" stroke="var(--color-gold)" strokeWidth="1.5" />
        {/* Leftmost start marigold */}
        <circle cx="0" cy="8" r="9" fill="var(--color-marigold)" stroke="var(--color-dark-maroon)" strokeWidth="1.2" />
        <circle cx="0" cy="8" r="6" fill="var(--color-turmeric)" />
        {scallops}
      </svg>
    </div>
  );
}
