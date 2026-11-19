import React from 'react';

export function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid rgba(229, 231, 235, 0.9)',
        borderRadius: '12px',
        overflow: 'hidden',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'pulse 1.8s infinite ease-in-out',
      }}
      aria-hidden="true"
    >
      <div style={{ width: '100%', height: '140px', backgroundColor: '#F3EFE6', borderRadius: '8px' }} />
      <div style={{ height: '18px', width: '60%', backgroundColor: '#EAE4D9', borderRadius: '4px' }} />
      <div style={{ height: '14px', width: '85%', backgroundColor: '#F3EFE6', borderRadius: '4px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        <div style={{ height: '24px', width: '80px', backgroundColor: '#EAE4D9', borderRadius: '4px' }} />
        <div style={{ height: '32px', width: '90px', backgroundColor: '#D97706', opacity: 0.3, borderRadius: '6px' }} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        overflow: 'hidden',
        animation: 'pulse 1.8s infinite ease-in-out',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          height: '44px',
          backgroundColor: '#F3EFE6',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '24px',
        }}
      >
        <div style={{ height: '14px', width: '120px', backgroundColor: '#DED6C7', borderRadius: '4px' }} />
        <div style={{ height: '14px', width: '160px', backgroundColor: '#DED6C7', borderRadius: '4px' }} />
        <div style={{ height: '14px', width: '90px', backgroundColor: '#DED6C7', borderRadius: '4px', marginLeft: 'auto' }} />
      </div>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              borderBottom: i < rows - 1 ? '1px solid #F3F4F6' : 'none',
            }}
          >
            <div style={{ height: '16px', width: '100px', backgroundColor: '#F3EFE6', borderRadius: '4px' }} />
            <div style={{ height: '16px', width: '220px', backgroundColor: '#EAE4D9', borderRadius: '4px' }} />
            <div style={{ height: '16px', width: '110px', backgroundColor: '#F3EFE6', borderRadius: '4px', marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = '🔍',
}) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '48px 24px',
        textAlign: 'center',
        maxWidth: '560px',
        margin: '24px auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#FEF3C7',
          color: '#B45309',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          margin: '0 auto 16px',
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F1A14', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '15px', color: '#525866', lineHeight: '1.6', marginBottom: '24px' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 22px',
            fontSize: '15px',
            fontWeight: 600,
            color: '#FFFFFF',
            backgroundColor: '#C2410C',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#9A3412')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#C2410C')}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorBanner({
  title = 'Operation Error',
  message,
  onRetry,
}) {
  const displayMessage = typeof message === 'object' ? JSON.stringify(message) : String(message || 'An unexpected error occurred.');

  return (
    <div
      role="alert"
      style={{
        backgroundColor: '#FEF2F2',
        border: '1.5px solid #FECACA',
        borderRadius: '10px',
        padding: '16px 20px',
        margin: '16px 0',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 1px 4px rgba(220, 38, 38, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '20px', lineHeight: 1 }} aria-hidden="true">⚠️</span>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 'bold', color: '#7F1D1D', margin: '0 0 2px 0' }}>
            {title}
          </p>
          <p style={{ fontSize: '14px', color: '#991B1B', margin: 0, wordBreak: 'break-word', fontFamily: 'monospace' }}>
            {displayMessage}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 600,
            color: '#7F1D1D',
            backgroundColor: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: '6px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ↻ Retry
        </button>
      )}
    </div>
  );
}
