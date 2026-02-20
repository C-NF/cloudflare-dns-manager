import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Repeat, AlertTriangle, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import TabSkeleton from './TabSkeleton';

const TransformRules = ({ zone, getHeaders, t, showToast }) => {
    const [urlRewriteRules, setUrlRewriteRules] = useState([]);
    const [headerModRules, setHeaderModRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [togglingRule, setTogglingRule] = useState({});
    const [showUrlRewrite, setShowUrlRewrite] = useState(true);
    const [showHeaderMod, setShowHeaderMod] = useState(true);

    const fetchRules = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`/api/zones/${zone.id}/transform-rules`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setUrlRewriteRules(data.url_rewrite_rules || []);
                setHeaderModRules(data.header_mod_rules || []);
            } else {
                setFetchError(data.errors?.[0]?.message || data.error || t('errorOccurred'));
            }
        } catch (e) {
            setFetchError(t('errorOccurred'));
        }
        setLoading(false);
    }, [zone.id]);

    useEffect(() => { fetchRules(); }, [fetchRules]);

    const handleToggleRule = async (phase, ruleIdx, enabled) => {
        const key = `${phase}_${ruleIdx}`;
        setTogglingRule(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch(`/api/zones/${zone.id}/transform-rules`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ action: 'toggle_rule', phase, ruleIndex: ruleIdx, enabled })
            });
            const data = await res.json();
            if (data.success) {
                if (phase === 'url_rewrite') {
                    setUrlRewriteRules(prev => prev.map((r, i) => i === ruleIdx ? { ...r, enabled } : r));
                } else {
                    setHeaderModRules(prev => prev.map((r, i) => i === ruleIdx ? { ...r, enabled } : r));
                }
                showToast(t('updateSuccess'));
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setTogglingRule(prev => ({ ...prev, [key]: false }));
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

    const RuleList = ({ rules, phase, title, show, setShow }) => (
        <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
            <button className="unstyled" onClick={() => setShow(!show)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', padding: '0.25rem 0', background: 'transparent', border: 'none', width: '100%' }}>
                {show ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {title}
                <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px', marginLeft: '4px' }}>{rules.length}</span>
            </button>
            {show && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {rules.length === 0 ? (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>{t('trNoRules') || 'No rules configured.'}</p>
                    ) : rules.map((rule, idx) => (
                        <div key={rule.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: rule.enabled !== false ? 'var(--input-bg)' : 'transparent', opacity: rule.enabled !== false ? 1 : 0.7 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{rule.description || `Rule #${idx + 1}`}</span>
                                    {rule.action && <span className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '1px 6px', textTransform: 'uppercase' }}>{rule.action}</span>}
                                </div>
                                {rule.expression && <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all', display: 'block' }}>{rule.expression}</code>}
                            </div>
                            <ToggleSwitch
                                checked={rule.enabled !== false}
                                onChange={() => handleToggleRule(phase, idx, rule.enabled === false)}
                                disabled={togglingRule[`${phase}_${idx}`]}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    if (loading && urlRewriteRules.length === 0 && headerModRules.length === 0 && !fetchError) {
        return <TabSkeleton variant="list" />;
    }

    if (fetchError && urlRewriteRules.length === 0 && headerModRules.length === 0) {
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
                    <Repeat size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('trTitle')}</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" onClick={fetchRules} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }}>
                        <RefreshCw size={12} className={loading ? 'spin' : ''} />
                    </button>
                    <a href={`https://dash.cloudflare.com/${zone.account?.id || ''}/${zone.name}/rules/transform-rules`}
                        target="_blank" rel="noopener noreferrer" className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 10px', textDecoration: 'none' }}>
                        <ExternalLink size={12} /> {t('rlManageInDashboard')}
                    </a>
                </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-1rem 0 0 0', lineHeight: 1.5 }}>{t('trDesc')}</p>

            <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {t('trInfoCard') || 'Transform rules modify requests and responses. Complex rule editing is available in the Cloudflare Dashboard. You can enable/disable existing rules here.'}
            </div>

            <RuleList rules={urlRewriteRules} phase="url_rewrite" title={t('trUrlRewrite') || 'URL Rewrite Rules'} show={showUrlRewrite} setShow={setShowUrlRewrite} />
            <RuleList rules={headerModRules} phase="header_mod" title={t('trHeaderMod') || 'Header Modification Rules'} show={showHeaderMod} setShow={setShowHeaderMod} />
        </div>
    );
};

export default TransformRules;
