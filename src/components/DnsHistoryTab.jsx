import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { getAuthHeaders } from '../utils/auth.ts';

const DnsHistoryTab = ({ zone, auth, onClose, onRollbackComplete, t, showToast }) => {
    const [snapshots, setSnapshots] = useState([]);
    const [snapshotsLoading, setSnapshotsLoading] = useState(false);
    const [rollbackLoading, setRollbackLoading] = useState(null);
    const [snapshotPage, setSnapshotPage] = useState(1);
    const [snapshotTotal, setSnapshotTotal] = useState(0);
    const [snapshotTotalPages, setSnapshotTotalPages] = useState(1);
    const snapshotPerPage = 10;

    const fetchSnapshots = async (page = 1) => {
        setSnapshotsLoading(true);
        try {
            const res = await fetch(`/api/zones/${zone.id}/dns_history?page=${page}&per_page=${snapshotPerPage}`, {
                headers: getAuthHeaders(auth)
            });
            if (res.ok) {
                const data = await res.json();
                setSnapshots(data.snapshots || []);
                setSnapshotPage(data.page || 1);
                setSnapshotTotal(data.total || 0);
                setSnapshotTotalPages(data.total_pages || 1);
            }
        } catch (err) { console.error('Failed to fetch snapshots:', err); }
        setSnapshotsLoading(false);
    };

    useEffect(() => {
        fetchSnapshots(1);
    }, [zone.id]);

    const handleRollback = async (snapshotKey) => {
        if (!confirm(t('rollbackConfirm'))) return;
        setRollbackLoading(snapshotKey);
        try {
            const res = await fetch(`/api/zones/${zone.id}/dns_history`, {
                method: 'POST',
                headers: { ...getAuthHeaders(auth), 'Content-Type': 'application/json' },
                body: JSON.stringify({ snapshotKey })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const r = data.results;
                showToast(
                    t('rollbackSuccess') + ` (${t('rollbackDetail').replace('{deleted}', r.deleted).replace('{created}', r.created).replace('{updated}', r.updated)})`,
                    'success'
                );
                onRollbackComplete();
                fetchSnapshots(snapshotPage);
            } else {
                showToast(data.error || 'Rollback failed', 'error');
            }
        } catch (err) {
            showToast('Rollback failed', 'error');
        }
        setRollbackLoading(null);
    };

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={18} color="var(--primary)" />
                    {t('dnsHistory')}
                </h3>
                <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={onClose}>
                    {t('cancel') || 'Back'}
                </button>
            </div>
            {snapshotsLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <RefreshCw className="spin" size={20} color="var(--primary)" />
                </div>
            ) : snapshots.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {t('noSnapshots')}
                </p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('snapshotTime')}</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('snapshotUser')}</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('snapshotAction')}</th>
                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {snapshots.map((snap) => (
                                <tr key={snap.key} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                        {new Date(snap.timestamp).toLocaleString()}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', fontWeight: 500 }}>{snap.username}</td>
                                    <td style={{ padding: '0.5rem 0.6rem' }}>
                                        <span className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>{snap.action}</span>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                            onClick={() => handleRollback(snap.key)}
                                            disabled={rollbackLoading === snap.key}
                                        >
                                            {rollbackLoading === snap.key ? <RefreshCw className="spin" size={11} /> : <RefreshCw size={11} />}
                                            {t('rollback')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {snapshotTotalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '0.75rem 0', fontSize: '0.8rem' }}>
                            <button
                                className="btn btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                disabled={snapshotPage <= 1 || snapshotsLoading}
                                onClick={() => { const p = snapshotPage - 1; setSnapshotPage(p); fetchSnapshots(p); }}
                            >
                                {t('prev') || 'Prev'}
                            </button>
                            <span style={{ color: 'var(--text-muted)' }}>
                                {snapshotPage} / {snapshotTotalPages}
                            </span>
                            <button
                                className="btn btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                disabled={snapshotPage >= snapshotTotalPages || snapshotsLoading}
                                onClick={() => { const p = snapshotPage + 1; setSnapshotPage(p); fetchSnapshots(p); }}
                            >
                                {t('next') || 'Next'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DnsHistoryTab;
