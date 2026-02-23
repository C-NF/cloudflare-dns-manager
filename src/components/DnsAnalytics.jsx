import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, BarChart2, AlertTriangle, Search, Database } from 'lucide-react';
import TabSkeleton from './TabSkeleton';

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

const DnsAnalytics = ({ zone, getHeaders, authFetch, t, showToast }) => {
    const af = authFetch || fetch;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [timeRange, setTimeRange] = useState(-1440);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await af(`/api/zones/${zone.id}/dns-analytics?since=${timeRange}`, { headers: getHeaders() });
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
        return <TabSkeleton variant="analytics" />;
    }

    if (fetchError && !data) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.8125rem', color: 'var(--error, #ef4444)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={16} /><span>{t('loadSettingsError').replace('{error}', fetchError)}</span></div>
                <button className="btn btn-outline" onClick={fetchAnalytics} style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '0.75rem', marginTop: '4px' }}><RefreshCw size={12} /> {t('refresh') || 'Retry'}</button>
            </div>
        );
    }

    // Parse data - CF DNS analytics returns rows with dimensions and metrics
    const rows = data?.rows || [];
    const totals = data?.totals || {};

    // Aggregate by query type
    const queryTypes = {};
    const responseCodes = {};
    rows.forEach(row => {
        const dims = row.dimensions || [];
        const metrics = row.metrics || [];
        const qType = dims[0] || 'OTHER';
        const rCode = dims[1] || 'UNKNOWN';
        const count = metrics[0] || 0;
        queryTypes[qType] = (queryTypes[qType] || 0) + count;
        responseCodes[rCode] = (responseCodes[rCode] || 0) + count;
    });

    const totalQueries = totals[0] || Object.values(queryTypes).reduce((s, v) => s + v, 0);
    const nxdomainCount = responseCodes['NXDOMAIN'] || 0;

    const sortedTypes = Object.entries(queryTypes).sort((a, b) => b[1] - a[1]);
    const maxType = sortedTypes.length > 0 ? sortedTypes[0][1] : 1;

    const sortedCodes = Object.entries(responseCodes).sort((a, b) => b[1] - a[1]);
    const maxCode = sortedCodes.length > 0 ? sortedCodes[0][1] : 1;

    const codeColors = { 'NOERROR': '#22c55e', 'NXDOMAIN': '#f59e0b', 'SERVFAIL': '#ef4444', 'REFUSED': '#8b5cf6' };

    return (
        <div className="tab-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart2 size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('dnsAnTitle') || 'DNS Analytics'}</h3>
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
                    <button className="btn btn-outline" onClick={fetchAnalytics} disabled={loading} style={{ padding: '4px 8px', height: 'auto', fontSize: '0.75rem', marginLeft: '4px' }} aria-label={t('refresh')}>
                        <RefreshCw size={12} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="dns-analytics-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                        <Search size={16} color="#3b82f6" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('dnsAnQueryCount') || 'Total Queries'}</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatNumber(totalQueries)}</div>
                </div>
                <div className="glass-card" style={{ padding: '1rem', background: 'var(--subtle-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                        <Database size={16} color="#f59e0b" />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('dnsAnNxdomain') || 'NXDOMAIN'}</span>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatNumber(nxdomainCount)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {totalQueries > 0 ? ((nxdomainCount / totalQueries) * 100).toFixed(1) : 0}% {t('dnsAnOfTotal') || 'of total'}
                    </div>
                </div>
            </div>

            {/* Query Type Breakdown */}
            {sortedTypes.length > 0 && (
                <div className="glass-card" style={{ padding: '1.25rem', background: 'var(--subtle-bg)' }}>
                    <h4 style={{ fontSize: '0.875rem', margin: '0 0 1rem 0' }}>{t('dnsAnQueryTypes') || 'Query Types'}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {sortedTypes.slice(0, 12).map(([type, count]) => (
                            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, width: '50px', fontFamily: 'monospace' }}>{type}</span>
                                <div style={{ flex: 1, height: '20px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', width: `${(count / maxType) * 100}%`,
                                        background: 'var(--primary)', borderRadius: '4px', opacity: 0.7,
                                        transition: 'width 0.5s ease', minWidth: count > 0 ? '2px' : 0
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, width: '60px', textAlign: 'right' }}>{formatNumber(count)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Response Code Breakdown */}
            {sortedCodes.length > 0 && (
                <div className="glass-card" style={{ padding: '1.25rem', background: 'var(--subtle-bg)' }}>
                    <h4 style={{ fontSize: '0.875rem', margin: '0 0 1rem 0' }}>{t('dnsAnResponseCodes') || 'Response Codes'}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {sortedCodes.map(([code, count]) => (
                            <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, width: '80px', color: codeColors[code] || 'var(--text)' }}>{code}</span>
                                <div style={{ flex: 1, height: '20px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', width: `${(count / maxCode) * 100}%`,
                                        background: codeColors[code] || 'var(--primary)', borderRadius: '4px',
                                        transition: 'width 0.5s ease', minWidth: count > 0 ? '2px' : 0
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, width: '60px', textAlign: 'right' }}>{formatNumber(count)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {sortedTypes.length === 0 && sortedCodes.length === 0 && !loading && (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <BarChart2 size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('dnsAnNoData') || 'No DNS analytics data available for this time range.'}</p>
                </div>
            )}
        </div>
    );
};

export default DnsAnalytics;
