import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ShieldAlert, Shield, ShieldOff, ShieldCheck, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Plus, Edit2, Trash2, X, Bot } from 'lucide-react';
import TabSkeleton from './TabSkeleton';

const SecuritySettings = ({ zone, getHeaders, authFetch, t, showToast, openConfirm }) => {
    const af = authFetch || fetch;
    const [settings, setSettings] = useState(null);
    const [firewallRules, setFirewallRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [savingSettings, setSavingSettings] = useState({});
    const [showRules, setShowRules] = useState(false);
    const [showFwModal, setShowFwModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [fwForm, setFwForm] = useState({ description: '', expression: '', ruleAction: 'block', priority: 1, paused: false });
    const [fwSaving, setFwSaving] = useState(false);

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await af(`/api/zones/${zone.id}/security`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
                setFirewallRules(data.firewall_rules || []);
            } else {
                setFetchError(data.errors?.[0]?.message || data.error || t('errorOccurred'));
            }
        } catch (e) {
            setFetchError(t('errorOccurred'));
        }
        setLoading(false);
    }, [zone.id]);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const handleUpdate = async (setting, value) => {
        setSavingSettings(prev => ({ ...prev, [setting]: true }));
        try {
            const res = await af(`/api/zones/${zone.id}/security`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ action: 'update', setting, value })
            });
            const data = await res.json();
            if (data.success) {
                setSettings(prev => ({ ...prev, [setting]: data.result }));
                showToast(t('updateSuccess'));
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setSavingSettings(prev => ({ ...prev, [setting]: false }));
    };

    const handleToggleFirewallRule = async (ruleId, paused) => {
        setSavingSettings(prev => ({ ...prev, [`fw_${ruleId}`]: true }));
        try {
            const res = await af(`/api/zones/${zone.id}/security`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ action: 'toggle_firewall_rule', ruleId, paused })
            });
            const data = await res.json();
            if (data.success) {
                setFirewallRules(prev => prev.map(r => r.id === ruleId ? { ...r, paused } : r));
                showToast(t('updateSuccess'));
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setSavingSettings(prev => ({ ...prev, [`fw_${ruleId}`]: false }));
    };

    const openAddRule = () => {
        setEditingRule(null);
        setFwForm({ description: '', expression: '', ruleAction: 'block', priority: 1, paused: false });
        setShowFwModal(true);
    };

    const openEditRule = (rule) => {
        setEditingRule(rule);
        setFwForm({
            description: rule.description || '',
            expression: rule.filter?.expression || '',
            ruleAction: rule.action || 'block',
            priority: rule.priority || 1,
            paused: rule.paused || false,
        });
        setShowFwModal(true);
    };

    const handleFwSave = async () => {
        if (!fwForm.expression.trim()) { showToast(t('secFwExpressionRequired') || 'Filter expression is required', 'error'); return; }
        setFwSaving(true);
        try {
            const payload = editingRule
                ? { action: 'update_firewall_rule', ruleId: editingRule.id, filterId: editingRule.filter?.id, ...fwForm }
                : { action: 'create_firewall_rule', ...fwForm };
            const res = await af(`/api/zones/${zone.id}/security`, {
                method: 'POST', headers: getHeaders(true), body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                showToast(t('secFwSaved') || 'Firewall rule saved');
                setShowFwModal(false);
                fetchSettings();
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) { showToast(t('errorOccurred'), 'error'); }
        setFwSaving(false);
    };

    const handleFwDelete = (rule) => {
        openConfirm(t('secFwDeleteConfirm') || 'Delete this firewall rule?', async () => {
            try {
                const res = await af(`/api/zones/${zone.id}/security`, {
                    method: 'POST', headers: getHeaders(true),
                    body: JSON.stringify({ action: 'delete_firewall_rule', ruleId: rule.id })
                });
                const data = await res.json();
                if (data.success) { showToast(t('secFwDeleted') || 'Firewall rule deleted'); fetchSettings(); }
                else showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            } catch (e) { showToast(t('errorOccurred'), 'error'); }
        });
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

    const securityLevels = [
        { value: 'essentially_off', label: t('secEssentiallyOff'), desc: t('secEssentiallyOffDesc'), color: '#9ca3af', icon: <ShieldOff size={20} color="#9ca3af" /> },
        { value: 'low', label: t('secLow'), desc: t('secLowDesc'), color: '#f59e0b', icon: <Shield size={20} color="#f59e0b" /> },
        { value: 'medium', label: t('secMedium'), desc: t('secMediumDesc'), color: '#3b82f6', icon: <Shield size={20} color="#3b82f6" /> },
        { value: 'high', label: t('secHigh'), desc: t('secHighDesc'), color: '#22c55e', icon: <ShieldCheck size={20} color="#22c55e" /> },
        { value: 'under_attack', label: t('secUnderAttack'), desc: t('secUnderAttackDesc'), color: '#ef4444', icon: <ShieldAlert size={20} color="#ef4444" /> },
    ];

    const challengeTtlOptions = [
        { value: 300, label: '5m' }, { value: 900, label: '15m' }, { value: 1800, label: '30m' },
        { value: 3600, label: '1h' }, { value: 7200, label: '2h' }, { value: 10800, label: '3h' },
        { value: 28800, label: '8h' }, { value: 86400, label: '24h' },
    ];

    const fwActionOptions = [
        { value: 'block', label: 'Block' },
        { value: 'allow', label: 'Allow' },
        { value: 'challenge', label: 'Challenge' },
        { value: 'js_challenge', label: 'JS Challenge' },
        { value: 'managed_challenge', label: 'Managed Challenge' },
        { value: 'log', label: 'Log' },
    ];

    if (loading && !settings && !fetchError) {
        return <TabSkeleton variant="settings" />;
    }

    if (fetchError && !settings) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.8125rem', color: 'var(--error, #ef4444)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} />
                    <span>{t('loadSettingsError').replace('{error}', fetchError)}</span>
                </div>
                {/auth/i.test(fetchError) && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('tokenPermissionHint')}</span>}
                <button className="btn btn-outline" onClick={fetchSettings} style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.75rem', marginTop: '4px' }}>
                    <RefreshCw size={12} /> {t('refresh') || 'Retry'}
                </button>
            </div>
        );
    }

    const updatingSec = savingSettings['security_level'];

    return (
        <div className="tab-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('secTitle')}</h3>
                </div>
                <button className="btn btn-outline" onClick={fetchSettings} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }} aria-label={t('refresh')}>
                    <RefreshCw size={12} className={loading ? 'spin' : ''} />
                </button>
            </div>

            {/* Security Level Selector */}
            <div className="glass-card" style={{ padding: '1.25rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                    <Shield size={16} color="var(--primary)" />
                    <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t('secLevel')}</h4>
                    {updatingSec && <RefreshCw size={12} className="spin" style={{ color: 'var(--primary)' }} />}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>{t('secLevelDesc')}</p>

                <div className="security-level-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {securityLevels.map(level => {
                        const isActive = settings?.security_level === level.value;
                        return (
                            <button key={level.value} onClick={() => !updatingSec && handleUpdate('security_level', level.value)}
                                disabled={updatingSec} className="unstyled"
                                style={{
                                    display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem',
                                    borderRadius: '10px', border: `2px solid ${isActive ? level.color : 'var(--border)'}`,
                                    background: isActive ? `${level.color}11` : 'transparent',
                                    cursor: updatingSec ? 'wait' : 'pointer', transition: 'all 0.2s',
                                    textAlign: 'left', width: '100%', position: 'relative',
                                    opacity: updatingSec && !isActive ? 0.6 : 1,
                                }}>
                                {isActive && <div style={{ position: 'absolute', top: '8px', right: '8px' }}><CheckCircle size={16} color={level.color} /></div>}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {level.icon}
                                    <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: isActive ? level.color : 'var(--text)' }}>{level.label}</span>
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{level.desc}</span>
                            </button>
                        );
                    })}
                </div>

                {settings?.security_level === 'under_attack' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', marginTop: '0.75rem', fontSize: '0.75rem', color: '#ef4444' }}>
                        <AlertTriangle size={14} />
                        <span>{t('secUnderAttackWarning')}</span>
                    </div>
                )}
            </div>

            {/* Bot Fight Mode */}
            <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: settings?.bot_fight_mode === 'on' ? '#22c55e' : '#9ca3af', flexShrink: 0 }} />
                        <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t('secBotFight') || 'Bot Fight Mode'}</h4>
                        {savingSettings['bot_fight_mode'] && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <ToggleSwitch checked={settings?.bot_fight_mode === 'on'} onChange={() => handleUpdate('bot_fight_mode', settings?.bot_fight_mode === 'on' ? 'off' : 'on')} disabled={savingSettings['bot_fight_mode']} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t('secBotFightDesc') || 'Challenge requests matching patterns of known bots before they can access your site.'}</p>
            </div>

            {/* Browser Integrity Check */}
            <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: settings?.browser_check === 'on' ? '#22c55e' : '#9ca3af', flexShrink: 0 }} />
                        <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t('secBrowserCheck')}</h4>
                        {savingSettings['browser_check'] && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <ToggleSwitch checked={settings?.browser_check === 'on'} onChange={() => handleUpdate('browser_check', settings?.browser_check === 'on' ? 'off' : 'on')} disabled={savingSettings['browser_check']} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t('secBrowserCheckDesc')}</p>
            </div>

            {/* Challenge TTL */}
            <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t('secChallengeTtl')}</h4>
                        {savingSettings['challenge_ttl'] && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <select
                        value={settings?.challenge_ttl || 1800}
                        onChange={e => handleUpdate('challenge_ttl', parseInt(e.target.value))}
                        disabled={savingSettings['challenge_ttl']}
                        style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
                    >
                        {challengeTtlOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t('secChallengeTtlDesc')}</p>
            </div>

            {/* Privacy Pass */}
            <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: settings?.privacy_pass === 'on' ? '#22c55e' : '#9ca3af', flexShrink: 0 }} />
                        <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t('secPrivacyPass')}</h4>
                        {savingSettings['privacy_pass'] && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <ToggleSwitch checked={settings?.privacy_pass === 'on'} onChange={() => handleUpdate('privacy_pass', settings?.privacy_pass === 'on' ? 'off' : 'on')} disabled={savingSettings['privacy_pass']} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t('secPrivacyPassDesc')}</p>
            </div>

            {/* Firewall Rules */}
            <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button className="unstyled" onClick={() => setShowRules(!showRules)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', padding: '0.25rem 0', background: 'transparent', border: 'none' }}>
                        {showRules ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        {t('secFirewallRules')}
                        <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px', marginLeft: '4px' }}>{firewallRules.length}</span>
                    </button>
                    {showRules && (
                        <button className="btn" onClick={openAddRule}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '8px' }}>
                            <Plus size={12} /> {t('secFwCreate') || 'Create Rule'}
                        </button>
                    )}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.5rem 0 0 0', lineHeight: 1.5 }}>{t('secFirewallRulesDesc')}</p>

                {showRules && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {firewallRules.length === 0 ? (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>{t('secNoFirewallRules')}</p>
                        ) : firewallRules.map(rule => (
                            <div key={rule.id} className="firewall-rule-card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: rule.paused ? 'transparent' : 'var(--input-bg)' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{rule.description || 'Untitled'}</span>
                                        <span className={`badge ${rule.action === 'block' ? 'badge-orange' : rule.action === 'allow' ? 'badge-green' : 'badge-blue'}`}
                                            style={{ fontSize: '0.6rem', padding: '1px 6px', textTransform: 'uppercase' }}>
                                            {rule.action}
                                        </span>
                                        {rule.paused && <span className="badge" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>PAUSED</span>}
                                    </div>
                                    <code className="firewall-rule-expression" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{rule.filter?.expression || ''}</code>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                    <button className="btn btn-outline" onClick={() => openEditRule(rule)} style={{ padding: '0.35rem', borderRadius: '6px' }} aria-label="Edit"><Edit2 size={14} /></button>
                                    <button className="btn btn-outline" onClick={() => handleFwDelete(rule)} style={{ padding: '0.35rem', borderRadius: '6px', color: 'var(--error)' }} aria-label="Delete"><Trash2 size={14} /></button>
                                    <ToggleSwitch
                                        checked={!rule.paused}
                                        onChange={() => handleToggleFirewallRule(rule.id, !rule.paused)}
                                        disabled={savingSettings[`fw_${rule.id}`]}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Firewall Rule Modal */}
            {showFwModal && (
                <div className="modal-overlay" onClick={() => setShowFwModal(false)}>
                    <div className="glass-card modal-content" onClick={e => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: '520px', padding: '1.5rem', margin: '2rem auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ShieldAlert size={18} color="var(--primary)" />
                                {editingRule ? (t('secFwEdit') || 'Edit Firewall Rule') : (t('secFwCreate') || 'Create Firewall Rule')}
                            </h3>
                            <button onClick={() => setShowFwModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex' }} aria-label="Close"><X size={18} color="var(--text-muted)" /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('secFwDescription') || 'Description'}</label>
                                <input value={fwForm.description} onChange={e => setFwForm(p => ({ ...p, description: e.target.value }))}
                                    placeholder="Block bad bots"
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('secFwExpression') || 'Filter Expression'}</label>
                                <textarea value={fwForm.expression} onChange={e => setFwForm(p => ({ ...p, expression: e.target.value }))}
                                    placeholder='ip.src eq 1.2.3.4 or http.request.uri.path contains "/admin"'
                                    rows={3}
                                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.8125rem', boxSizing: 'border-box', fontFamily: 'monospace', resize: 'vertical' }} />
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>{t('secFwExpressionHint') || 'Uses Cloudflare filter expressions (Wireshark-like syntax).'}</p>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('secFwAction') || 'Action'}</label>
                                    <select value={fwForm.ruleAction} onChange={e => setFwForm(p => ({ ...p, ruleAction: e.target.value }))}
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }}>
                                        {fwActionOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-muted)' }}>{t('secFwPriority') || 'Priority'}</label>
                                    <input type="number" value={fwForm.priority} onChange={e => setFwForm(p => ({ ...p, priority: parseInt(e.target.value) || 1 }))}
                                        min={1}
                                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={fwForm.paused} onChange={e => setFwForm(p => ({ ...p, paused: e.target.checked }))} />
                                {t('secFwStartPaused') || 'Start paused'}
                            </label>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                            <button className="btn btn-outline" onClick={() => setShowFwModal(false)}>{t('cancel')}</button>
                            <button className="btn" onClick={handleFwSave} disabled={fwSaving}
                                style={{ background: 'var(--primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {fwSaving && <RefreshCw size={14} className="spin" />}
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SecuritySettings;
