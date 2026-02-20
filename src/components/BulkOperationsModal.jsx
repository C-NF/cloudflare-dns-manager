import React, { useState, useEffect } from 'react';
import { Layers, Globe, CheckCircle, AlertCircle, RefreshCw, X, Settings } from 'lucide-react';
import { getAuthHeaders } from '../utils/auth.ts';

const SETTING_OPTIONS = [
    { value: 'security_level', label: 'Security Level', type: 'select', options: ['essentially_off', 'low', 'medium', 'high', 'under_attack'] },
    { value: 'ssl', label: 'SSL Mode', type: 'select', options: ['off', 'flexible', 'full', 'strict'] },
    { value: 'min_tls_version', label: 'Min TLS Version', type: 'select', options: ['1.0', '1.1', '1.2', '1.3'] },
    { value: 'always_use_https', label: 'Always Use HTTPS', type: 'toggle' },
    { value: 'http3', label: 'HTTP/3', type: 'toggle' },
    { value: 'ipv6', label: 'IPv6', type: 'toggle' },
    { value: 'websockets', label: 'WebSockets', type: 'toggle' },
    { value: 'email_obfuscation', label: 'Email Obfuscation', type: 'toggle' },
    { value: 'server_side_exclude', label: 'Server-Side Excludes', type: 'toggle' },
    { value: 'hotlink_protection', label: 'Hotlink Protection', type: 'toggle' },
    { value: 'browser_check', label: 'Browser Check', type: 'toggle' },
    { value: 'bot_fight_mode', label: 'Bot Fight Mode', type: 'toggle' },
    { value: 'privacy_pass', label: 'Privacy Pass', type: 'toggle' },
];

const BulkOperationsModal = ({ show, onClose, auth, t, showToast, zones }) => {
    const [operation, setOperation] = useState('create');
    const [zoneMode, setZoneMode] = useState('all');
    const [selectedZones, setSelectedZones] = useState([]);
    const [recordType, setRecordType] = useState('TXT');
    const [recordName, setRecordName] = useState('');
    const [recordContent, setRecordContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);

    // Bulk settings state
    const [selectedSetting, setSelectedSetting] = useState('always_use_https');
    const [settingValue, setSettingValue] = useState('on');

    useEffect(() => {
        if (!show) return;
        const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [show, onClose]);

    useEffect(() => {
        const meta = SETTING_OPTIONS.find(s => s.value === selectedSetting);
        if (meta?.type === 'toggle') setSettingValue('on');
        else if (meta?.type === 'select') setSettingValue(meta.options[0]);
    }, [selectedSetting]);

    if (!show) return null;

    const handleClose = () => {
        setResults(null);
        onClose();
    };

    const handleExecute = async () => {
        if (operation === 'create' && (!recordType || !recordName || !recordContent)) return;
        if (operation === 'delete_matching' && !recordType && !recordName && !recordContent) return;
        setLoading(true);
        setResults(null);
        try {
            if (operation === 'apply_setting') {
                const body = {
                    zones: zoneMode === 'all' ? 'all' : selectedZones,
                    setting: selectedSetting,
                    value: settingValue
                };
                const res = await fetch('/api/bulk_settings', {
                    method: 'POST',
                    headers: getAuthHeaders(auth, true),
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (res.ok) {
                    setResults(data.results || []);
                    showToast(t('bulkSuccess'), 'success');
                } else {
                    showToast(data.error || 'Bulk operation failed', 'error');
                }
            } else {
                const record = {};
                if (recordType) record.type = recordType;
                if (recordName) record.name = recordName;
                if (recordContent) record.content = recordContent;

                const body = {
                    operation,
                    zones: zoneMode === 'all' ? 'all' : selectedZones,
                    record
                };

                const res = await fetch('/api/dns_bulk', {
                    method: 'POST',
                    headers: getAuthHeaders(auth, true),
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (res.ok) {
                    setResults(data.results || []);
                    showToast(t('bulkSuccess'), 'success');
                } else {
                    showToast(data.error || 'Bulk operation failed', 'error');
                }
            }
        } catch (err) {
            console.error('Bulk operation failed:', err);
            showToast('Bulk operation failed', 'error');
        }
        setLoading(false);
    };

    const settingMeta = SETTING_OPTIONS.find(s => s.value === selectedSetting);

    return (
        <div className="modal-overlay" style={{ zIndex: 200 }}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
            <div className="glass-card fade-in modal-content" role="dialog" aria-label={t('bulkOperations')} style={{ width: '100%', maxWidth: '560px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={18} color="var(--primary)" /> {t('bulkOperations')}
                    </h3>
                    <button onClick={handleClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex' }} aria-label="Close">
                        <X size={18} color="var(--text-muted)" />
                    </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('bulkDesc')}</p>

                {results ? (
                    <div className="fade-in" style={{ overflowY: 'auto', flex: 1 }}>
                        <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>{t('bulkResults')}</h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Zone</th>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Count</th>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Errors</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500 }}>{r.zoneName}</td>
                                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                                                {r.success ? <CheckCircle size={14} color="var(--success)" /> : <AlertCircle size={14} color="var(--error)" />}
                                            </td>
                                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>{r.count}</td>
                                            <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.7rem', color: 'var(--error)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {r.errors?.join(', ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button className="btn btn-outline" onClick={() => setResults(null)}>{t('cancel')}</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                            <button className={`btn ${operation === 'create' ? 'btn-primary' : 'btn-outline'}`}
                                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', minWidth: '100px' }}
                                onClick={() => setOperation('create')}>
                                {t('bulkCreate')}
                            </button>
                            <button className={`btn ${operation === 'delete_matching' ? 'btn-primary' : 'btn-outline'}`}
                                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', minWidth: '100px' }}
                                onClick={() => setOperation('delete_matching')}>
                                {t('bulkDelete')}
                            </button>
                            <button className={`btn ${operation === 'apply_setting' ? 'btn-primary' : 'btn-outline'}`}
                                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', minWidth: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                onClick={() => setOperation('apply_setting')}>
                                <Settings size={13} /> {t('bulkApplySetting') || 'Apply Setting'}
                            </button>
                        </div>

                        <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>{t('bulkSelectZones')}</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <button className={`btn ${zoneMode === 'all' ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                                    onClick={() => setZoneMode('all')}>
                                    {t('bulkAllZones')}
                                </button>
                                <button className={`btn ${zoneMode === 'selected' ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                                    onClick={() => setZoneMode('selected')}>
                                    {t('bulkSelectedZones')}
                                </button>
                            </div>
                            {zoneMode === 'selected' && (
                                <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem' }}>
                                    {zones.map(z => (
                                        <label key={z.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', borderRadius: '4px' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <input type="checkbox" checked={selectedZones.includes(z.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedZones([...selectedZones, z.id]);
                                                    else setSelectedZones(selectedZones.filter(id => id !== z.id));
                                                }}
                                                style={{ width: '14px', height: '14px' }} />
                                            <Globe size={12} color="var(--primary)" />
                                            {z.name}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {operation === 'apply_setting' ? (
                            <>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>{t('bulkSettingName') || 'Setting'}</label>
                                    <select value={selectedSetting} onChange={e => setSelectedSetting(e.target.value)}
                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                        {SETTING_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>{t('bulkSettingValue') || 'Value'}</label>
                                    {settingMeta?.type === 'toggle' ? (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button className={`btn ${settingValue === 'on' ? 'btn-primary' : 'btn-outline'}`}
                                                style={{ padding: '4px 16px', fontSize: '0.8rem' }}
                                                onClick={() => setSettingValue('on')}>ON</button>
                                            <button className={`btn ${settingValue === 'off' ? 'btn-primary' : 'btn-outline'}`}
                                                style={{ padding: '4px 16px', fontSize: '0.8rem' }}
                                                onClick={() => setSettingValue('off')}>OFF</button>
                                        </div>
                                    ) : (
                                        <select value={settingValue} onChange={e => setSettingValue(e.target.value)}
                                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                            {settingMeta?.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>{t('bulkRecordType')}</label>
                                        <select value={recordType} onChange={e => setRecordType(e.target.value)}
                                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                            {['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'SRV', 'CAA'].map(type => <option key={type} value={type}>{type}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ flex: 2 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>{t('bulkRecordName')}</label>
                                        <input type="text" value={recordName} onChange={e => setRecordName(e.target.value)}
                                            placeholder={operation === 'create' ? '_dmarc' : `(${t('bulkRecordName')})`}
                                            style={{ width: '100%', fontSize: '0.85rem' }} />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'block' }}>{t('bulkRecordContent')}</label>
                                    <input type="text" value={recordContent} onChange={e => setRecordContent(e.target.value)}
                                        placeholder={operation === 'create' ? 'v=DMARC1; p=reject' : `(${t('bulkRecordContent')})`}
                                        style={{ width: '100%', fontSize: '0.85rem' }} />
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={handleClose}>{t('cancel')}</button>
                            <button className="btn btn-primary" onClick={handleExecute}
                                disabled={loading || (zoneMode === 'selected' && selectedZones.length === 0)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {loading ? <RefreshCw className="spin" size={14} /> : <Layers size={14} />}
                                {loading ? t('bulkExecuting') : t('bulkExecute')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkOperationsModal;
