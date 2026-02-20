import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Code, Plus, Edit2, Trash2, AlertTriangle, X } from 'lucide-react';
import TabSkeleton from './TabSkeleton';

const WorkersRoutes = ({ zone, getHeaders, t, showToast, openConfirm }) => {
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editRoute, setEditRoute] = useState(null);
    const [form, setForm] = useState({ pattern: '', script: '' });
    const [saving, setSaving] = useState(false);

    const fetchRoutes = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`/api/zones/${zone.id}/workers-routes`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setRoutes(data.routes || []);
            } else {
                setFetchError(data.errors?.[0]?.message || data.error || t('errorOccurred'));
            }
        } catch (e) {
            setFetchError(t('errorOccurred'));
        }
        setLoading(false);
    }, [zone.id]);

    useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

    const openAdd = () => {
        setEditRoute(null);
        setForm({ pattern: `*${zone.name}/*`, script: '' });
        setShowModal(true);
    };

    const openEdit = (route) => {
        setEditRoute(route);
        setForm({ pattern: route.pattern, script: route.script || '' });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.pattern.trim()) { showToast(t('wrPatternRequired') || 'Pattern is required', 'error'); return; }
        setSaving(true);
        try {
            const action = editRoute ? 'update' : 'create';
            const payload = { action, pattern: form.pattern.trim(), script: form.script.trim() || null };
            if (editRoute) payload.routeId = editRoute.id;
            const res = await fetch(`/api/zones/${zone.id}/workers-routes`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast(t('wrSaved'));
                setShowModal(false);
                fetchRoutes();
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setSaving(false);
    };

    const handleDelete = (route) => {
        openConfirm(
            t('wrDeleteConfirm'),
            async () => {
                try {
                    const res = await fetch(`/api/zones/${zone.id}/workers-routes`, {
                        method: 'POST',
                        headers: getHeaders(true),
                        body: JSON.stringify({ action: 'delete', routeId: route.id })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(t('wrDeleted'));
                        fetchRoutes();
                    } else {
                        showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
                    }
                } catch (e) {
                    showToast(t('errorOccurred'), 'error');
                }
            }
        );
    };

    if (loading && routes.length === 0 && !fetchError) {
        return <TabSkeleton variant="list" />;
    }

    if (fetchError && routes.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.8125rem', color: 'var(--error, #ef4444)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} /><span>{t('loadSettingsError').replace('{error}', fetchError)}</span></div>
                {/auth/i.test(fetchError) && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('tokenPermissionHint')}</span>}
                <button className="btn btn-outline" onClick={fetchRoutes} style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.75rem', marginTop: '4px' }}><RefreshCw size={12} /> {t('refresh') || 'Retry'}</button>
            </div>
        );
    }

    return (
        <div className="tab-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Code size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('wrTitle')}</h3>
                    <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{routes.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" onClick={fetchRoutes} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }}>
                        <RefreshCw size={12} className={loading ? 'spin' : ''} />
                    </button>
                    <button className="btn" onClick={openAdd}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '8px' }}>
                        <Plus size={14} /> {t('wrAddRoute')}
                    </button>
                </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-1rem 0 0 0', lineHeight: 1.5 }}>{t('wrDesc')}</p>

            {/* Routes list */}
            {routes.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <Code size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('wrNoRoutes')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {routes.map(route => (
                        <div key={route.id} className="glass-card" style={{ padding: '0.75rem 1rem', background: 'var(--subtle-bg)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <code style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)', wordBreak: 'break-all' }}>{route.pattern}</code>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {route.script ? <><span style={{ fontWeight: 500 }}>{t('wrWorkerScript')}:</span> {route.script}</> : <span style={{ fontStyle: 'italic' }}>{t('wrNoScript') || 'No script (route disabled)'}</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                <button className="btn btn-outline" onClick={() => openEdit(route)} style={{ padding: '0.35rem', borderRadius: '6px' }} title="Edit"><Edit2 size={14} /></button>
                                <button className="btn btn-outline" onClick={() => handleDelete(route)} style={{ padding: '0.35rem', borderRadius: '6px', color: 'var(--error)' }} title="Delete"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="glass-card modal-content" onClick={e => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', margin: '2rem auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Code size={18} color="var(--primary)" />
                                {editRoute ? t('wrEditRoute') || 'Edit Route' : t('wrAddRoute')}
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} color="var(--text-muted)" /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('wrPattern')}</label>
                                <input value={form.pattern} onChange={e => setForm(p => ({ ...p, pattern: e.target.value }))}
                                    placeholder={t('wrPatternPlaceholder') || '*example.com/path/*'}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('wrScript')}</label>
                                <input value={form.script} onChange={e => setForm(p => ({ ...p, script: e.target.value }))}
                                    placeholder={t('wrScriptPlaceholder') || 'my-worker'}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>{t('wrScriptHint') || 'Leave empty to create a route exclusion'}</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button className="btn btn-outline" onClick={() => setShowModal(false)}>{t('cancel')}</button>
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

export default WorkersRoutes;
