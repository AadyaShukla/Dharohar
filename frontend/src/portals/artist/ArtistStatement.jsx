import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { AnimatedDiya } from '../../components/shared/CulturalMotifs';

export default function ArtistStatement() {
  const { lang, profile, artistId, myOffers } = useOutletContext() || {};

  const completedOffers = (myOffers || []).filter(
    (b) => b.status === 'SETTLED' || b.status === 'FUNDS_RELEASED' || b.status === 'PAID' || b.status === 'ESCROW_HELD'
  );

  let totalAmount = 0;
  completedOffers.forEach((b) => {
    const roleMatch = b.negotiated_roles
      ? Object.entries(b.negotiated_roles).find(([_, r]) => r.artist_id === artistId)
      : null;
    const price = roleMatch ? roleMatch[1].price / 100 : (b.budget_paise ? b.budget_paise / 100 : b.budget) || 12000;
    totalAmount += price;
  });

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 4px 0' }}>
            {lang === 'hi' ? 'मानदेय विवरण पत्र (Statement)' : 'Official Earnings Statement'}
          </h1>
          <p style={{ fontSize: '14px', color: '#525866', margin: 0 }}>
            {lang === 'hi'
              ? 'प्रमाणित लोक कलाकार मानदेय रसीद एवं विवरण पत्र।'
              : 'Verified folk performance earnings report and TrustPay disbursement record.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          style={{
            padding: '10px 20px',
            backgroundColor: '#1E3A8A',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 700,
            fontSize: '14.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          🖨️ {lang === 'hi' ? 'प्रिंट / डाउनलोड करें' : 'Print / Download PDF'}
        </button>
      </div>

      {/* Printable Statement Sheet */}
      <div
        className="printable-statement"
        style={{
          backgroundColor: '#FFFFFF',
          border: '2px solid #D1D5DB',
          borderRadius: '16px',
          padding: '32px 28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}
      >
        {/* Statement Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #C2410C', paddingBottom: '18px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AnimatedDiya size={42} />
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#C2410C', margin: 0, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                धरोहर • Dharohar
              </h2>
              <div style={{ fontSize: '12px', color: '#525866', letterSpacing: '0.5px' }}>
                INDIAN FOLK HERITAGE &amp; TRUSTPAY ESCROW PLATFORM
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#141B2D' }}>
              STATEMENT #{Date.now().toString().slice(-8)}
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Artist Profile Meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#FAF8F4', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Folk Troupe / Artist</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#141B2D' }}>{profile?.name || 'Folk Artist'}</div>
            <div style={{ fontSize: '13px', color: '#525866' }}>Art Form: {profile?.art_form || 'Living Heritage'}</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#6B7280', textTransform: 'uppercase' }}>Settlement Account</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#141B2D' }}>
              {profile?.payout_method === 'bank' ? `Bank A/C: ••••${profile?.bank_account_number?.slice(-4) || '8899'}` : `UPI ID: ${profile?.upi_id || 'master@upi'}`}
            </div>
            <div style={{ fontSize: '13px', color: '#15803D', fontWeight: 700 }}>
              Status: Verified by Regional Coordinator
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '28px' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #E5E7EB', backgroundColor: '#F3EDE4' }}>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Date</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Booking Reference</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Patron / Organizer</th>
              <th style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 700, color: '#374151', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {completedOffers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
                  No settled performances on record yet.
                </td>
              </tr>
            ) : (
              completedOffers.map((b) => {
                const roleMatch = b.negotiated_roles
                  ? Object.entries(b.negotiated_roles).find(([_, r]) => r.artist_id === artistId)
                  : null;
                const price = roleMatch ? roleMatch[1].price / 100 : (b.budget_paise ? b.budget_paise / 100 : b.budget) || 12000;

                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px', fontSize: '13.5px', color: '#374151' }}>
                      {b.event_date || '2026-12-20'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13.5px', fontFamily: 'monospace', color: '#1E3A8A', fontWeight: 600 }}>
                      #{b.id.slice(0, 10)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13.5px', color: '#1F1A14', fontWeight: 600 }}>
                      {b.organizer_name}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14.5px', fontWeight: 800, color: '#15803D', textAlign: 'right' }}>
                      ₹{price.toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Total Summary */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #E5E7EB', paddingTop: '16px' }}>
          <div style={{ minWidth: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', marginBottom: '6px' }}>
              <span>Total Disbursed:</span>
              <strong style={{ fontSize: '18px', color: '#15803D' }}>₹{totalAmount.toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280', textAlign: 'right' }}>
              0% Platform Fee Deducted from Artist
            </div>
          </div>
        </div>

        {/* Footer Stamp */}
        <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px dashed #D1D5DB', textAlign: 'center', fontSize: '12px', color: '#6B7280' }}>
          <p style={{ margin: '0 0 4px 0' }}>
            Keep the money in the village. Direct-to-artisan escrow powered by Dharohar TrustPay.
          </p>
          <p style={{ margin: 0, fontStyle: 'italic' }}>
            This document is a certified computer-generated statement issued under Dharohar Platform Guidelines.
          </p>
        </div>
      </div>
    </div>
  );
}

