import React from 'react';

/**
 * Marigolds: Ambient background petals falling slowly with opacity capped at 20%.
 */
export default function Marigolds() {
  const petals = [
    { left: '4%', delay: '0s', duration: '22s', size: 18 },
    { left: '14%', delay: '6s', duration: '26s', size: 16 },
    { left: '22%', delay: '2s', duration: '24s', size: 20 },
    { left: '33%', delay: '10s', duration: '28s', size: 16 },
    { left: '45%', delay: '1s', duration: '25s', size: 18 },
    { left: '55%', delay: '8s', duration: '27s', size: 16 },
    { left: '65%', delay: '3s', duration: '22s', size: 22 },
    { left: '74%', delay: '12s', duration: '29s', size: 18 },
    { left: '83%', delay: '4s', duration: '23s', size: 16 },
    { left: '91%', delay: '9s', duration: '25s', size: 20 },
    { left: '96%', delay: '3s', duration: '30s', size: 16 },
    { left: '50%', delay: '15s', duration: '24s', size: 18 },
  ];

  return (
    <div
      className="marigolds-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        opacity: 0.22,
      }}
    >
      {petals.map((p, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: p.left,
            top: '-30px',
            animation: `marigoldFall ${p.duration} linear infinite`,
            animationDelay: p.delay,
            width: `${p.size}px`,
            height: `${p.size}px`,
          }}
        >
          <svg viewBox="0 0 40 40" width="100%" height="100%">
            <g transform="translate(20,20)">
              {Array.from({ length: 8 }, (_, i) => {
                const angle = (i * 360) / 8;
                return (
                  <ellipse
                    key={i}
                    cx="0"
                    cy="-9"
                    rx="4.5"
                    ry="8"
                    fill="#F28C28"
                    transform={`rotate(${angle})`}
                  />
                );
              })}
              <circle cx="0" cy="0" r="5" fill="#E8A317" />
              <circle cx="0" cy="0" r="2" fill="#C8412B" />
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}
