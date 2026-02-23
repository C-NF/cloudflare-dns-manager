import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileWarning, AlertTriangle, ExternalLink, Edit2, X } from 'lucide-react';
import TabSkeleton from './TabSkeleton';

const CustomPages = ({ zone, getHeaders, authFetch, t, showToast }) => {
    const af = authFetch || fetch;
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [editPage, setEditPage] = useState(null);
    const [editUrl, setEditUrl] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchPages = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await af(`/api/zones/${zone.id}/custom-pages`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setPages(data.pages || []);
            } else {
                setFetchError(data.errors?.[0]?.message || data.error || t('errorOccurred'));
            }
        } catch (e) {
            setFetchError(t('errorOccurred'));
        }
        setLoading(false);
    }, [zone.id]);

    useEffect(() => { fetchPages(); }, [fetchPages]);

    const handleEdit = (page) => {
        setEditPage(page);
        setEditUrl(page.url || '');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await af(`/api/zones/${zone.id}/custom-pages`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ action: 'update', pageId: editPage.id, url: editUrl.trim(), state: editUrl.trim() ? 'customized' : 'default' })
            });
            const data = await res.json();
            if (data.success) {
                showToast(t('updateSuccess'));
                setEditPage(null);
                fetchPages();
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setSaving(false);
    };

    const PAGE_LABELS = {
        'basic_challenge': 'Basic Challenge',
        'waf_challenge': 'WAF Challenge',
        'waf_block': 'WAF Block',
        'ratelimit_block': 'Rate Limit Block',
        'country_challenge': 'Country Challenge',
        'ip_block': 'IP Block',
        'under_attack': 'Under Attack Mode',
        'managed_challenge': 'Managed Challenge',
        '500_errors': '500 Errors',
        '1000_errors': '1000 Errors',
        'always_online': 'Always Online',
    };

    if (loading && pages.length === 0 && !fetchError) {
        return <TabSkeleton variant="list" />;
    }

    if (fetchError && pages.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.8125rem', color: 'var(--error, #ef4444)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} /><span>{t('loadSettingsError').replace('{error}', fetchError)}</span></div>
                <button className="btn btn-outline" onClick={fetchPages} style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.75rem', marginTop: '4px' }}><RefreshCw size={12} /> {t('refresh') || 'Retry'}</button>
            </div>
        );
    }

    return (
        <div className="tab-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileWarning size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('cpTitle')}</h3>
                </div>
                <button className="btn btn-outline" onClick={fetchPages} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }}>
                    <RefreshCw size={12} className={loading ? 'spin' : ''} />
                </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-1rem 0 0 0', lineHeight: 1.5 }}>{t('cpDesc')}</p>

            {pages.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <FileWarning size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('cpNoPages') || 'No custom pages available.'}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {pages.map(page => (
                        <div key={page.id} className="glass-card" style={{ padding: '0.75rem 1rem', background: 'var(--subtle-bg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{PAGE_LABELS[page.id] || page.id}</span>
                                        <span className={`badge ${page.state === 'customized' ? 'badge-green' : ''}`} style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                                            {page.state === 'customized' ? 'Custom' : 'Default'}
                                        </span>
                                    </div>
                                    {page.url && (
                                        <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{page.url}</code>
                                    )}
                                </div>
                                <button className="btn btn-outline" onClick={() => handleEdit(page)} style={{ padding: '0.35rem', borderRadius: '6px' }} title="Edit"><Edit2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editPage && (
                <div className="modal-overlay" onClick={() => setEditPage(null)}>
                    <div className="glass-card modal-content" onClick={e => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', margin: '2rem auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileWarning size={18} color="var(--primary)" />
                                {PAGE_LABELS[editPage.id] || editPage.id}
                            </h3>
                            <button onClick={() => setEditPage(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} color="var(--text-muted)" /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('cpCustomUrl') || 'Custom Page URL'}</label>
                                <input value={editUrl} onChange={e => setEditUrl(e.target.value)}
                                    placeholder="https://example.com/error.html"
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>{t('cpUrlHint') || 'Leave empty to revert to default page.'}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button className="btn btn-outline" onClick={() => setEditPage(null)}>{t('cancel')}</button>
                            <button className="btn" onClick={handleSave} disabled={saving}
                                style={{ background: 'var(--primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {saving && <RefreshCw size={14} className="spin" />}
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomPages;
