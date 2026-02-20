import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Trash2, RefreshCw, X, AlertCircle, Plus, CheckCircle, HelpCircle } from 'lucide-react';
import { ApiClient, ApiError } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];
const MONITOR_TYPES = [
    { value: 'dns_record', label: 'DNS Record' },
    { value: 'traffic_spike', label: 'Traffic Spike' },
    { value: 'error_rate', label: 'Error Rate' },
    { value: 'ssl_expiry', label: 'SSL Expiry' },
];

const StatusBadge = ({ status }) => {
    const colors = {
        ok: { bg: 'var(--success)', text: '#fff', label: 'OK' },
        fail: { bg: 'var(--error)', text: '#fff', label: 'FAIL' },
        unknown: { bg: 'var(--text-muted)', text: '#fff', label: '?' }
    };
    const c = colors[status] || colors.unknown;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px',
            borderRadius: '10px', background: c.bg, color: c.text,
            lineHeight: 1.4, letterSpacing: '0.03em', minWidth: '36px', textAlign: 'center'
        }}>
            {c.label}
        </span>
    );
};

const TypeBadge = ({ type }) => {
    const meta = MONITOR_TYPES.find(m => m.value === type) || { label: type || 'DNS' };
    const colors = {
        dns_record: { bg: 'var(--badge-blue-bg)', text: 'var(--badge-blue-text)' },
        traffic_spike: { bg: 'var(--badge-orange-bg)', text: 'var(--badge-orange-text)' },
        error_rate: { bg: 'var(--error-bg)', text: 'var(--error)' },
        ssl_expiry: { bg: 'var(--badge-green-bg)', text: 'var(--badge-green-text)' },
    };
    const c = colors[type] || colors.dns_record;
    return (
        <span style={{
            display: 'inline-flex', fontSize: '0.6rem', fontWeight: 600,
            padding: '1px 6px', borderRadius: '4px',
            background: c.bg, color: c.text
        }}>
            {meta.label}
        </span>
    );
};

const MonitorsModal = ({ show, onClose, zones }) => {
    const { auth } = useAuth();
    const { showToast } = useToast();
    const { t } = useTheme();
    const [monitors, setMonitors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formMonitorType, setFormMonitorType] = useState('dns_record');
    const [formZoneId, setFormZoneId] = useState('');
    const [formRecordType, setFormRecordType] = useState('A');
    const [formRecordName, setFormRecordName] = useState('');
    const [formExpectedContent, setFormExpectedContent] = useState('');
    const [formThreshold, setFormThreshold] = useState('10000');
    const [formTimeWindow, setFormTimeWindow] = useState('1h');
    const [formStatusType, setFormStatusType] = useState('5xx');
    const [formDaysBeforeExpiry, setFormDaysBeforeExpiry] = useState('30');
    const [formSubmitting, setFormSubmitting] = useState(false);

    const authRef = useRef(auth);
    authRef.current = auth;

    const apiRef = useRef(null);
    if (!apiRef.current) {
        apiRef.current = new ApiClient(() => authRef.current);
    }

    const fetchMonitors = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiRef.current.get('/api/monitors');
            setMonitors(data.monitors || []);
        } catch (err) {
            if (err instanceof ApiError) {
                console.error(`Failed to fetch monitors (${err.status}):`, err.message);
            } else {
                console.error('Failed to fetch monitors:', err);
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (show) {
            fetchMonitors();
        }
    }, [show, fetchMonitors]);

    useEffect(() => {
        if (!show) return;
        const interval = setInterval(() => {
            fetchMonitors();
        }, 60000);
        return () => clearInterval(interval);
    }, [show, fetchMonitors]);

    const handleDelete = async (id) => {
        try {
            await apiRef.current.del(`/api/monitors?id=${id}`);
            showToast(t('monitorDeleted'));
            setMonitors(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            if (err instanceof ApiError) {
                showToast(err.message || t('errorOccurred'), 'error');
            } else {
                showToast(t('errorOccurred'), 'error');
            }
        }
    };

    const resetForm = () => {
        setFormMonitorType('dns_record');
        setFormZoneId('');
        setFormRecordType('A');
        setFormRecordName('');
        setFormExpectedContent('');
        setFormThreshold('10000');
        setFormTimeWindow('1h');
        setFormStatusType('5xx');
        setFormDaysBeforeExpiry('30');
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!formZoneId) return;

        const selectedZone = (zones || []).find(z => z.id === formZoneId);
        setFormSubmitting(true);
        try {
            const payload = {
                zoneId: formZoneId,
                zoneName: selectedZone?.name || '',
                monitorType: formMonitorType,
            };

            if (formMonitorType === 'dns_record') {
                if (!formRecordName || !formExpectedContent) { setFormSubmitting(false); return; }
                payload.recordType = formRecordType;
                payload.recordName = formRecordName;
                payload.expectedContent = formExpectedContent;
            } else if (formMonitorType === 'traffic_spike') {
                payload.threshold = parseInt(formThreshold) || 10000;
                payload.timeWindow = formTimeWindow;
            } else if (formMonitorType === 'error_rate') {
                payload.threshold = parseInt(formThreshold) || 5;
                payload.statusType = formStatusType;
            } else if (formMonitorType === 'ssl_expiry') {
                payload.daysBeforeExpiry = parseInt(formDaysBeforeExpiry) || 30;
            }

            const data = await apiRef.current.post('/api/monitors', payload);
            showToast(t('monitorAdded'));
            setMonitors(prev => [...prev, data.monitor]);
            setShowForm(false);
            resetForm();
        } catch (err) {
            if (err instanceof ApiError) {
                showToast(err.message || t('errorOccurred'), 'error');
            } else {
                showToast(t('errorOccurred'), 'error');
            }
        }
        setFormSubmitting(false);
    };

    const formatDate = (iso) => {
        if (!iso) return '-';
        try {
            const d = new Date(iso);
            return d.toLocaleString();
        } catch {
            return iso;
        }
    };

    const getMonitorDescription = (monitor) => {
        const mt = monitor.monitorType || 'dns_record';
        if (mt === 'dns_record') {
            return `${monitor.zoneName || monitor.zoneId} — ${t('monitorExpected')}: ${monitor.expectedContent}`;
        }
        if (mt === 'traffic_spike') {
            return `${monitor.zoneName || monitor.zoneId} — ${t('monitorThreshold') || 'Threshold'}: ${monitor.threshold?.toLocaleString()} / ${monitor.timeWindow || '1h'}`;
        }
        if (mt === 'error_rate') {
            return `${monitor.zoneName || monitor.zoneId} — ${monitor.statusType || '5xx'} > ${monitor.threshold}%`;
        }
        if (mt === 'ssl_expiry') {
            return `${monitor.zoneName || monitor.zoneId} — ${t('monitorDaysBefore') || 'Alert'} ${monitor.daysBeforeExpiry || 30} ${t('monitorDaysBeforeUnit') || 'days before expiry'}`;
        }
        return monitor.zoneName || monitor.zoneId;
    };

    const getMonitorTitle = (monitor) => {
        const mt = monitor.monitorType || 'dns_record';
        if (mt === 'dns_record') return `${monitor.recordType} ${monitor.recordName}`;
        if (mt === 'traffic_spike') return t('monitorTrafficSpike') || 'Traffic Spike';
        if (mt === 'error_rate') return t('monitorErrorRate') || 'Error Rate';
        if (mt === 'ssl_expiry') return t('monitorSslExpiry') || 'SSL Expiry';
        return mt;
    };

    const failedCount = monitors.filter(m => m.lastStatus === 'fail').length;

    if (!show) return null;

    return (
        <div
            className="modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="glass-card fade-in modal-content" role="dialog" aria-label={t('monitors')} style={{ padding: '2rem', maxWidth: '620px', width: '90%', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                        <Activity size={20} />
                        {t('monitors')}
                        {failedCount > 0 && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px',
                                borderRadius: '10px', background: 'var(--error)', color: '#fff',
                                marginLeft: '4px'
                            }}>
                                {failedCount}
                            </span>
                        )}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={() => setShowForm(!showForm)}
                            style={{
                                border: 'none', background: 'var(--primary)', color: '#fff',
                                cursor: 'pointer', padding: '5px 10px', display: 'flex',
                                alignItems: 'center', gap: '4px', borderRadius: '6px',
                                fontSize: '0.75rem', fontWeight: 600, transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            <Plus size={14} />
                            {t('monitorAdd')}
                        </button>
                        <button
                            onClick={onClose}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px', display: 'flex' }}
                            aria-label="Close"
                        >
                            <X size={18} color="var(--text-muted)" />
                        </button>
                    </div>
                </div>

                {/* Add Monitor Form */}
                {showForm && (
                    <form onSubmit={handleAdd} style={{
                        padding: '1rem', borderRadius: '8px', background: 'var(--hover-bg)',
                        marginBottom: '1rem', border: '1px solid var(--border)'
                    }}>
                        {/* Monitor Type Selector */}
                        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                            {MONITOR_TYPES.map(mt => (
                                <button key={mt.value} type="button"
                                    className={`btn ${formMonitorType === mt.value ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ padding: '3px 10px', fontSize: '0.7rem', fontWeight: 600 }}
                                    onClick={() => setFormMonitorType(mt.value)}>
                                    {mt.label}
                                </button>
                            ))}
                        </div>

                        {/* Zone selector - always needed */}
                        <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                {t('monitorZone')}
                            </label>
                            <select
                                value={formZoneId}
                                onChange={e => setFormZoneId(e.target.value)}
                                style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
                                required
                            >
                                <option value="">{t('monitorSelectZone')}</option>
                                {(zones || []).map(z => (
                                    <option key={z.id} value={z.id}>{z.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Conditional fields per monitor type */}
                        {formMonitorType === 'dns_record' && (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                            {t('type')}
                                        </label>
                                        <select
                                            value={formRecordType}
                                            onChange={e => setFormRecordType(e.target.value)}
                                            style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
                                            required
                                        >
                                            {RECORD_TYPES.map(rt => (
                                                <option key={rt} value={rt}>{rt}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                            {t('monitorRecordName')}
                                        </label>
                                        <input
                                            type="text"
                                            value={formRecordName}
                                            onChange={e => setFormRecordName(e.target.value)}
                                            placeholder="www.example.com"
                                            style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
                                            required
                                        />
                                    </div>
                                </div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                        {t('monitorExpectedContent')}
                                    </label>
                                    <input
                                        type="text"
                                        value={formExpectedContent}
                                        onChange={e => setFormExpectedContent(e.target.value)}
                                        placeholder="1.2.3.4"
                                        style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {formMonitorType === 'traffic_spike' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                        {t('monitorThreshold') || 'Threshold (requests)'}
                                    </label>
                                    <input type="number" value={formThreshold} onChange={e => setFormThreshold(e.target.value)}
                                        placeholder="10000" min="1"
                                        style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }} required />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                        {t('monitorTimeWindow') || 'Time Window'}
                                    </label>
                                    <select value={formTimeWindow} onChange={e => setFormTimeWindow(e.target.value)}
                                        style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}>
                                        <option value="1h">1 hour</option>
                                        <option value="24h">24 hours</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {formMonitorType === 'error_rate' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                        {t('monitorThreshold') || 'Threshold (%)'}
                                    </label>
                                    <input type="number" value={formThreshold} onChange={e => setFormThreshold(e.target.value)}
                                        placeholder="5" min="1" max="100"
                                        style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }} required />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                        {t('monitorStatusType') || 'Status Type'}
                                    </label>
                                    <select value={formStatusType} onChange={e => setFormStatusType(e.target.value)}
                                        style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }}>
                                        <option value="4xx">4xx</option>
                                        <option value="5xx">5xx</option>
                                        <option value="both">4xx + 5xx</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {formMonitorType === 'ssl_expiry' && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                                    {t('monitorDaysBefore') || 'Days before expiry'}
                                </label>
                                <input type="number" value={formDaysBeforeExpiry} onChange={e => setFormDaysBeforeExpiry(e.target.value)}
                                    placeholder="30" min="1" max="365"
                                    style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px' }} required />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-outline" onClick={() => { setShowForm(false); resetForm(); }} style={{ fontSize: '0.75rem', padding: '5px 12px' }}>
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={formSubmitting || !formZoneId}
                                style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                {formSubmitting ? <RefreshCw className="spin" size={13} /> : <Plus size={13} />}
                                {t('monitorAdd')}
                            </button>
                        </div>
                    </form>
                )}

                {/* Monitors List */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                    </div>
                ) : monitors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        <HelpCircle size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.875rem' }}>{t('monitorNone')}</p>
                        <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{t('monitorNoneHint')}</p>
                    </div>
                ) : (
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {monitors.map(monitor => (
                            <div key={monitor.id} style={{
                                padding: '0.75rem',
                                borderRadius: '8px',
                                background: 'var(--hover-bg)',
                                marginBottom: '0.5rem',
                                border: `1px solid ${monitor.lastStatus === 'fail' ? 'var(--error)' : 'var(--border)'}`,
                                opacity: monitor.enabled ? 1 : 0.6
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                            <StatusBadge status={monitor.lastStatus} />
                                            <TypeBadge type={monitor.monitorType || 'dns_record'} />
                                            {monitor.recordType && (
                                                <span className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                                                    {monitor.recordType}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
                                                {getMonitorTitle(monitor)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                                            {getMonitorDescription(monitor)}
                                        </div>
                                        {monitor.lastCheck && (
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {monitor.lastStatus === 'ok' ? (
                                                    <CheckCircle size={10} color="var(--success)" />
                                                ) : monitor.lastStatus === 'fail' ? (
                                                    <AlertCircle size={10} color="var(--error)" />
                                                ) : null}
                                                {t('monitorLastCheck')}: {formatDate(monitor.lastCheck)}
                                            </div>
                                        )}
                                        {monitor.lastStatus === 'fail' && monitor.lastError && (
                                            <div style={{
                                                fontSize: '0.65rem', color: 'var(--error)',
                                                marginTop: '3px', padding: '3px 6px',
                                                background: 'var(--error-bg)', borderRadius: '4px'
                                            }}>
                                                {monitor.lastError}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(monitor.id)}
                                        style={{
                                            border: 'none', background: 'transparent', cursor: 'pointer',
                                            padding: '4px', display: 'flex', flexShrink: 0,
                                            color: 'var(--text-muted)', transition: 'color 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--error)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                        title={t('monitorDelete')}
                                        aria-label={t('monitorDelete')}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        {t('monitorAutoRefresh')}
                    </span>
                    <button className="btn btn-outline" onClick={onClose} style={{ fontSize: '0.75rem' }}>{t('cancel')}</button>
                </div>
            </div>
        </div>
    );
};

export default MonitorsModal;
