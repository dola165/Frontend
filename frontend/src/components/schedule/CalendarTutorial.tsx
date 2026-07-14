import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'tutorial.calendar.completed';

interface TutorialStep {
    target: string;
    position: 'bottom' | 'top' | 'left' | 'right';
    titleKey: string;
    bodyKey: string;
}

const STEPS: TutorialStep[] = [
    { target: 'calendar-surface-toggle', position: 'bottom', titleKey: 'tutorial.calendar.surfaceToggle.title', bodyKey: 'tutorial.calendar.surfaceToggle.body' },
    { target: 'calendar-new-event-btn', position: 'left', titleKey: 'tutorial.calendar.newEvent.title', bodyKey: 'tutorial.calendar.newEvent.body' },
    { target: 'calendar-event-filters', position: 'right', titleKey: 'tutorial.calendar.eventFilters.title', bodyKey: 'tutorial.calendar.eventFilters.body' },
    { target: 'calendar-date-nav', position: 'bottom', titleKey: 'tutorial.calendar.dateNav.title', bodyKey: 'tutorial.calendar.dateNav.body' },
    { target: 'calendar-view-mode', position: 'bottom', titleKey: 'tutorial.calendar.viewMode.title', bodyKey: 'tutorial.calendar.viewMode.body' },
    { target: 'calendar-standing-schedule', position: 'right', titleKey: 'tutorial.calendar.standingSchedule.title', bodyKey: 'tutorial.calendar.standingSchedule.body' },
    { target: 'calendar-back-nav', position: 'bottom', titleKey: 'tutorial.calendar.backNav.title', bodyKey: 'tutorial.calendar.backNav.body' },
];

export const CALENDAR_TUTORIAL_TARGETS = ['calendar-back-nav', 'calendar-surface-toggle', 'calendar-new-event-btn', 'calendar-event-filters', 'calendar-date-nav', 'calendar-standing-schedule'] as const;

interface SpotlightProps {
    step: TutorialStep;
    stepIndex: number;
    total: number;
    onNext: () => void;
    onBack: () => void;
    onSkip: () => void;
    onClose: () => void;
}

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

const Spotlight = ({ step, stepIndex, total, onNext, onBack, onSkip, onClose }: SpotlightProps) => {
    const { t } = useTranslation();
    const [rect, setRect] = useState<TargetRect | null>(null);
    const rafRef = useRef<number>(0);

    const updateRect = useCallback(() => {
        const el = document.querySelector(`[data-tutorial="${step.target}"]`) as HTMLElement | null;
        if (!el) { setRect(null); return; }
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, [step.target]);

    useEffect(() => {
        updateRect();
        const onFrame = () => { updateRect(); rafRef.current = requestAnimationFrame(onFrame); };
        rafRef.current = requestAnimationFrame(onFrame);
        window.addEventListener('resize', updateRect);
        return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', updateRect); };
    }, [updateRect]);

    // Remove highlight from previous target
    useEffect(() => {
        document.querySelectorAll('[data-tutorial]').forEach((el) => el.classList.remove('tutorial-highlight'));
        const el = document.querySelector(`[data-tutorial="${step.target}"]`);
        if (el) el.classList.add('tutorial-highlight');
        return () => { el?.classList.remove('tutorial-highlight'); };
    }, [step.target]);

    const tooltipStyle = useMemo(() => {
        if (!rect) return { opacity: 0 } as React.CSSProperties;

        const GAP = 16;
        const CARD_W = 360;
        const CARD_H = 180;
        const PAD = 20;

        let top: number, left: number;
        const pos = step.position;

        if (pos === 'bottom') {
            top = rect.top + rect.height + GAP;
            left = Math.max(PAD, Math.min(rect.left + rect.width / 2 - CARD_W / 2, window.innerWidth - CARD_W - PAD));
        } else if (pos === 'top') {
            top = Math.max(PAD, rect.top - CARD_H - GAP);
            left = Math.max(PAD, Math.min(rect.left + rect.width / 2 - CARD_W / 2, window.innerWidth - CARD_W - PAD));
        } else if (pos === 'right') {
            top = Math.max(PAD, rect.top + rect.height / 2 - CARD_H / 2);
            left = Math.min(rect.left + rect.width + GAP, window.innerWidth - CARD_W - PAD);
        } else {
            top = Math.max(PAD, rect.top + rect.height / 2 - CARD_H / 2);
            left = Math.max(PAD, rect.left - CARD_W - GAP);
        }

        // Clamp
        top = Math.max(PAD, Math.min(top, window.innerHeight - CARD_H - PAD));
        left = Math.max(PAD, Math.min(left, window.innerWidth - CARD_W - PAD));

        return { top, left };
    }, [rect, step.position]);

    // Arrow direction: point from card edge toward target center
    const arrowStyle = useMemo(() => {
        if (!rect) return { display: 'none' } as React.CSSProperties;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const cardCx = Number(tooltipStyle.left!) + 180; // card center x
        const cardCy = Number(tooltipStyle.top!) + 90;   // card center y
        const angle = Math.atan2(cy - cardCy, cx - cardCx) * (180 / Math.PI);
        return { transform: `rotate(${angle}deg)` };
    }, [rect, tooltipStyle]);

    const isLast = stepIndex === total - 1;

    if (!rect) return null;

    return (
        <>
            {/* Tooltip card */}
            <div
                className="pointer-events-auto absolute z-10 w-[360px] rounded-[var(--fc-radius)] border border-[var(--fc-border)] bg-[var(--fc-card-bg)] shadow-2xl"
                style={{ top: tooltipStyle.top, left: tooltipStyle.left, transition: 'top 300ms ease, left 300ms ease' }}
            >
                {/* Arrow */}
                <div
                    className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-[var(--fc-border)] bg-[var(--fc-card-bg)]"
                    style={arrowStyle}
                />

                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-[var(--fc-border)] px-5 py-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fc-text-muted)]">
                            {t('tutorial.calendar.stepCounter', { current: stepIndex + 1, total })}
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-[var(--fc-text-primary)]">{t(step.titleKey)}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={onSkip}
                            className="rounded-[var(--fc-radius)] px-2 py-1 text-[11px] font-medium text-[var(--fc-text-muted)] transition-colors hover:text-[var(--fc-text-secondary)]">
                            {t('tutorial.calendar.skipButton')}
                        </button>
                        <button type="button" onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded-[var(--fc-radius)] text-[var(--fc-text-muted)] transition-colors hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                    <p className="text-sm leading-6 text-[var(--fc-text-secondary)]">{t(step.bodyKey)}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 border-t border-[var(--fc-border)] px-5 py-3">
                    <div className="flex gap-1.5">
                        {Array.from({ length: total }, (_, i) => (
                            <div key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${i === stepIndex ? 'bg-[var(--fc-accent)]' : i < stepIndex ? 'bg-[var(--fc-text-muted)]' : 'bg-[var(--fc-border)]'}`} />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {stepIndex > 0 && (
                            <button type="button" onClick={onBack}
                                className="inline-flex items-center gap-1 rounded-[var(--fc-radius)] px-2.5 py-1.5 text-xs font-medium text-[var(--fc-text-secondary)] transition-colors hover:bg-[var(--fc-surface-hover)]">
                                <ChevronLeft className="h-3.5 w-3.5" />
                                {t('tutorial.calendar.backButton')}
                            </button>
                        )}
                        <button type="button" onClick={onNext}
                            className="inline-flex items-center gap-1.5 rounded-[var(--fc-radius)] bg-[var(--fc-accent)] px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-110">
                            {isLast ? (
                                <>
                                    <Check className="h-3.5 w-3.5" />
                                    {t('tutorial.calendar.finishButton')}
                                </>
                            ) : (
                                <>
                                    {t('tutorial.calendar.nextButton')}
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export const CalendarTutorial = ({ onComplete }: { onComplete: () => void }) => {
    const [stepIndex, setStepIndex] = useState(0);
    const [visible, setVisible] = useState(true);

    const handleNext = () => {
        if (stepIndex >= STEPS.length - 1) {
            finish();
        } else {
            setStepIndex((s) => s + 1);
        }
    };

    const handleBack = () => { setStepIndex((s) => Math.max(0, s - 1)); };

    const finish = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setVisible(false);
        onComplete();
    };

    const handleSkip = () => finish();

    const handleClose = () => finish();

    if (!visible) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[10000]">
            <Spotlight
                step={STEPS[stepIndex]}
                stepIndex={stepIndex}
                total={STEPS.length}
                onNext={handleNext}
                onBack={handleBack}
                onSkip={handleSkip}
                onClose={handleClose}
            />
        </div>
    );
};

/** Check whether the calendar tutorial has been completed. */
export const isTutorialCompleted = (): boolean => localStorage.getItem(STORAGE_KEY) === 'true';
