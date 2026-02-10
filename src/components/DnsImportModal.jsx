import React, { useState, useRef } from 'react';
import { X, Upload, Search, RefreshCw } from 'lucide-react';

const DnsImportModal = ({ zone, show, onClose, onImportComplete, auth, getHeaders, t, showToast }) => {
    const [bulkImportJson, setBulkImportJson] = useState('');
    const [bulkImportPreview, setBulkImportPreview] = useState(null);
    const [bulkImportLoading, setBulkImportLoading] = useState(false);
    const [bulkImportResult, setBulkImportResult] = useState(null);
    const jsonFileInputRef = useRef(null);

    const resetState = () => {
        setBulkImportJson('');
        setBulkImportPreview(null);
        setBulkImportLoading(false);
        setBulkImportResult(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const parseBulkImportJson = (jsonStr) => {
        try {
            const parsed = JSON.parse(jsonStr);
            const records = parsed.records || parsed;
            if (!Array.isArray(records)) {
                return { error: t('invalidJson') };
            }
            if (records.length === 0) {
                return { error: t('noRecordsFound') };
            }
            return { records };
        } catch {
            return { error: t('invalidJson') };
        }
    };

    const handleBulkImportPreview = () => {
        const result = parseBulkImportJson(bulkImportJson);
        if (result.error) {
            showToast(result.error, 'error');
            setBulkImportPreview(null);
            return;
        }
        setBulkImportPreview(result.records);
        setBulkImportResult(null);
    };

    const handleJsonFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setBulkImportJson(ev.target.result);
            setBulkImportPreview(null);
            setBulkImportResult(null);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleBulkImportSubmit = async () => {
        if (!bulkImportPreview || bulkImportPreview.length === 0) return;
        setBulkImportLoading(true);
        setBulkImportResult(null);
        try {
            const res = await fetch(`/api/zones/${zone.id}/dns_import`, {
                method: 'POST',
                headers: getHeaders(true),
                body: JSON.stringify({ records: bulkImportPreview })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setBulkImportResult({ created: data.created, total: data.total, errors: data.errors || [] });
                onImportComplete();
                if (data.created > 0) {
                    showToast(t('importResultCreated').replace('{count}', data.created));
                }
            } else {
                showToast(data.error || t('errorOccurred'), 'error');
            }
        } catch {
            showToast(t('errorOccurred'), 'error');
        }
        setBulkImportLoading(false);
    };

    if (!show) return null;

    return (
        <div
            className="modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
            <div className="glass-card fade-in modal-content" role="dialog" aria-label={t('bulkImport')} style={{ padding: '2rem', maxWidth: '600px', width: '90%', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0 }}>{t('bulkImport')}</h2>
                    <button className="btn btn-outline" style={{ padding: '4px', border: 'none' }} onClick={handleClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('bulkImportDesc')}</p>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>{t('pasteJson')}</label>
                    <textarea
                        value={bulkImportJson}
                        onChange={(e) => { setBulkImportJson(e.target.value); setBulkImportPreview(null); setBulkImportResult(null); }}
                        placeholder={t('jsonFormatHint')}
                        style={{
                            width: '100%',
                            minHeight: '120px',
                            padding: '0.75rem',
                            fontSize: '0.8125rem',
                            fontFamily: 'monospace',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            resize: 'vertical',
                            background: 'var(--card-bg, white)',
                            color: 'var(--text)'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <input
                        type="file"
                        ref={jsonFileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleJsonFileUpload}
                        accept=".json"
                    />
                    <button type="button" className="btn btn-outline" style={{ fontSize: '0.8125rem' }} onClick={() => jsonFileInputRef.current.click()}>
                        <Upload size={14} />
                        {t('uploadJsonFile')}
                    </button>
                    <button type="button" className="btn btn-primary" style={{ fontSize: '0.8125rem' }} onClick={handleBulkImportPreview} disabled={!bulkImportJson.trim()}>
                        <Search size={14} />
                        {t('previewRecords')}
                    </button>
                </div>

                {/* Preview Table */}
                {bulkImportPreview && bulkImportPreview.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            {bulkImportPreview.length} {t('dnsRecords').toLowerCase()}
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--card-bg, white)' }}>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('type')}</th>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('name')}</th>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{t('content')}</th>
                                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>TTL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bulkImportPreview.map((rec, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                            <td style={{ padding: '0.4rem 0.5rem' }}>
                                                <span className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>{rec.type}</span>
                                            </td>
                                            <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.name}</td>
                                            <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.content}</td>
                                            <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}>{rec.ttl || 'Auto'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Import Result */}
                {bulkImportResult && (
                    <div style={{
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        background: bulkImportResult.errors.length > 0 ? '#fff5f5' : '#f0fdf4',
                        border: `1px solid ${bulkImportResult.errors.length > 0 ? '#fecaca' : '#bbf7d0'}`
                    }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: bulkImportResult.errors.length > 0 ? 'var(--error)' : '#16a34a', marginBottom: bulkImportResult.errors.length > 0 ? '0.5rem' : 0 }}>
                            {t('importResultCreated').replace('{count}', bulkImportResult.created)}
                            {bulkImportResult.errors.length > 0 && (
                                <span style={{ marginLeft: '8px' }}>
                                    | {t('importResultErrors').replace('{count}', bulkImportResult.errors.length)}
                                </span>
                            )}
                        </div>
                        {bulkImportResult.errors.length > 0 && (
                            <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.75rem', color: 'var(--error)' }}>
                                {bulkImportResult.errors.map((err, idx) => (
                                    <div key={idx} style={{ padding: '2px 0' }}>
                                        #{err.index + 1}: {err.error}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={handleClose}>{t('cancel')}</button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        onClick={handleBulkImportSubmit}
                        disabled={!bulkImportPreview || bulkImportPreview.length === 0 || bulkImportLoading}
                    >
                        {bulkImportLoading ? (
                            <><RefreshCw size={14} className="spin" /> {t('importing')}</>
                        ) : (
                            <><Upload size={14} /> {t('importRecords')}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DnsImportModal;
