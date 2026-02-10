import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight } from 'lucide-react';

const ONBOARDING_KEY = 'ONBOARDING_DONE';

const OnboardingTour = ({ t }) => {
    const [active, setActive] = useState(false);
    const [step, setStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    const steps = [
        { target: null, title: t('onboardingWelcomeTitle'), desc: t('onboardingWelcomeDesc') },
        { target: '.zone-selector-area, [aria-label="' + t('switchZone') + '"]', title: t('onboardingZoneTitle'), desc: t('onboardingZoneDesc') },
        { target: '.table-container, .data-table', title: t('onboardingDnsTitle'), desc: t('onboardingDnsDesc') },
        { target: '[title="' + t('templates') + '"], .btn-text', title: t('onboardingTemplatesTitle'), desc: t('onboardingTemplatesDesc'), fallbackMatch: 'templates' },
        { target: '.search-container, [placeholder="' + t('searchPlaceholder') + '"]', title: t('onboardingSearchTitle'), desc: t('onboardingSearchDesc') },
        { target: null, title: t('onboardingDoneTitle'), desc: t('onboardingDoneDesc') },
    ];

    useEffect(() => {
        if (!localStorage.getItem(ONBOARDING_KEY)) {
            const timer = setTimeout(() => setActive(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const updateTargetRect = useCallback(() => {
        const currentStep = steps[step];
        if (!currentStep || !currentStep.target) {
            setTargetRect(null);
            return;
        }
        const selectors = currentStep.target.split(',').map(s => s.trim());
        let el = null;
        for (const sel of selectors) {
            try { el = document.querySelector(sel); } catch (e) { /* ignore */ }
            if (el) break;
        }
        if (el) {
            const rect = el.getBoundingClientRect();
            setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        } else {
            setTargetRect(null);
        }
    }, [step]);

    useEffect(() => {
        if (!active) return;
        updateTargetRect();
        const interval = setInterval(updateTargetRect, 500);
        return () => clearInterval(interval);
    }, [active, step, updateTargetRect]);

    const finish = () => {
        setActive(false);
        localStorage.setItem(ONBOARDING_KEY, 'true');
    };

    const next = () => {
        if (step >= steps.length - 1) {
            finish();
        } else {
            setStep(step + 1);
        }
    };

    const skip = () => {
        finish();
    };

    if (!active) return null;

    const currentStep = steps[step];
    const isFirst = step === 0;
    const isLast = step === steps.length - 1;

    // Calculate tooltip position
    let tooltipStyle = {
        position: 'fixed',
        zIndex: 10002,
        background: 'var(--card-bg, #fff)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.25rem',
        maxWidth: '320px',
        width: '90vw',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    };

    if (targetRect && targetRect.width > 0) {
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const centerX = targetRect.left + targetRect.width / 2;
        const below = targetRect.top + targetRect.height + 12;
        const above = targetRect.top - 12;

        if (below + 180 < viewportHeight) {
            tooltipStyle.top = below + 'px';
        } else {
            tooltipStyle.bottom = (viewportHeight - above) + 'px';
        }
        tooltipStyle.left = Math.max(16, Math.min(centerX - 160, viewportWidth - 336)) + 'px';
    } else {
        tooltipStyle.top = '50%';
        tooltipStyle.left = '50%';
        tooltipStyle.transform = 'translate(-50%, -50%)';
    }

    return (
        <>
            {/* Overlay */}
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.4)',
                    zIndex: 10000,
                }}
                onClick={skip}
            />

            {/* Highlight box with pulsing border */}
            {targetRect && targetRect.width > 0 && (
                <div
                    style={{
                        position: 'fixed',
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                        border: '2px solid var(--primary)',
                        borderRadius: '8px',
                        zIndex: 10001,
                        pointerEvents: 'none',
                        boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.4)',
                        animation: 'onboarding-pulse 1.5s ease-in-out infinite',
                        background: 'transparent',
                    }}
                />
            )}

            {/* Tooltip */}
            <div style={tooltipStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                        {currentStep.title}
                    </h4>
                    <button
                        onClick={skip}
                        style={{
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            padding: '2px', display: 'flex', flexShrink: 0,
                            color: 'var(--text-muted)'
                        }}
                        aria-label="Close tour"
                    >
                        <X size={16} />
                    </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
                    {currentStep.desc}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {step + 1} / {steps.length}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!isLast && (
                            <button
                                onClick={skip}
                                style={{
                                    border: 'none', background: 'transparent',
                                    cursor: 'pointer', fontSize: '0.8rem',
                                    color: 'var(--text-muted)', padding: '6px 12px',
                                    borderRadius: '6px',
                                }}
                            >
                                {t('onboardingSkip')}
                            </button>
                        )}
                        <button
                            onClick={next}
                            style={{
                                border: 'none',
                                background: 'var(--primary)',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                padding: '6px 16px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            {isLast ? t('onboardingFinish') : t('onboardingNext')}
                            {!isLast && <ChevronRight size={14} />}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes onboarding-pulse {
                    0%, 100% { border-color: var(--primary); box-shadow: 0 0 0 4000px rgba(0,0,0,0.4), 0 0 0 0 rgba(243,128,32,0.4); }
                    50% { border-color: var(--primary); box-shadow: 0 0 0 4000px rgba(0,0,0,0.4), 0 0 0 8px rgba(243,128,32,0.15); }
                }
            `}</style>
        </>
    );
};

export default OnboardingTour;
