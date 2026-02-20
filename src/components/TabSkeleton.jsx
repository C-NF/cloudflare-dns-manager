import React from 'react';

const SkeletonHeader = () => (
    <div className="skeleton-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ width: '120px', height: '20px' }} />
        </div>
        <div className="skeleton" style={{ width: '32px', height: '28px', borderRadius: '6px' }} />
    </div>
);

const SettingsSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SkeletonHeader />
        {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-card">
                <div className="skeleton-card-inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="skeleton" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
                        <div className="skeleton" style={{ width: `${100 + i * 20}px`, height: '16px' }} />
                    </div>
                    <div className="skeleton" style={{ width: '40px', height: '22px', borderRadius: '11px' }} />
                </div>
                <div className="skeleton" style={{ width: '80%', height: '12px', marginTop: '4px' }} />
            </div>
        ))}
    </div>
);

const ListSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SkeletonHeader />
        <div className="skeleton" style={{ width: '60%', height: '12px', marginTop: '-1rem', marginBottom: '0.25rem' }} />
        {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-card" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <div className="skeleton" style={{ width: `${140 + i * 15}px`, height: '16px' }} />
                        <div className="skeleton" style={{ width: '50px', height: '18px', borderRadius: '10px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                        <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
                    </div>
                </div>
                <div className="skeleton" style={{ width: '90%', height: '11px', marginTop: '0.5rem' }} />
            </div>
        ))}
    </div>
);

const AnalyticsSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="skeleton-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="skeleton" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
                <div className="skeleton" style={{ width: '130px', height: '20px' }} />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton" style={{ width: '42px', height: '28px', borderRadius: '6px' }} />
                ))}
            </div>
        </div>
        <div className="skeleton-cards-grid">
            {[1, 2].map(i => (
                <div key={i} className="skeleton-card">
                    <div className="skeleton" style={{ width: '80px', height: '12px', marginBottom: '0.75rem' }} />
                    <div className="skeleton" style={{ width: '100px', height: '28px' }} />
                </div>
            ))}
        </div>
        <div className="skeleton-card" style={{ padding: '1.25rem' }}>
            <div className="skeleton" style={{ width: '100px', height: '16px', marginBottom: '1rem' }} />
            {[100, 80, 55, 35, 20].map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                    <div className="skeleton" style={{ width: '40px', height: '14px' }} />
                    <div className="skeleton" style={{ flex: 1, height: '20px', maxWidth: `${w}%` }} />
                    <div className="skeleton" style={{ width: '45px', height: '14px' }} />
                </div>
            ))}
        </div>
    </div>
);

const CacheSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <SkeletonHeader />
        <div className="skeleton-card">
            <div className="skeleton-card-inner">
                <div className="skeleton" style={{ width: '160px', height: '16px' }} />
                <div className="skeleton" style={{ width: '40px', height: '22px', borderRadius: '11px' }} />
            </div>
            <div className="skeleton" style={{ width: '70%', height: '12px' }} />
        </div>
        <div className="skeleton-card">
            <div className="skeleton" style={{ width: '120px', height: '16px', marginBottom: '0.75rem' }} />
            <div className="skeleton" style={{ width: '100%', height: '36px', borderRadius: '6px' }} />
        </div>
    </div>
);

const TabSkeleton = ({ variant = 'settings' }) => {
    switch (variant) {
        case 'list': return <ListSkeleton />;
        case 'analytics': return <AnalyticsSkeleton />;
        case 'cache': return <CacheSkeleton />;
        default: return <SettingsSkeleton />;
    }
};

export default TabSkeleton;
