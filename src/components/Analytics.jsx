import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, BarChart2, AlertTriangle, Globe, Shield, Eye, Activity } from 'lucide-react';

const TIME_RANGES = [
    { value: -1440, label: '24h' },
    { value: -10080, label: '7d' },
    { value: -43200, label: '30d' },
];

const formatNumber = (n) => {
    if (n == null) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
};

const formatBytes = (bytes) => {
    if (bytes == null) return '0 B';
    if (bytes >= 1e12) return (bytes / 1e12).toFixed(2) + ' TB';
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
    return bytes + ' B';
};

const Analytics = ({ zone, getHeaders, t, showToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [timeRange, setTimeRange] = useState(-1440);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await fetch(`/api/zones/${zone.id}/analytics?since=${timeRange}`, { headers: getHeaders() });
            const result = await res.json();
            if (result.success) {
                setData(result.data);
            } else {
                setFetchError(result.errors?.[0]?.message || result.error || t('errorOccurred'));
            }
        } catch (e) {
            setFetchError(t('errorOccurred'));
        }
        setLoading(false);
    }, [zone.id, timeRange]);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

    if (loading && !data && !fetchError) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}><RefreshCw size={20} className="spin" /></div>;
    }

    if (fetchError && !data) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.8125rem', color: 'var(--error, #ef4444)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} /><span>{t('loadSettingsError').replace('{error}', fetchError)}</span></div>
                <button className="btn btn-outline" onClick={fetchAnalytics} style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.75rem', marginTop: '4px' }}><RefreshCw size={12} /> {t('refresh') || 'Retry'}</button>
            </div>
        );
    }

    const totals = data?.totals || {};
    const requests = totals.requests || {};
    const bandwidth = totals.bandwidth || {};
    const threats = totals.threats || {};
    const uniques = totals.uniques || {};
    const pageviews = totals.pageviews || {};

    const httpStatus = requests.http_status || {};
    const statusGroups = {
        '2xx': Object.entries(httpStatus).filter(([k]) => k.startsWith('2')).reduce((s, [, v]) => s + v, 0),
        '3xx': Object.entries(httpStatus).filter(([k]) => k.startsWith('3')).reduce((s, [, v]) => s + v, 0),
        '4xx': Object.entries(httpStatus).filter(([k]) => k.startsWith('4')).reduce((s, [, v]) => s + v, 0),
        '5xx': Object.entries(httpStatus).filter(([k]) => k.startsWith('5')).reduce((s, [, v]) => s + v, 0),
    };
    const maxStatus = Math.max(...Object.values(statusGroups), 1);

    const topCountries = Object.entries(threats.country || requests.country || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    const maxCountry = topCountries.length > 0 ? topCountries[0][1] : 1;

    const statusColors = { '2xx': '#22c55e', '3xx': '#3b82f6', '4xx': '#f59e0b', '5xx': '#ef4444' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart2 size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('anTitle')}</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {TIME_RANGES.map(tr => (
                        <button key={tr.value} onClick={() => setTimeRange(tr.value)}
                            className={`btn ${timeRange === tr.value ? '' : 'btn-outline'}`}
                            style={{
                                padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px',
                                ...(timeRange === tr.value ? { background: 'var(--primary)', color: 'white', border: 'none' } : {})
                            }}>
                            {tr.label}
                        </button>
                    ))}
                    <button className="btn btn-outline" onClick={fetchAnalytics} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem', marginLeft: '4px' }}>
                        <RefreshCw size={12} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {/* Total Requests */}
                <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                        <Activity size={16} color="#3b82f6" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('anTotalRequests')}</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatNumber(requests.all)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {t('anCachedRequests')}: {formatNumber(requests.cached)} ({requests.all > 0 ? ((requests.cached / requests.all) * 100).toFixed(1) : 0}%)
                    </div>
                </div>

                {/* Bandwidth */}
                <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                        <Globe size={16} color="#8b5cf6" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('anBandwidth')}</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatBytes(bandwidth.all)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {t('anCachedBandwidth')}: {formatBytes(bandwidth.cached)} ({bandwidth.all > 0 ? ((bandwidth.cached / bandwidth.all) * 100).toFixed(1) : 0}%)
                    </div>
                </div>

                {/* Threats */}
                <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                        <Shield size={16} color="#ef4444" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('anThreats')}</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatNumber(threats.all)}</div>
                </div>

                {/* Unique Visitors */}
                <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                        <Eye size={16} color="#22c55e" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('anVisitors')}</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatNumber(uniques.all)}</div>
                    {pageviews.all > 0 && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Pageviews: {formatNumber(pageviews.all)}</div>}
                </div>
            </div>

            {/* HTTP Status Breakdown */}
            <div className="glass-card" style={{ padding: '1.25rem', background: 'var(--subtle-bg)' }}>
                <h4 style={{ fontSize: '0.875rem', margin: '0 0 1rem 0' }}>{t('anHttpStatus')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(statusGroups).map(([group, count]) => (
                        <div key={group} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, width: '32px', color: statusColors[group] }}>{group}</span>
                            <div style={{ flex: 1, height: '20px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', width: `${(count / maxStatus) * 100}%`,
                                    background: statusColors[group], borderRadius: '4px',
                                    transition: 'width 0.5s ease', minWidth: count > 0 ? '2px' : 0
                                }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, width: '60px', textAlign: 'right' }}>{formatNumber(count)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Countries */}
            {topCountries.length > 0 && (
                <div className="glass-card" style={{ padding: '1.25rem', background: 'var(--subtle-bg)' }}>
                    <h4 style={{ fontSize: '0.875rem', margin: '0 0 1rem 0' }}>{t('anCountries')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {topCountries.map(([country, count]) => (
                            <div key={country} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 500, width: '28px' }}>{country}</span>
                                <div style={{ flex: 1, height: '16px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', width: `${(count / maxCountry) * 100}%`,
                                        background: 'var(--primary)', borderRadius: '4px', opacity: 0.7,
                                        transition: 'width 0.5s ease', minWidth: '2px'
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: '60px', textAlign: 'right' }}>{formatNumber(count)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Analytics;
