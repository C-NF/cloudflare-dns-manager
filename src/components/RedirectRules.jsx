import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowRightLeft, AlertTriangle, ExternalLink } from 'lucide-react';

const RedirectRules = ({ zone, getHeaders, t, showToast }) => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [togglingRule, setTogglingRule] = useState({});

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`/api/zones/${zone.id}/rules`, { headers: getHeaders() });
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

    const handleToggleRule = async (ruleIdx, enabled) => {
        setTogglingRule(prev => ({ ...prev, [ruleIdx]: true }));
        try {
            const res = await fetch(`/api/zones/${zone.id}/rules`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ action: 'toggle_rule', ruleIndex: ruleIdx, enabled })
            });
            const data = await res.json();
            if (data.success) {
                setRules(prev => prev.map((r, i) => i === ruleIdx ? { ...r, enabled } : r));
                showToast(t('updateSuccess'));
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setTogglingRule(prev => ({ ...prev, [ruleIdx]: false }));
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
        return <div style={{ padding: '2rem', textAlign: 'center' }}><RefreshCw size={20} className="spin" /></div>;
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ArrowRightLeft size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('rlTitle')}</h3>
                    <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{rules.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" onClick={fetchRules} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }}>
                        <RefreshCw size={12} className={loading ? 'spin' : ''} />
                    </button>
                    <a href={`https://dash.cloudflare.com/${zone.account?.id || ''}/${zone.name}/rules`}
                        target="_blank" rel="noopener noreferrer" className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 10px', textDecoration: 'none' }}>
                        <ExternalLink size={12} /> {t('rlManageInDashboard')}
                    </a>
                </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-1rem 0 0 0', lineHeight: 1.5 }}>{t('rlDesc')}</p>

            {/* Info card */}
            <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {t('rlInfoCard') || 'Redirect rules are part of Cloudflare\'s Ruleset Engine. Complex rule creation and editing is available in the Cloudflare Dashboard. You can enable/disable existing rules here.'}
            </div>

            {/* Rules list */}
            {rules.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <ArrowRightLeft size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('rlNoRules')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {rules.map((rule, idx) => (
                        <div key={rule.id || idx} className="glass-card" style={{ padding: '0.75rem 1rem', background: rule.enabled !== false ? 'var(--subtle-bg)' : 'transparent', opacity: rule.enabled !== false ? 1 : 0.7 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{rule.description || `Rule #${idx + 1}`}</span>
                                        {rule.action === 'redirect' && rule.action_parameters && (
                                            <span className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                                                {rule.action_parameters.from_value?.status_code || 302}
                                            </span>
                                        )}
                                    </div>
                                    {rule.expression && (
                                        <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all', display: 'block', marginBottom: '4px' }}>{rule.expression}</code>
                                    )}
                                    {rule.action === 'redirect' && rule.action_parameters?.from_value?.target_url && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>
                                            → {rule.action_parameters.from_value.target_url.value || rule.action_parameters.from_value.target_url.expression || ''}
                                        </div>
                                    )}
                                </div>
                                <ToggleSwitch
                                    checked={rule.enabled !== false}
                                    onChange={() => handleToggleRule(idx, rule.enabled === false)}
                                    disabled={togglingRule[idx]}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RedirectRules;
