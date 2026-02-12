import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Globe, AlertTriangle, Shield, CheckCircle, XCircle } from 'lucide-react';

const DnsSettings = ({ zone, getHeaders, t, showToast }) => {
    const [settings, setSettings] = useState(null);
    const [dnssec, setDnssec] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [savingSettings, setSavingSettings] = useState({});

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`/api/zones/${zone.id}/dns-settings`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
                setDnssec(data.dnssec);
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
            const res = await fetch(`/api/zones/${zone.id}/dns-settings`, {
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

    const handleDnssec = async (enable) => {
        setSavingSettings(prev => ({ ...prev, dnssec: true }));
        try {
            const res = await fetch(`/api/zones/${zone.id}/dns-settings`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ action: enable ? 'enable_dnssec' : 'disable_dnssec' })
            });
            const data = await res.json();
            if (data.success) {
                setDnssec(data.dnssec);
                showToast(t('updateSuccess'));
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setSavingSettings(prev => ({ ...prev, dnssec: false }));
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

    if (loading && !settings && !fetchError) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}><RefreshCw size={20} className="spin" /></div>;
    }

    if (fetchError && !settings) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.8125rem', color: 'var(--error, #ef4444)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} /><span>{t('loadSettingsError').replace('{error}', fetchError)}</span></div>
                {/auth/i.test(fetchError) && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('tokenPermissionHint')}</span>}
                <button className="btn btn-outline" onClick={fetchSettings} style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.75rem', marginTop: '4px' }}><RefreshCw size={12} /> {t('refresh') || 'Retry'}</button>
            </div>
        );
    }

    const dnssecStatus = dnssec?.status || 'disabled';
    const isDnssecActive = dnssecStatus === 'active';
    const isDnssecPending = dnssecStatus === 'pending';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Globe size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('dnsSettingsTitle')}</h3>
                </div>
                <button className="btn btn-outline" onClick={fetchSettings} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }}>
                    <RefreshCw size={12} className={loading ? 'spin' : ''} />
                </button>
            </div>

            {/* DNSSEC */}
            <div className="glass-card" style={{ padding: '1.25rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={16} color={isDnssecActive ? '#22c55e' : '#9ca3af'} />
                        <h4 style={{ fontSize: '0.875rem', margin: 0 }}>DNSSEC</h4>
                        {savingSettings.dnssec && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                        <span className={`badge ${isDnssecActive ? 'badge-green' : isDnssecPending ? 'badge-blue' : 'badge-orange'}`} style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                            {isDnssecActive ? 'Active' : isDnssecPending ? 'Pending' : 'Disabled'}
                        </span>
                    </div>
                    <button
                        className="btn"
                        onClick={() => handleDnssec(!isDnssecActive && !isDnssecPending)}
                        disabled={savingSettings.dnssec}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: isDnssecActive || isDnssecPending ? 'var(--error)' : 'var(--primary)',
                            color: 'white', border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.8125rem', borderRadius: '8px'
                        }}
                    >
                        {savingSettings.dnssec ? <RefreshCw size={14} className="spin" /> : isDnssecActive || isDnssecPending ? t('disable') || 'Disable' : t('enable') || 'Enable'}
                    </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t('dnssecDesc')}</p>

                {isDnssecActive && dnssec?.ds && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>DS Record</p>
                        <code style={{ fontSize: '0.7rem', wordBreak: 'break-all', color: 'var(--text)' }}>{dnssec.ds}</code>
                        {dnssec.algorithm && (
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                <span>Algorithm: {dnssec.algorithm}</span>
                                <span>Digest Type: {dnssec.digest_type}</span>
                                <span>Key Tag: {dnssec.key_tag}</span>
                            </div>
                        )}
                    </div>
                )}

                {isDnssecPending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', marginTop: '0.75rem', fontSize: '0.75rem', color: '#3b82f6' }}>
                        <AlertTriangle size={14} />
                        <span>{t('dnssecPending') || 'DNSSEC is pending activation. Add the DS record to your registrar.'}</span>
                    </div>
                )}
            </div>

            {/* CNAME Flattening */}
            <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: settings?.cname_flattening === 'flatten_all' ? '#22c55e' : '#3b82f6', flexShrink: 0 }} />
                        <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t('cnameFlattening')}</h4>
                        {savingSettings.cname_flattening && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                    </div>
                    <select
                        value={settings?.cname_flattening || 'flatten_at_root'}
                        onChange={e => handleUpdate('cname_flattening', e.target.value)}
                        disabled={savingSettings.cname_flattening}
                        style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8125rem', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)' }}
                    >
                        <option value="flatten_at_root">{t('cnameFlattenRoot') || 'Flatten at root'}</option>
                        <option value="flatten_all">{t('cnameFlattenAll') || 'Flatten all CNAMEs'}</option>
                    </select>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t('cnameFlatteningDesc')}</p>
            </div>

            {/* Nameservers (read-only info) */}
            {zone.name_servers && zone.name_servers.length > 0 && (
                <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                    <h4 style={{ fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>{t('nameservers') || 'Nameservers'}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: 1.5 }}>{t('nameserversDesc') || 'Your domain\'s assigned Cloudflare nameservers.'}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {zone.name_servers.map(ns => (
                            <code key={ns} style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem', borderRadius: '6px', background: 'var(--input-bg)', border: '1px solid var(--border)' }}>{ns}</code>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DnsSettings;
