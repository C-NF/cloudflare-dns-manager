import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, FileText, Plus, Edit2, Trash2, AlertTriangle, X, Play, Pause, ChevronDown } from 'lucide-react';
import TabSkeleton from './TabSkeleton';

const ACTION_TYPES = [
    { id: 'forwarding_url', label: 'Forwarding URL', fields: ['status_code', 'url'] },
    { id: 'always_use_https', label: 'Always Use HTTPS', fields: [] },
    { id: 'cache_level', label: 'Cache Level', fields: ['select'], options: ['bypass', 'basic', 'simplified', 'aggressive', 'cache_everything'] },
    { id: 'browser_cache_ttl', label: 'Browser Cache TTL', fields: ['number'], unit: 'seconds' },
    { id: 'edge_cache_ttl', label: 'Edge Cache TTL', fields: ['number'], unit: 'seconds' },
    { id: 'ssl', label: 'SSL', fields: ['select'], options: ['off', 'flexible', 'full', 'strict'] },
    { id: 'minify', label: 'Auto Minify', fields: ['minify'] },
    { id: 'disable_security', label: 'Disable Security', fields: [] },
    { id: 'disable_performance', label: 'Disable Performance', fields: [] },
    { id: 'browser_check', label: 'Browser Integrity Check', fields: ['select'], options: ['on', 'off'] },
    { id: 'rocket_loader', label: 'Rocket Loader', fields: ['select'], options: ['on', 'off'] },
    { id: 'email_obfuscation', label: 'Email Obfuscation', fields: ['select'], options: ['on', 'off'] },
    { id: 'security_level', label: 'Security Level', fields: ['select'], options: ['essentially_off', 'low', 'medium', 'high', 'under_attack'] },
];

const FORWARD_STATUS_CODES = [301, 302];

const PageRules = ({ zone, getHeaders, authFetch, t, showToast, openConfirm }) => {
    const af = authFetch || fetch;
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editRule, setEditRule] = useState(null);
    const [saving, setSaving] = useState(false);
    const [togglingRule, setTogglingRule] = useState({});

    // Form state
    const [urlPattern, setUrlPattern] = useState('');
    const [actions, setActions] = useState([]);
    const [ruleStatus, setRuleStatus] = useState('active');

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await af(`/api/zones/${zone.id}/pagerules`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setRules(data.rules || []);
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
        setUrlPattern(`*${zone.name}/*`);
        setActions([{ id: 'always_use_https', value: null }]);
        setRuleStatus('active');
        setShowModal(true);
    };

    const openEdit = (rule) => {
        setEditRule(rule);
        setUrlPattern(rule.targets?.[0]?.constraint?.value || '');
        setActions(rule.actions.map(a => {
            if (a.id === 'forwarding_url') return { id: a.id, value: a.value };
            if (a.id === 'minify') return { id: a.id, value: a.value };
            return { id: a.id, value: a.value ?? null };
        }));
        setRuleStatus(rule.status || 'active');
        setShowModal(true);
    };

    const addAction = () => {
        const usedIds = actions.map(a => a.id);
        const available = ACTION_TYPES.find(at => !usedIds.includes(at.id));
        if (available) {
            let defaultVal = null;
            if (available.fields.includes('select')) defaultVal = available.options[0];
            if (available.id === 'forwarding_url') defaultVal = { status_code: 301, url: '' };
            if (available.id === 'minify') defaultVal = { js: 'off', css: 'off', html: 'off' };
            if (available.fields.includes('number')) defaultVal = 3600;
            setActions([...actions, { id: available.id, value: defaultVal }]);
        }
    };

    const removeAction = (idx) => setActions(actions.filter((_, i) => i !== idx));

    const updateAction = (idx, field, val) => {
        setActions(actions.map((a, i) => {
            if (i !== idx) return a;
            if (field === 'id') {
                const meta = ACTION_TYPES.find(at => at.id === val);
                let defaultVal = null;
                if (meta?.fields.includes('select')) defaultVal = meta.options[0];
                if (val === 'forwarding_url') defaultVal = { status_code: 301, url: '' };
                if (val === 'minify') defaultVal = { js: 'off', css: 'off', html: 'off' };
                if (meta?.fields.includes('number')) defaultVal = 3600;
                return { id: val, value: defaultVal };
            }
            return { ...a, value: val };
        }));
    };

    const handleSave = async () => {
        if (!urlPattern.trim()) { showToast('URL pattern is required', 'error'); return; }
        if (actions.length === 0) { showToast('At least one action is required', 'error'); return; }
        setSaving(true);
        try {
            const payload = {
                action: editRule ? 'update' : 'create',
                targets: [{ target: 'url', constraint: { operator: 'matches', value: urlPattern.trim() } }],
                actions: actions.map(a => {
                    if (a.value === null || a.value === undefined) return { id: a.id };
                    return { id: a.id, value: a.value };
                }),
                status: ruleStatus,
            };
            if (editRule) payload.ruleId = editRule.id;
            const res = await af(`/api/zones/${zone.id}/pagerules`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast(t('prSaved'));
                setShowModal(false);
                fetchRules();
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setSaving(false);
    };

    const handleDelete = (rule) => {
        openConfirm(t('prDeleteConfirm'), async () => {
            try {
                const res = await af(`/api/zones/${zone.id}/pagerules`, {
                    method: 'POST', headers: getHeaders(true),
                    body: JSON.stringify({ action: 'delete', ruleId: rule.id })
                });
                const data = await res.json();
                if (data.success) { showToast(t('prDeleted')); fetchRules(); }
                else showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            } catch (e) { showToast(t('errorOccurred'), 'error'); }
        });
    };

    const handleToggle = async (rule) => {
        const newStatus = rule.status === 'active' ? 'disabled' : 'active';
        setTogglingRule(prev => ({ ...prev, [rule.id]: true }));
        try {
            const res = await af(`/api/zones/${zone.id}/pagerules`, {
                method: 'POST', headers: getHeaders(true),
                body: JSON.stringify({ action: 'toggle', ruleId: rule.id, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                setRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: newStatus } : r));
                showToast(t('updateSuccess'));
            } else showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
        } catch (e) { showToast(t('errorOccurred'), 'error'); }
        setTogglingRule(prev => ({ ...prev, [rule.id]: false }));
    };

    const formatActionLabel = (action) => {
        const meta = ACTION_TYPES.find(at => at.id === action.id);
        const label = meta?.label || action.id;
        if (action.id === 'forwarding_url') return `${label}: ${action.value?.status_code} → ${action.value?.url || ''}`;
        if (action.id === 'minify') return `${label}: JS=${action.value?.js} CSS=${action.value?.css} HTML=${action.value?.html}`;
        if (action.value !== null && action.value !== undefined) return `${label}: ${action.value}`;
        return label;
    };

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
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('prTitle')}</h3>
                    <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{rules.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" onClick={fetchRules} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }}>
                        <RefreshCw size={12} className={loading ? 'spin' : ''} />
                    </button>
                    <button className="btn" onClick={openAdd}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '8px' }}>
                        <Plus size={14} /> {t('prAddRule')}
                    </button>
                </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-1rem 0 0 0', lineHeight: 1.5 }}>{t('prDesc')}</p>

            {/* Rules list */}
            {rules.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <FileText size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('prNoRules')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {rules.map((rule, idx) => (
                        <div key={rule.id} className="glass-card" style={{ padding: '1rem', background: rule.status === 'active' ? 'var(--subtle-bg)' : 'transparent', opacity: rule.status === 'active' ? 1 : 0.7 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                        <span className="badge" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>#{idx + 1}</span>
                                        <code style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)', wordBreak: 'break-all' }}>
                                            {rule.targets?.[0]?.constraint?.value || 'N/A'}
                                        </code>
                                        <span className={`badge ${rule.status === 'active' ? 'badge-green' : 'badge-orange'}`} style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                                            {rule.status === 'active' ? t('prActive') : t('prPaused')}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                        {rule.actions.map((action, ai) => (
                                            <span key={ai} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--select-active-bg)', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                                                {formatActionLabel(action)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                    <button className="btn btn-outline" onClick={() => handleToggle(rule)} disabled={togglingRule[rule.id]} style={{ padding: '0.35rem', borderRadius: '6px' }} title={rule.status === 'active' ? 'Pause' : 'Enable'}>
                                        {togglingRule[rule.id] ? <RefreshCw size={14} className="spin" /> : rule.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                                    </button>
                                    <button className="btn btn-outline" onClick={() => openEdit(rule)} style={{ padding: '0.35rem', borderRadius: '6px' }} title="Edit"><Edit2 size={14} /></button>
                                    <button className="btn btn-outline" onClick={() => handleDelete(rule)} style={{ padding: '0.35rem', borderRadius: '6px', color: 'var(--error)' }} title="Delete"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="glass-card modal-content" onClick={e => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '560px', padding: '1.5rem', margin: '2rem auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <FileText size={18} color="var(--primary)" />
                                {editRule ? t('prEditRule') || 'Edit Page Rule' : t('prAddRule')}
                            </h3>
                            <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} color="var(--text-muted)" /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* URL Pattern */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('prUrlPattern')}</label>
                                <input value={urlPattern} onChange={e => setUrlPattern(e.target.value)}
                                    placeholder={t('prUrlPlaceholder') || '*example.com/path/*'}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                            </div>

                            {/* Status toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{t('status') || 'Status'}:</label>
                                <button onClick={() => setRuleStatus(ruleStatus === 'active' ? 'disabled' : 'active')}
                                    className={`badge ${ruleStatus === 'active' ? 'badge-green' : 'badge-orange'}`}
                                    style={{ cursor: 'pointer', fontSize: '0.7rem', padding: '2px 8px', border: 'none' }}>
                                    {ruleStatus === 'active' ? t('prActive') : t('prPaused')}
                                </button>
                            </div>

                            {/* Actions */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>{t('prActions')}</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {actions.map((action, idx) => {
                                        const meta = ACTION_TYPES.find(at => at.id === action.id);
                                        const usedIds = actions.map(a => a.id);
                                        return (
                                            <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)' }}>
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                    <select value={action.id} onChange={e => updateAction(idx, 'id', e.target.value)}
                                                        style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}>
                                                        {ACTION_TYPES.filter(at => at.id === action.id || !usedIds.includes(at.id)).map(at => (
                                                            <option key={at.id} value={at.id}>{at.label}</option>
                                                        ))}
                                                    </select>

                                                    {/* Value inputs based on action type */}
                                                    {action.id === 'forwarding_url' && (
                                                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                                            <select value={action.value?.status_code || 301}
                                                                onChange={e => updateAction(idx, 'value', { ...action.value, status_code: parseInt(e.target.value) })}
                                                                style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}>
                                                                {FORWARD_STATUS_CODES.map(c => <option key={c} value={c}>{c} {c === 301 ? '(Permanent)' : '(Temporary)'}</option>)}
                                                            </select>
                                                            <input value={action.value?.url || ''} placeholder="https://example.com/$1"
                                                                onChange={e => updateAction(idx, 'value', { ...action.value, url: e.target.value })}
                                                                style={{ flex: 1, minWidth: '150px', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontFamily: 'monospace' }} />
                                                        </div>
                                                    )}
                                                    {meta?.fields.includes('select') && (
                                                        <select value={action.value || meta.options[0]}
                                                            onChange={e => updateAction(idx, 'value', e.target.value)}
                                                            style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }}>
                                                            {meta.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                                                        </select>
                                                    )}
                                                    {meta?.fields.includes('number') && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <input type="number" value={action.value || 0}
                                                                onChange={e => updateAction(idx, 'value', parseInt(e.target.value) || 0)}
                                                                style={{ width: '100px', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)' }} />
                                                            {meta.unit && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{meta.unit}</span>}
                                                        </div>
                                                    )}
                                                    {action.id === 'minify' && (
                                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                            {['js', 'css', 'html'].map(f => (
                                                                <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                                                                    <input type="checkbox" checked={action.value?.[f] === 'on'}
                                                                        onChange={() => updateAction(idx, 'value', { ...action.value, [f]: action.value?.[f] === 'on' ? 'off' : 'on' })} />
                                                                    {f.toUpperCase()}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => removeAction(idx)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex', flexShrink: 0 }}>
                                                    <X size={14} color="var(--error)" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                {actions.length < ACTION_TYPES.length && (
                                    <button onClick={addAction} className="btn btn-outline" style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Plus size={12} /> {t('prAddAction')}
                                    </button>
                                )}
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

export default PageRules;
