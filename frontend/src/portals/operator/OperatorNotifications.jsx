import React, { useState, useEffect } from 'react';
import { getOperatorFailedNotifications, retryFailedNotification } from '../../api';
import { ErrorBanner, EmptyState, SkeletonTable } from '../../components/shared/States';

export default function OperatorNotifications() {
  const [failedList, setFailedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    loadFailed();
  }, []);

  async function loadFailed() {
    setLoading(true);
    setError(null);
    try {
      const data = await getOperatorFailedNotifications();
      setFailedList(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load notifications queue');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(id) {
    setRetryingId(id);
    setNotice(null);
    setError(null);
    try {
      await retryFailedNotification(id);
      setNotice(`Notification #${id} dispatched for retry.`);
      await loadFailed();
    } catch (err) {
      setError(err.message || 'Retry attempt failed');
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#141B2D', margin: '0 0 6px 0', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          Failed Notification &amp; Webhook Retries
        </h1>
        <p style={{ fontSize: '15px', color: '#525866', margin: 0 }}>
          Inspect failed WhatsApp Cloud API or SMTP email deliveries, view delivery attempt logs, and trigger manual retry.
        </p>
      </div>

      {error && <ErrorBanner title="Queue Notice" message={error} onRetry={loadFailed} />}
      {notice && (
        <div style={{ padding: '12px 16px', backgroundColor: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '10px', color: '#15803D', fontWeight: 600, marginBottom: '20px' }}>
          ✓ {notice}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={4} />
      ) : failedList.length === 0 ? (
        <EmptyState
          title="All Notifications Delivered Successfully"
          description="There are currently zero failed WhatsApp or Email notification dispatches."
          icon="🔔"
        />
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E5E7EB', borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF8F4', borderBottom: '1.5px solid #E5E7EB' }}>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>ID</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Recipient</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Channel</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Template</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#374151' }}>Error</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#374151', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {failedList.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace' }}>#{item.id}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600 }}>{item.recipient}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', textTransform: 'uppercase' }}>{item.channel}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13.5px' }}>{item.template_name}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#DC2626' }}>{item.error_message || 'Timeout'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      disabled={retryingId === item.id}
                      onClick={() => handleRetry(item.id)}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#1E3A8A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {retryingId === item.id ? 'Retrying...' : '↻ Retry'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

