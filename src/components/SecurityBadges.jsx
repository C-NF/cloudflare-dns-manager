import React from 'react';
import { Shield, Key, Fingerprint } from 'lucide-react';

const SecurityBadges = ({ t }) => {
    const badges = [
        { icon: <Shield size={10} />, label: t('badgeE2E'), bg: '#ecfdf5', border: '#a7f3d0', fg: '#059669' },
        { icon: <Key size={10} />, label: t('badgeSHA256'), bg: '#f5f3ff', border: '#c4b5fd', fg: '#7c3aed' },
        { icon: <Shield size={10} />, label: t('badgeZeroKnowledge'), bg: '#eff6ff', border: '#93c5fd', fg: '#2563eb' },
        { icon: <Key size={10} />, label: t('badgeJWT'), bg: '#fffbeb', border: '#fcd34d', fg: '#d97706' },
        { icon: <Shield size={10} />, label: t('badgeHTTPS'), bg: '#ecfdf5', border: '#a7f3d0', fg: '#059669' },
        { icon: <Key size={10} />, label: t('badgeNoPlaintext'), bg: '#fef2f2', border: '#fecaca', fg: '#dc2626' },
        { icon: <Fingerprint size={10} />, label: t('badgePasskey'), bg: '#fdf4ff', border: '#e9d5ff', fg: '#9333ea' },
    ];
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center' }}>
            {badges.map((b, i) => (
                <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.01em',
                    padding: '2px 7px', borderRadius: '999px',
                    background: b.bg, color: b.fg, border: `1px solid ${b.border}`,
                }}>
                    {b.icon} {b.label}
                </span>
            ))}
        </div>
    );
};

export default SecurityBadges;
