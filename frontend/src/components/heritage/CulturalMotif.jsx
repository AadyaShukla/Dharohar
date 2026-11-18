import React from 'react';

/**
 * CulturalMotif
 * Scalable SVG iconography for traditional Indian performing arts and craft lineages.
 */
export default function CulturalMotif({
  name = 'sarangi', // 'sarangi' | 'dancer' | 'puppet' | 'dholak' | 'ghungroo' | 'diya' | 'lotus' | 'shield'
  size = 28,
  color = '#8F2F14',
  secondaryColor = '#C69214',
  className = '',
}) {
  switch (name) {
    case 'sarangi':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Wooden Sarangi body */}
          <path
            d="M12 4H20V10C20 12 23 15 23 20C23 25 19 28 16 28C13 28 9 25 9 20C9 15 12 12 12 10V4Z"
            fill={color}
          />
          {/* Soundboard bridge & resonator */}
          <rect x="13" y="18" width="6" height="3" rx="1" fill={secondaryColor} />
          {/* Strings */}
          <line x1="14" y1="5" x2="14" y2="25" stroke="#FAF6EE" strokeWidth="0.8" />
          <line x1="16" y1="5" x2="16" y2="25" stroke="#FAF6EE" strokeWidth="0.8" />
          <line x1="18" y1="5" x2="18" y2="25" stroke="#FAF6EE" strokeWidth="0.8" />
          {/* Tuning pegs */}
          <circle cx="10" cy="6" r="1.5" fill={secondaryColor} />
          <circle cx="22" cy="6" r="1.5" fill={secondaryColor} />
          <circle cx="10" cy="9" r="1.5" fill={secondaryColor} />
          <circle cx="22" cy="9" r="1.5" fill={secondaryColor} />
        </svg>
      );

    case 'dancer':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Traditional swirling folk dancer */}
          <circle cx="16" cy="6" r="3" fill={secondaryColor} />
          <path d="M16 9V16" stroke={color} strokeWidth="2" strokeLinecap="round" />
          {/* Upraised graceful arms */}
          <path d="M9 11C12 14 16 13 23 10" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          {/* Flowing flared skirt (Ghagra) */}
          <path
            d="M16 16C12 19 8 25 6 28C11 29 21 29 26 28C24 25 20 19 16 16Z"
            fill={color}
          />
          <path
            d="M6 28C11 27 21 27 26 28"
            stroke={secondaryColor}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'puppet':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Kathputli string puppet */}
          <circle cx="16" cy="7" r="3.5" fill={secondaryColor} />
          {/* Crown / Turban */}
          <path d="M13 5C14 3 18 3 19 5" stroke={color} strokeWidth="1.5" />
          {/* Traditional painted dress */}
          <polygon points="16,11 11,26 21,26" fill={color} />
          {/* Marionette crossbar & control strings */}
          <line x1="8" y1="2" x2="24" y2="2" stroke={secondaryColor} strokeWidth="1.5" />
          <line x1="10" y1="2" x2="12" y2="14" stroke="#A89E92" strokeWidth="0.8" strokeDasharray="1 1" />
          <line x1="22" y1="2" x2="20" y2="14" stroke="#A89E92" strokeWidth="0.8" strokeDasharray="1 1" />
        </svg>
      );

    case 'dholak':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Barrel drum body */}
          <path
            d="M8 10C8 10 16 7 24 10V22C24 22 16 25 8 22V10Z"
            fill={color}
          />
          {/* Left membrane */}
          <ellipse cx="8" cy="16" rx="2" ry="6" fill={secondaryColor} />
          {/* Right membrane */}
          <ellipse cx="24" cy="16" rx="2" ry="6" fill={secondaryColor} />
          {/* Tension rope webbing */}
          <line x1="8" y1="12" x2="24" y2="18" stroke="#FAF6EE" strokeWidth="0.8" />
          <line x1="8" y1="20" x2="24" y2="14" stroke="#FAF6EE" strokeWidth="0.8" />
        </svg>
      );

    case 'diya':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          className={className}
          aria-hidden="true"
        >
          {/* Terracotta lamp bowl */}
          <path
            d="M6 18C6 24 11 26 16 26C21 26 26 24 26 18H6Z"
            fill={color}
          />
          <ellipse cx="16" cy="18" rx="10" ry="2.5" fill={secondaryColor} />
          {/* Flame */}
          <path
            d="M16 6C16 6 19 10 19 14C19 16 17.5 17.5 16 17.5C14.5 17.5 13 16 13 14C13 10 16 6 16 6Z"
            fill="#D97706"
          />
          <path
            d="M16 9C16 9 17.5 11.5 17.5 14C17.5 15 16.8 16 16 16C15.2 16 14.5 15 14.5 14C14.5 11.5 16 9 16 9Z"
            fill="#FEF08A"
          />
        </svg>
      );
  }
}
