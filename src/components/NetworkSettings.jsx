import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Wifi, AlertTriangle } from 'lucide-react';

const SETTINGS_META = [
    { key: 'websockets', type: 'toggle', descKey: 'netWebsocketsDesc' },
    { key: 'ip_geolocation', type: 'toggle', descKey: 'netIpGeoDesc' },
    { key: 'ipv6', type: 'toggle', descKey: 'netIpv6Desc' },
    { key: 'pseudo_ipv4', type: 'select', options: ['off', 'add_header', 'overwrite_header'], descKey: 'netPseudoIpv4Desc' },
    { key: 'opportunistic_onion', type: 'toggle', descKey: 'netOnionDesc' },
    { key: 'http3', type: 'toggle', descKey: 'netHttp3Desc' },
    { key: 'true_client_ip_header', type: 'toggle', descKey: 'netTrueClientIpDesc' },
    { key: 'max_upload', type: 'number', descKey: 'netMaxUploadDesc', suffix: 'MB' },
];

const NetworkSettings = ({ zone, getHeaders, t, showToast }) => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [savingSettings, setSavingSettings] = useState({});

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`/api/zones/${zone.id}/network`, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
            } else {
                setFetchError(data.errors?.[0]?.message || data.error || t('errorOccurred'));
            }
        } catch (e) {
            setFetchError(t('errorOccurred'));
        }
        setLoading(false);
    }, [zone.id]);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const handleToggle = async (key, newValue) => {
        setSavingSettings(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch(`/api/zones/${zone.id}/network`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ action: 'update', setting: key, value: newValue })
            });
            const data = await res.json();
            if (data.success) {
                setSettings(prev => ({ ...prev, [key]: data.result }));
                showToast(t('updateSuccess'));
            } else {
                showToast(data.errors?.[0]?.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setSavingSettings(prev => ({ ...prev, [key]: false }));
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

    const statusDot = (on) => (
        <span style={{
            display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
            background: on ? '#22c55e' : '#9ca3af', marginRight: '6px', flexShrink: 0
        }} />
    );

    if (loading && !settings && !fetchError) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}><RefreshCw size={20} className="spin" /></div>;
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wifi size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('netTitle')}</h3>
                </div>
                <button className="btn btn-outline" onClick={fetchSettings} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem' }}>
                    <RefreshCw size={12} className={loading ? 'spin' : ''} />
                </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '-1rem 0 0 0', lineHeight: 1.5 }}>{t('netDesc')}</p>

            {SETTINGS_META.map(({ key, type, descKey, options, suffix }) => {
                const isSaving = savingSettings[key];
                const value = settings?.[key];

                if (type === 'select') {
                    return (
                        <div key={key} className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {statusDot(value && value !== 'off')}
                                    <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t(`net_${key}`)}</h4>
                                    {isSaving && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                                </div>
                                <select
                                    value={value || 'off'}
                                    onChange={e => handleToggle(key, e.target.value)}
                                    disabled={isSaving}
                                    style={{
                                        padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8125rem',
                                        border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)',
                                        cursor: isSaving ? 'wait' : 'pointer'
                                    }}
                                >
                                    {options.map(opt => <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>)}
                                </select>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t(descKey)}</p>
                        </div>
                    );
                }

                if (type === 'number') {
                    return (
                        <div key={key} className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {statusDot(true)}
                                    <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t(`net_${key}`)}</h4>
                                    {isSaving && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{value}{suffix && ` ${suffix}`}</span>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t(descKey)}</p>
                        </div>
                    );
                }

                // Toggle type
                const on = value === 'on';
                return (
                    <div key={key} className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {statusDot(on)}
                                <h4 style={{ fontSize: '0.875rem', margin: 0 }}>{t(`net_${key}`)}</h4>
                                {isSaving && <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />}
                            </div>
                            <ToggleSwitch checked={on} onChange={() => handleToggle(key, on ? 'off' : 'on')} disabled={isSaving} />
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{t(descKey)}</p>
                    </div>
                );
            })}
        </div>
    );
};

export default NetworkSettings;
