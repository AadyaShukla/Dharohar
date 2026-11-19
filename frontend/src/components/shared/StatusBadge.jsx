import React from 'react';

/**
 * Standardized Folk Status Badge:
 * Always pairs an Icon + Word on a solid background with strict color contrast.
 */
export default function StatusBadge({ status, size = 'medium' }) {
  const norm = String(status || '').toUpperCase();

  let bg = '#F3F4F6';
  let color = '#374151';
  let border = '#E5E7EB';
  let icon = '✦';
  let label = status || 'Unknown';

  if (norm.includes('SETTLED') || norm.includes('PAID') || norm.includes('VERIFIED') || norm.includes('RELEASED') || norm.includes('APPROVED')) {
    bg = '#DCFCE7';
    color = '#14532D';
    border = '#86EFAC';
    icon = '✓';
    label = norm.includes('SETTLED') ? 'Settled' : norm.includes('PAID') ? 'Paid' : norm.includes('RELEASED') ? 'Funds Released' : 'Approved';
  } else if (norm.includes('ESCROW') || norm.includes('ADVANCE') || norm.includes('CONFIRMED') || norm.includes('HOLD') || norm.includes('AWAITING')) {
    bg = '#FEF3C7';
    color = '#78350F';
    border = '#FCD34D';
    icon = '⏳';
    label = norm.includes('AWAITING') ? 'Awaiting Artist' : norm.includes('ESCROW') ? 'Escrow Held' : 'In Progress';
  } else if (norm.includes('NEGOTIATING') || norm.includes('REQUESTED') || norm.includes('UNDER_REVIEW')) {
    bg = '#E0F2FE';
    color = '#0C4A6E';
    border = '#7DD3FC';
    icon = '💬';
    label = norm.includes('NEGOTIATING') ? 'Negotiating' : norm.includes('UNDER_REVIEW') ? 'Under Review' : 'Requested';
  } else if (norm.includes('DISPUTE') || norm.includes('FAILED') || norm.includes('DECLINED') || norm.includes('REJECTED') || norm.includes('EXPIRED')) {
    bg = '#FEE2E2';
    color = '#7F1D1D';
    border = '#FCA5A5';
    icon = '⚠️';
    label = norm.includes('DECLINED') ? 'Declined' : norm.includes('DISPUTE') ? 'Disputed' : norm.includes('EXPIRED') ? 'Expired' : 'Failed';
  }

  const isSmall = size === 'small';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '4px' : '6px',
        padding: isSmall ? '3px 8px' : '5px 12px',
        borderRadius: '9999px',
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        fontSize: isSmall ? '13px' : '14.5px',
        fontWeight: 600,
        fontFamily: "'Noto Sans', sans-serif",
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: isSmall ? '12px' : '14px' }}>{icon}</span>
      <span>{label}</span>
    </span>
  );
}
