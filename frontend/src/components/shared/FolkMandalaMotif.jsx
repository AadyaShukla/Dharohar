import React from 'react';

/**
 * FolkMandalaMotif: Sacred geometric continuous mandala motif for deep indigo surfaces.
 * Uses fine solid strokes (no dotted/dashed rings).
 */
export default function FolkMandalaMotif({ size = 480, className = '' }) {
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      {/* Outer concentric continuous circles */}
      <circle cx={center} cy={center} r={center - 12} stroke="#FEF3C7" strokeWidth="1.2" />
      <circle cx={center} cy={center} r={center - 28} stroke="#FEF3C7" strokeWidth="1.0" />
      <circle cx={center} cy={center} r={center - 56} stroke="#FEF3C7" strokeWidth="1.0" />
      <circle cx={center} cy={center} r={center - 90} stroke="#FEF3C7" strokeWidth="1.2" />
      <circle cx={center} cy={center} r={center - 130} stroke="#FEF3C7" strokeWidth="1.0" />
      <circle cx={center} cy={center} r={center - 170} stroke="#FEF3C7" strokeWidth="1.2" />

      {/* 16 Radial Rays */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 360) / 16;
        return (
          <g key={`ray-${i}`} transform={`translate(${center}, ${center}) rotate(${angle})`}>
            <line x1="0" y1={-center + 28} x2="0" y2={-center + 12} stroke="#FEF3C7" strokeWidth="1.2" />
            <circle cx="0" cy={-center + 20} r="2.5" fill="#FEF3C7" />
            {/* Petal diamond */}
            <path
              d={`M0,${-center + 60} L7,${-center + 75} L0,${-center + 90} L-7,${-center + 75} Z`}
              stroke="#FEF3C7"
              strokeWidth="1.0"
            />
          </g>
        );
      })}

      {/* 8 Inner Lotus Petals */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 360) / 8;
        return (
          <g key={`inner-${i}`} transform={`translate(${center}, ${center}) rotate(${angle})`}>
            <path
              d="M0,-120 C18,-90 18,-60 0,-40 C-18,-60 -18,-90 0,-120 Z"
              stroke="#FEF3C7"
              strokeWidth="1.2"
            />
            <circle cx="0" cy="-80" r="3" fill="#FEF3C7" />
          </g>
        );
      })}

      {/* Center Bindu */}
      <circle cx={center} cy={center} r="16" stroke="#FEF3C7" strokeWidth="1.5" />
      <circle cx={center} cy={center} r="6" fill="#FEF3C7" />
    </svg>
  );
}
