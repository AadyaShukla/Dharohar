import React from 'react';

/**
 * Mandala: Layered sacred geometric Indian mandala motif with slow rotation and pulsing.
 */
export default function Mandala({ size = 160, className = '' }) {
  const center = size / 2;

  return (
    <div
      className={`mandala-wrapper ${className}`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          animation: 'mandalaPulse 24s ease-in-out infinite',
          transformOrigin: 'center center',
        }}
      >
        <defs>
          {/* Radial Gradient for folk glow */}
          <radialGradient id="mandalaGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-turmeric)" stopOpacity="0.9" />
            <stop offset="60%" stopColor="var(--color-vermilion)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--color-dark-maroon)" stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {/* Outer Ring */}
        <circle
          cx={center}
          cy={center}
          r={center - 8}
          fill="none"
          stroke="var(--color-dark-maroon)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* 12 Outer Petal Points */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 360) / 12;
          return (
            <g key={`outer-${i}`} transform={`translate(${center}, ${center}) rotate(${angle})`}>
              <path
                d="M0,-65 C12,-50 12,-35 0,-25 C-12,-35 -12,-50 0,-65 Z"
                fill="var(--color-marigold)"
                stroke="var(--color-dark-maroon)"
                strokeWidth="1"
              />
              <circle cx="0" cy="-58" r="2" fill="var(--color-indigo)" />
            </g>
          );
        })}

        {/* Middle Diamond Layer */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i * 360) / 8 + 22.5;
          return (
            <g key={`mid-${i}`} transform={`translate(${center}, ${center}) rotate(${angle})`}>
              <polygon
                points="0,-36 12,-18 0,0 -12,-18"
                fill="var(--color-vermilion)"
                stroke="var(--color-dark-maroon)"
                strokeWidth="1"
              />
              <circle cx="0" cy="-18" r="2.5" fill="var(--color-turmeric)" />
            </g>
          );
        })}

        {/* Inner Lotus Petals */}
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i * 360) / 8;
          return (
            <g key={`inner-${i}`} transform={`translate(${center}, ${center}) rotate(${angle})`}>
              <path
                d="M0,-20 C6,-12 6,-6 0,0 C-6,-6 -6,-12 0,-20 Z"
                fill="var(--color-turmeric)"
                stroke="var(--color-dark-maroon)"
                strokeWidth="1"
              />
            </g>
          );
        })}

        {/* Core Center Disc */}
        <circle cx={center} cy={center} r="10" fill="var(--color-indigo)" stroke="var(--color-turmeric)" strokeWidth="2" />
        <circle cx={center} cy={center} r="4" fill="var(--color-cream-paper)" />
      </svg>
    </div>
  );
}
