import type { ChangeEvent } from 'react';

export interface DirectoryRangeFilterProps {
    min: number;
    max: number;
    lowerValue: number;
    upperValue: number;
    step?: number;
    lowerLabel?: string;
    upperLabel?: string;
    valueFormatter?: (value: number) => string;
    accent?: 'green' | 'amber' | 'violet' | 'emerald';
    onChange: (lowerValue: number, upperValue: number) => void;
}

const accentClasses = {
    green: 'bg-[#16a34a]',
    amber: 'bg-amber-400',
    violet: 'bg-fuchsia-400',
    emerald: 'bg-emerald-400'
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const DirectoryRangeFilter = ({
    min,
    max,
    lowerValue,
    upperValue,
    step = 1,
    lowerLabel = 'Minimum',
    upperLabel = 'Maximum',
    valueFormatter = (value) => String(value),
    accent = 'green',
    onChange
}: DirectoryRangeFilterProps) => {
    const safeMax = Math.max(min, max);
    const lower = clamp(Math.min(lowerValue, upperValue), min, safeMax);
    const upper = clamp(Math.max(lowerValue, upperValue), min, safeMax);
    const span = safeMax - min || 1;
    const lowerPercent = ((lower - min) / span) * 100;
    const upperPercent = ((upper - min) / span) * 100;

    const handleLowerSlider = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(Math.min(Number(event.target.value), upper), upper);
    };
    const handleUpperSlider = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(lower, Math.max(Number(event.target.value), lower));
    };
    const handleLowerInput = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(clamp(Number(event.target.value), min, upper), upper);
    };
    const handleUpperInput = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(lower, clamp(Number(event.target.value), lower, safeMax));
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{lowerLabel}</span>
                    <input type="number" min={min} max={upper} step={step} value={lower} onChange={handleLowerInput} aria-label={lowerLabel} className="h-10 w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-page)] px-2.5 text-sm font-semibold text-[color:var(--text-primary)] outline-none focus:border-[color:var(--theme-border-strong)]" />
                </label>
                <label className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">{upperLabel}</span>
                    <input type="number" min={lower} max={safeMax} step={step} value={upper} onChange={handleUpperInput} aria-label={upperLabel} className="h-10 w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-page)] px-2.5 text-sm font-semibold text-[color:var(--text-primary)] outline-none focus:border-[color:var(--theme-border-strong)]" />
                </label>
            </div>

            <div className="relative h-8 px-1" aria-label={`${lowerLabel} to ${upperLabel}`}>
                <div className="absolute left-1 right-1 top-3 h-1.5 rounded-full bg-[color:var(--theme-border-strong)]" />
                <div className={`absolute top-3 h-1.5 rounded-full ${accentClasses[accent]}`} style={{ left: `calc(${lowerPercent}% + 4px)`, right: `calc(${100 - upperPercent}% + 4px)` }} />
                <input type="range" min={min} max={safeMax} step={step} value={lower} onChange={handleLowerSlider} aria-label={lowerLabel} className="directory-range-input absolute inset-x-0 top-0 h-7 w-full" />
                <input type="range" min={min} max={safeMax} step={step} value={upper} onChange={handleUpperSlider} aria-label={upperLabel} className="directory-range-input absolute inset-x-0 top-0 h-7 w-full" />
            </div>

            <div className="flex justify-between text-[10px] font-medium text-[color:var(--text-muted)]"><span>{valueFormatter(min)}</span><span>{valueFormatter(safeMax)}</span></div>
        </div>
    );
};
