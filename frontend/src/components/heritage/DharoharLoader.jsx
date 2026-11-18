import React from 'react';

/**
 * DharoharLoader
 * Custom Indian heritage loading indicator with rotating sacred mandala motif
 * and centered flicker diya flame.
 */
export default function DharoharLoader({
  message = 'Consulting Cultural Network...',
  size = 64,
  className = '',
}) {
  return (
    <div
      className={`dharohar-loader-wrapper ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 16px',
        gap: '14px',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          position: 'relative',
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        {/* Rotating Mandala Ring */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{
            animation: 'spinSlow 10s linear infinite',
            transformOrigin: 'center center',
          }}
        >
          {/* Outer ornamental border */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="#D97706"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* 8-Petal Sacred Lotus Geometry */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => (
            <path
              key={idx}
              d="M 50 20 C 45 32, 55 32, 50 20"
              fill="#B84220"
              transform={`rotate(${angle} 50 50)`}
              opacity="0.8"
            />
          ))}

          {/* Inner ring */}
          <circle
            cx="50"
            cy="50"
            r="24"
            fill="none"
            stroke="#6B1717"
            strokeWidth="2"
          />
        </svg>

        {/* Center Glowing Diya Flame */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${size * 0.36}px`,
            height: `${size * 0.36}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3C12 3 16 8 16 13C16 15.5 14.2 17.5 12 17.5C9.8 17.5 8 15.5 8 13C8 8 12 3 12 3Z"
              fill="#F59E0B"
              style={{ animation: 'flameGlow 1.5s ease-in-out infinite' }}
            />
          </svg>
        </div>
      </div>

      {message && (
        <span
          style={{
            fontFamily: "'Noto Sans', sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            color: '#6B1717',
            letterSpacing: '0.4px',
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
