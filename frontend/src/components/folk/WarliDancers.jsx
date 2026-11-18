import React from 'react';

/**
 * WarliDancers: Radial ring of traditional Indian Warli stick-figure dancers holding hands.
 */
export default function WarliDancers({ size = 180, color = 'var(--color-dark-maroon)', className = '' }) {
  const count = 10;
  const radius = 64;
  const center = size / 2;

  const dancers = Array.from({ length: count }, (_, i) => {
    const angle = (i * 360) / count;
    const rad = (angle * Math.PI) / 180;
    const x = center + radius * Math.cos(rad);
    const y = center + radius * Math.sin(rad);
    const rotation = angle + 90; // face outwards or in ring direction

    return (
      <g key={i} transform={`translate(${x}, ${y}) rotate(${rotation})`}>
        {/* Head */}
        <circle cx="0" cy="-22" r="4.5" fill={color} />
        {/* Neck */}
        <line x1="0" y1="-17.5" x2="0" y2="-15" stroke={color} strokeWidth="1.5" />
        {/* Upper Triangle Body */}
        <polygon points="0,-15 -8,-5 8,-5" fill={color} />
        {/* Lower Triangle Body */}
        <polygon points="0,5 -8,-5 8,-5" fill={color} />
        {/* Waist Dot */}
        <circle cx="0" cy="-5" r="1.5" fill="var(--color-cream-paper)" />
        {/* Left Arm (holding hands outward) */}
        <path d="M-8,-5 Q -14,-10 -20,-2" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        {/* Right Arm (holding hands outward) */}
        <path d="M8,-5 Q 14,-10 20,-2" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        {/* Left Leg */}
        <path d="M-4,5 L-8,17 L-12,17" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        {/* Right Leg */}
        <path d="M4,5 L8,17 L12,17" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </g>
    );
  });

  return (
    <div
      className={`warli-dancers-wrapper ${className}`}
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
          animation: 'spinSlow 45s linear infinite',
          transformOrigin: 'center center',
        }}
      >
        {/* Inner concentric ring */}
        <circle cx={center} cy={center} r={radius - 22} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
        {/* Connecting hands link circle */}
        <circle cx={center} cy={center} r={radius + 4} fill="none" stroke={color} strokeWidth="0.8" strokeDasharray="1 4" opacity="0.4" />
        {dancers}
      </svg>
    </div>
  );
}
