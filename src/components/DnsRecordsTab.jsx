import React, { useState, useRef, useMemo } from 'react';
import { Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

const GROUP_BY_KEY = 'dns_group_by';

const DnsRecordsTab = ({
    zone,
    records,
    setRecords,
    filteredRecords,
    loading,
    searchTerm,
    setSearchTerm,
    selectedRecords,
    setSelectedRecords,
    fetchDNS,
    onOpenAddRecord,
    onOpenEditRecord,
    onOpenBulkImport,
    onShowHistory,
    getHeaders,
    t,
    showToast,
    openConfirm
}) => {
    const [importLoading, setImportLoading] = useState(false);
    const [expandedRecords, setExpandedRecords] = useState(new Set());
    const [groupBy, setGroupBy] = useState(() => localStorage.getItem(GROUP_BY_KEY) || 'none');
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const fileInputRef = useRef(null);

    const handleGroupByChange = (value) => {
        setGroupBy(value);
        localStorage.setItem(GROUP_BY_KEY, value);
        setCollapsedGroups(new Set());
    };

    const toggleGroupCollapse = (groupKey) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    };

    const groupedRecords = useMemo(() => {
        if (groupBy === 'none') return null;

        const groups = new Map();
        for (const record of filteredRecords) {
            let key;
            if (groupBy === 'type') {
                key = record.type;
            } else {
                // Group by subdomain
                const zoneName = zone?.name || '';
                let sub = record.name;
                if (sub === zoneName) {
                    sub = '@';
                } else if (sub.endsWith('.' + zoneName)) {
                    sub = sub.slice(0, -(zoneName.length + 1));
                }
                key = sub;
            }
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(record);
        }

        // Sort groups
        const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        return sorted;
    }, [filteredRecords, groupBy, zone?.name]);

    const toggleExpand = (id) => {
        setExpandedRecords(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const deleteRecord = async (id) => {
        openConfirm(t('confirmTitle'), t('confirmDelete'), async () => {
            const res = await fetch(`/api/zones/${zone.id}/dns_records?id=${id}`, {
                method: 'DELETE',
                headers: getHeaders(true)
            });
            if (res.ok) {
                fetchDNS();
                showToast(t('deleteSuccess'));
            } else {
                const data = await res.json().catch((err) => { console.error('Failed to parse response JSON:', err); return {}; });
                showToast(data.message || t('errorOccurred'), 'error');
            }
        });
    };

    const toggleProxied = async (record) => {
        if (!['A', 'AAAA', 'CNAME'].includes(record.type)) return;

        const originalStatus = record.proxied;
        setRecords(prev => prev.map(r =>
            r.id === record.id ? { ...r, proxied: !originalStatus } : r
        ));

        try {
            const res = await fetch(`/api/zones/${zone.id}/dns_records?id=${record.id}`, {
                method: 'PATCH',
                headers: getHeaders(true),
                body: JSON.stringify({ proxied: !originalStatus })
            });
            const data = await res.json();
            if (!res.ok) {
                setRecords(prev => prev.map(r =>
                    r.id === record.id ? { ...r, proxied: originalStatus } : r
                ));
                const isFallbackError = data.errors?.some(e => e.code === 1040);
                if (isFallbackError) {
                    showToast(t('fallbackError'), 'error');
                } else {
                    showToast(data.errors?.[0]?.message || data.message || t('errorOccurred'), 'error');
                }
            } else {
                showToast(t('updateSuccess'));
            }
        } catch (e) {
            setRecords(prev => prev.map(r =>
                r.id === record.id ? { ...r, proxied: originalStatus } : r
            ));
        }
    };

    const handleExport = async () => {
        try {
            const headers = getHeaders();
            const res = await fetch(`/api/zones/${zone.id}/dns_export`, { headers });
            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dns_records_${zone.name}.txt`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showToast(t('exportSuccess'));
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImportLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('proxied', 'true');

        try {
            const res = await fetch(`/api/zones/${zone.id}/dns_import`, {
                method: 'POST',
                headers: getHeaders(),
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                showToast(t('importSuccess'));
                fetchDNS();
            } else {
                showToast(data.message || t('errorOccurred'), 'error');
            }
        } catch (e) {
            showToast(t('errorOccurred'), 'error');
        }
        setImportLoading(false);
        e.target.value = '';
    };

    const handleBatchDelete = async () => {
        const count = selectedRecords.size;
        if (count === 0) return;
        openConfirm(t('confirmTitle'), t('confirmBatchDelete').replace('{count}', count), async () => {
            try {
                const res = await fetch(`/api/zones/${zone.id}/dns_batch`, {
                    method: 'POST',
                    headers: getHeaders(true),
                    body: JSON.stringify({
                        deletes: Array.from(selectedRecords).map(id => ({ id }))
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(t('deleteSuccess'));
                    setSelectedRecords(new Set());
                    fetchDNS();
                } else {
                    showToast(data.message || t('errorOccurred'), 'error');
                }
            } catch (e) {
                showToast(t('errorOccurred'), 'error');
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectedRecords.size === filteredRecords.length) {
            setSelectedRecords(new Set());
        } else {
            setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
        }
    };

    const toggleSelect = (id) => {
        setSelectedRecords(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const formatGroupLabel = (key, count) => {
        if (groupBy === 'type') {
            return `${key} ${t('dnsRecords')} (${count})`;
        }
        return `${key} (${count})`;
    };

    const renderDesktopRow = (record) => (
        <tr key={record.id}>
            <td>
                <input
                    type="checkbox"
                    checked={selectedRecords.has(record.id)}
                    onChange={() => toggleSelect(record.id)}
                    className="record-checkbox"
                />
            </td>
            <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                    <span className="badge badge-blue">{record.type}</span>
                    {(record.tags || []).map((tag, idx) => (
                        <span key={idx} className="badge badge-green" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{tag}</span>
                    ))}
                </div>
            </td>
            <td>
                <div style={{ fontWeight: 600 }}>{record.name}</div>
                {record.comment && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{record.comment}</div>}
            </td>
            <td className="truncate-mobile" style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{record.content}</td>
            <td style={{ fontSize: '0.8125rem' }}>{record.ttl === 1 ? t('ttlAuto') : record.ttl}</td>
            <td>
                {['A', 'AAAA', 'CNAME'].includes(record.type) ? (
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={record.proxied}
                            onChange={() => toggleProxied(record)}
                        />
                        <span className="slider"></span>
                    </label>
                ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.5 }}>---</span>
                )}
            </td>
            <td>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-outline" style={{ padding: '0.4rem', border: 'none' }} onClick={() => onOpenEditRecord(record)} aria-label={`Edit ${record.name}`}>
                        <Edit2 size={16} color="var(--primary)" />
                    </button>
                    <button className="btn btn-outline" style={{ padding: '0.4rem', border: 'none' }} onClick={() => deleteRecord(record.id)} aria-label={`Delete ${record.name}`}>
                        <Trash2 size={16} color="var(--error)" />
                    </button>
                </div>
            </td>
        </tr>
    );

    const renderMobileCard = (record) => (
        <div key={record.id} className="record-card">
            <div className="record-type-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                <span className="dns-type-label">{record.type}</span>
                {(record.tags || []).map((tag, idx) => (
                    <span key={idx} className="badge badge-green" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>{tag}</span>
                ))}
            </div>
            <div className="record-header" role="button" tabIndex={0} onClick={() => toggleExpand(record.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(record.id); } }} aria-expanded={expandedRecords.has(record.id)}>
                <div className="record-header-main">
                    <div className="dns-selection" onClick={e => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={selectedRecords.has(record.id)}
                            onChange={() => toggleSelect(record.id)}
                            className="record-checkbox"
                        />
                    </div>
                    <div className="dns-name-wrapper">
                        <div className="dns-name">{record.name}</div>
                        {record.comment && <div className="dns-comment">{record.comment}</div>}
                    </div>
                </div>
                <div className="record-actions-inline" onClick={e => e.stopPropagation()}>
                    {['A', 'AAAA', 'CNAME'].includes(record.type) && (
                        <label className="toggle-switch" style={{ transform: 'scale(0.8)', margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={record.proxied}
                                onChange={() => toggleProxied(record)}
                            />
                            <span className="slider"></span>
                        </label>
                    )}
                    <button className="btn btn-outline" style={{ padding: '0.4rem', border: 'none' }} onClick={() => onOpenEditRecord(record)} aria-label={`Edit ${record.name}`}>
                        <Edit2 size={16} color="var(--primary)" />
                    </button>
                    <button className="btn btn-outline" style={{ padding: '0.4rem', border: 'none' }} onClick={() => deleteRecord(record.id)} aria-label={`Delete ${record.name}`}>
                        <Trash2 size={16} color="var(--error)" />
                    </button>
                </div>
            </div>
            {expandedRecords.has(record.id) && (
                <div className="record-details">
                    <div className="detail-row" style={{ alignItems: 'stretch' }}>
                        <div className="record-content-cell" title={record.content} role="button" tabIndex={0} onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(record.content);
                            showToast(t('copied'));
                        }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(record.content); showToast(t('copied')); } }} aria-label={`Copy content: ${record.content}`}>
                            {record.content}
                        </div>
                        <div className="ttl-box">
                            <span className="ttl-label">TTL</span>
                            <span className="ttl-value">{record.ttl === 1 ? t('ttlAuto') : record.ttl}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderGroupHeader = (groupKey, count) => {
        const isCollapsed = collapsedGroups.has(groupKey);
        return (
            <div
                key={`group-header-${groupKey}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleGroupCollapse(groupKey)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroupCollapse(groupKey); } }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.6rem 0.75rem',
                    background: 'var(--hover-bg, #f9fafb)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    marginBottom: '4px',
                    marginTop: '8px',
                    userSelect: 'none',
                    border: '1px solid var(--border)',
                }}
            >
                {isCollapsed ? <ChevronRight size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
                    {formatGroupLabel(groupKey, count)}
                </span>
            </div>
        );
    };

    return (
        <>
            {/* Group By Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t('groupBy')}:</span>
                {['none', 'type', 'subdomain'].map(option => (
                    <button
                        key={option}
                        onClick={() => handleGroupByChange(option)}
                        style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            border: '1px solid',
                            borderColor: groupBy === option ? 'var(--primary)' : 'var(--border)',
                            background: groupBy === option ? 'var(--select-active-bg, #fff7ed)' : 'transparent',
                            color: groupBy === option ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        {t('groupBy' + option.charAt(0).toUpperCase() + option.slice(1))}
                    </button>
                ))}
            </div>

            {/* Desktop Table */}
            {groupBy === 'none' ? (
                <table className="data-table desktop-only">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}>
                                <input
                                    type="checkbox"
                                    checked={filteredRecords.length > 0 && selectedRecords.size === filteredRecords.length}
                                    onChange={toggleSelectAll}
                                    className="record-checkbox"
                                />
                            </th>
                            <th>{t('type')}</th>
                            <th>{t('name')} / {t('comment')}</th>
                            <th>{t('content')}</th>
                            <th>{t('ttl')}</th>
                            <th>{t('proxied')}</th>
                            <th>{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.map(renderDesktopRow)}
                    </tbody>
                </table>
            ) : (
                <div className="desktop-only">
                    {groupedRecords && groupedRecords.map(([groupKey, groupRecords]) => (
                        <div key={groupKey}>
                            {renderGroupHeader(groupKey, groupRecords.length)}
                            {!collapsedGroups.has(groupKey) && (
                                <table className="data-table" style={{ marginBottom: '0.5rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}>
                                                <input type="checkbox" className="record-checkbox" onChange={() => {
                                                    const ids = groupRecords.map(r => r.id);
                                                    const allSelected = ids.every(id => selectedRecords.has(id));
                                                    setSelectedRecords(prev => {
                                                        const next = new Set(prev);
                                                        ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
                                                        return next;
                                                    });
                                                }} checked={groupRecords.length > 0 && groupRecords.every(r => selectedRecords.has(r.id))} />
                                            </th>
                                            <th>{t('type')}</th>
                                            <th>{t('name')} / {t('comment')}</th>
                                            <th>{t('content')}</th>
                                            <th>{t('ttl')}</th>
                                            <th>{t('proxied')}</th>
                                            <th>{t('actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupRecords.map(renderDesktopRow)}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Mobile Cards */}
            {groupBy === 'none' ? (
                <div className="mobile-only">
                    {filteredRecords.map(renderMobileCard)}
                </div>
            ) : (
                <div className="mobile-only">
                    {groupedRecords && groupedRecords.map(([groupKey, groupRecords]) => (
                        <div key={groupKey}>
                            {renderGroupHeader(groupKey, groupRecords.length)}
                            {!collapsedGroups.has(groupKey) && groupRecords.map(renderMobileCard)}
                        </div>
                    ))}
                </div>
            )}

            {/* Hidden file input for .txt import */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleImport}
                accept=".txt"
            />
        </>
    );
};

export default DnsRecordsTab;
