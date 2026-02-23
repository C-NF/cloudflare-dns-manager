import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Mail, Plus, Edit2, Trash2, AlertTriangle, X, ExternalLink } from 'lucide-react';
import TabSkeleton from './TabSkeleton';

const EmailRouting = ({ zone, getHeaders, authFetch, t, showToast, openConfirm }) => {
    const af = authFetch || fetch;
    const [rules, setRules] = useState([]);
    const [routingEnabled, setRoutingEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editRule, setEditRule] = useState(null);
    const [form, setForm] = useState({ matchType: 'literal', matchValue: '', forwardTo: '' });
    const [saving, setSaving] = useState(false);
    const [togglingEnabled, setTogglingEnabled] = useState(false);

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await af(`/api/zones/${zone.id}/email-routing`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setRules(data.rules || []);
                setRoutingEnabled(data.enabled || false);
            } else {
                setFetchError(data.errors?.[0]?.message || data.error || t('errorOccurred'));
            }
        } catch (e) {
            setFetchError(t('errorOccurred'));
        }
        setLoading(false);
    }, [zone.id]);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const openAdd = () => {
        setEditRule(null);
        setForm({ matchType: 'literal', matchValue: '', forwardTo: '' });
        setShowModal(true);
    };

    const openEdit = (rule) => {
        setEditRule(rule);
        const matcher = rule.matchers?.[0] || {};
        const action = rule.actions?.[0] || {};
        setForm({
            matchType: matcher.type || 'literal',
            matchValue: matcher.value || '',
            forwardTo: action.value?.[0] || ''
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.forwardTo.trim()) { showToast('Destination email is required', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                action: editRule ? 'update' : 'create',
                matchers: [{ type: form.matchType, ...(form.matchType === 'literal' ? { field: 'to', value: form.matchValue.trim() } : {}) }],
                actions: [{ type: 'forward', value: [form.forwardTo.trim()] }],
                enabled: true,
            };
            if (editRule) payload.ruleId = editRule.tag;
            const res = await af(`/api/zones/${zone.id}/email-routing`, {
                method: 'POST', headers: getHeaders(true), body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) { showToast(t('erSaved') || 'Rule saved'); setShowModal(false); fetchRules(); }
            else showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
        } catch (e) { showToast(t('errorOccurred'), 'error'); }
        setSaving(false);
    };

    const handleDelete = (rule) => {
        openConfirm(t('erDeleteConfirm') || 'Delete this email routing rule?', async () => {
            try {
                const res = await af(`/api/zones/${zone.id}/email-routing`, {
                    method: 'POST', headers: getHeaders(true),
                    body: JSON.stringify({ action: 'delete', ruleId: rule.tag })
                });
                const data = await res.json();
                if (data.success) { showToast(t('erDeleted') || 'Rule deleted'); fetchRules(); }
                else showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            } catch (e) { showToast(t('errorOccurred'), 'error'); }
        });
    };

    const handleToggleRouting = async () => {
        setTogglingEnabled(true);
        try {
            const res = await af(`/api/zones/${zone.id}/email-routing`, {
                method: 'POST', headers: getHeaders(true),
                body: JSON.stringify({ action: routingEnabled ? 'disable_routing' : 'enable_routing' })
            });
            const data = await res.json();
            if (data.success) { setRoutingEnabled(!routingEnabled); showToast(t('updateSuccess')); }
            else showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
        } catch (e) { showToast(t('errorOccurred'), 'error'); }
        setTogglingEnabled(false);
    };

    const ToggleSwitch = ({ checked, onChange, disabled }) => (
        <button role="switch" aria-checked={checked} onClick={onChange} disabled={disabled}
            style={{
                width: '40px', height: '22px', borderRadius: '11px', border: 'none',
                background: checked ? 'var(--primary)' : 'var(--border)',
                cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative',
                transition: 'background 0.2s', flexShrink: 0, opacity: disabled ? 0.6 : 1
            }}>
            <span style={{
                position: 'absolute', top: '2px', left: checked ? '20px' : '2px',
                width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
            }} />
        </button>
    );

    if (loading && rules.length === 0 && !fetchError) {
        return <TabSkeleton variant="list" />;
    }

    if (fetchError && rules.length === 0) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.8125rem', color: 'var(--error, #ef4444)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} /><span>{t('loadSettingsError').replace('{error}', fetchError)}</span></div>
                <button className="btn btn-outline" onClick={fetchRules} style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.75rem', marginTop: '4px' }}><RefreshCw size={12} /> {t('refresh') || 'Retry'}</button>
            </div>
        );
    }

    return (
        <div className="tab-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Mail size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('erTitle')}</h3>
                    <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{rules.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" onClick={fetchRules} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }}>
                        <RefreshCw size={12} className={loading ? 'spin' : ''} />
                    </button>
                    <button className="btn" onClick={openAdd}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '8px' }}>
                        <Plus size={14} /> {t('erAddRule') || 'Add Rule'}
                    </button>
                </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-1rem 0 0 0', lineHeight: 1.5 }}>{t('erDesc')}</p>

            {/* Enable/Disable Email Routing */}
            <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.25rem' }}>
                            <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t('erEnable') || 'Email Routing'}</h4>
                            {togglingEnabled && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                            <span className={`badge ${routingEnabled ? 'badge-green' : 'badge-orange'}`} style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                                {routingEnabled ? 'ON' : 'OFF'}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{t('erEnableDesc') || 'Enable email routing for this zone.'}</p>
                    </div>
                    <ToggleSwitch checked={routingEnabled} onChange={handleToggleRouting} disabled={togglingEnabled} />
                </div>
            </div>

            {/* Rules list */}
            {rules.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <Mail size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('erNoRules') || 'No email routing rules.'}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {rules.map(rule => {
                        const matcher = rule.matchers?.[0] || {};
                        const action = rule.actions?.[0] || {};
                        const isCatchAll = matcher.type === 'all';
                        return (
                            <div key={rule.tag} className="glass-card" style={{ padding: '0.75rem 1rem', background: rule.enabled !== false ? 'var(--subtle-bg)' : 'transparent', opacity: rule.enabled !== false ? 1 : 0.7 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                                            <code style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)' }}>
                                                {isCatchAll ? '*@' + zone.name : matcher.value || 'N/A'}
                                            </code>
                                            {isCatchAll && <span className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>Catch-all</span>}
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→</span>
                                            <span style={{ fontSize: '0.8125rem' }}>{action.value?.[0] || action.type || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                        {!isCatchAll && <button className="btn btn-outline" onClick={() => openEdit(rule)} style={{ padding: '0.35rem', borderRadius: '6px' }} title="Edit"><Edit2 size={14} /></button>}
                                        {!isCatchAll && <button className="btn btn-outline" onClick={() => handleDelete(rule)} style={{ padding: '0.35rem', borderRadius: '6px', color: 'var(--error)' }} title="Delete"><Trash2 size={14} /></button>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="glass-card modal-content" onClick={e => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', margin: '2rem auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Mail size={18} color="var(--primary)" />
                                {editRule ? t('erEditRule') || 'Edit Rule' : t('erAddRule') || 'Add Rule'}
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} color="var(--text-muted)" /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('erMatchType') || 'Match Type'}</label>
                                <select value={form.matchType} onChange={e => setForm(p => ({ ...p, matchType: e.target.value }))}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }}>
                                    <option value="literal">{t('erExactMatch') || 'Exact address'}</option>
                                    <option value="all">{t('erCatchAll') || 'Catch-all'}</option>
                                </select>
                            </div>
                            {form.matchType === 'literal' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('erFromAddress') || 'From Address'}</label>
                                    <input value={form.matchValue} onChange={e => setForm(p => ({ ...p, matchValue: e.target.value }))}
                                        placeholder={`user@${zone.name}`}
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                                </div>
                            )}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('erForwardTo') || 'Forward to'}</label>
                                <input value={form.forwardTo} onChange={e => setForm(p => ({ ...p, forwardTo: e.target.value }))}
                                    placeholder="destination@example.com"
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
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

export default EmailRouting;
