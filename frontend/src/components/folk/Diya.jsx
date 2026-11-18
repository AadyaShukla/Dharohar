import React from 'react';

/**
 * Diya: Traditional Indian clay oil lamp with a gentle flickering flame.
 */
export default function Diya({ size = 36, className = '' }) {
  return (
    <span
      className={`diya-icon ${className}`}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        verticalAlign: 'middle',
      }}
    >
      <svg viewBox="0 0 48 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Flame Gradient */}
          <radialGradient id="flameGrad" cx="50%" cy="80%" r="70%">
            <stop offset="0%" stopColor="#FFF7D6" />
            <stop offset="40%" stopColor="var(--color-turmeric)" />
            <stop offset="85%" stopColor="var(--color-vermilion)" />
            <stop offset="100%" stopColor="var(--color-dark-maroon)" stopOpacity="0.8" />
          </radialGradient>
        </defs>

        {/* Flickering Flame */}
        <g
          style={{
            animation: 'flameFlicker 1.8s ease-in-out infinite',
            transformOrigin: '24px 22px',
          }}
        >
          {/* Outer Flame Glow */}
          <path
            d="M24,4 C19,13 18,18 24,24 C30,18 29,13 24,4 Z"
            fill="url(#flameGrad)"
          />
          {/* Inner Flame Core */}
          <path
            d="M24,10 C21,15 21,18 24,22 C27,18 27,15 24,10 Z"
            fill="#FFFDEB"
            opacity="0.85"
          />
        </g>

        {/* Cotton Wick tip */}
        <line x1="24" y1="21" x2="24" y2="25" stroke="#372618" strokeWidth="1.5" strokeLinecap="round" />

        {/* Clay Lamp Base (Terracotta Diya) */}
        <path
          d="M8,26 C12,38 36,38 40,26 C42,28 36,32 32,33 C26,34 22,34 16,33 C12,32 6,28 8,26 Z"
          fill="var(--color-terracotta)"
          stroke="var(--color-dark-maroon)"
          strokeWidth="1.5"
        />

        {/* Diya Lip / Rim */}
        <ellipse
          cx="24"
          cy="26"
          rx="16"
          ry="4"
          fill="var(--color-vermilion)"
          stroke="var(--color-dark-maroon)"
          strokeWidth="1.2"
        />

        {/* Oil Pool inside Diya */}
        <ellipse cx="24" cy="26" rx="12" ry="2.2" fill="var(--color-turmeric)" opacity="0.9" />

        {/* Diya Base Stand */}
        <path
          d="M20,36 L28,36 L30,39 L18,39 Z"
          fill="var(--color-dark-maroon)"
        />
      </svg>
    </span>
  );
}
