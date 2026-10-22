import type { CSSProperties } from 'react';
import type { BrandVariant } from '../layout/BrandMark';

/** Kick-off 4 section family: one G ring and lime node, with a distinct central symbol. */
export function GMark({ variant = 'pitch', size = 28, className = '' }: { variant?: BrandVariant | 'george'; size?: number; className?: string }) {
    const tone = variant === 'campaigns' ? 'fundraising' : ['map', 'store', 'jobs', 'george'].includes(variant) ? variant : 'workspace';
    const plain = variant === 'pitch' || variant === 'legacy';
    return <svg className={`g-brand-mark ${className}`} data-brand-mark={variant} width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false" style={{ '--g-symbol': `var(--brand-g-${tone})` } as CSSProperties}>
        <path d="M77 23A38 38 0 1 0 88 50H50" stroke="currentColor" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="77" cy="23" r="8" fill="var(--george-lime)" stroke="currentColor" strokeWidth="3" />
        {plain ? <circle cx="50" cy="50" r="8" fill="var(--george-lime)" stroke="currentColor" strokeWidth="3" /> : <g stroke="var(--brand-g-on-symbol)" strokeWidth="3" strokeLinejoin="round" transform={size < 56 ? 'translate(-15 -15) scale(1.3)' : undefined}>
            {variant === 'map' && <><path d="M50 68S36 53 36 44a14 14 0 0 1 28 0c0 9-14 24-14 24Z" fill="var(--g-symbol)" /><circle cx="50" cy="43" r="4" fill="var(--brand-g-on-symbol)" stroke="none" /></>}
            {variant === 'store' && <><path d="M43 42v-6a7 7 0 0 1 14 0v6" /><path d="M34 42h32l-3 23H37Z" fill="var(--g-symbol)" /></>}
            {variant === 'jobs' && <><rect x="43" y="34" width="14" height="10" rx="3" /><rect x="33" y="41" width="34" height="23" rx="4" fill="var(--g-symbol)" /><path d="M34 49h32" /></>}
            {variant === 'campaigns' && <><path d="M50 35V25m-5 5 5-5 5 5" /><rect x="34" y="55" width="32" height="10" rx="5" fill="var(--g-symbol)" /><rect x="34" y="46" width="32" height="10" rx="5" fill="var(--g-symbol)" /><rect x="37" y="37" width="26" height="10" rx="5" fill="var(--g-symbol)" /></>}
            {variant === 'george' && <><path d="M38 37h24a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H47l-9 7v-7a4 4 0 0 1-4-4V41a4 4 0 0 1 4-4Z" fill="var(--g-symbol)" /><path d="m40 56 5-13 5 13m-8-4h6m7-9v13" /></>}
            {variant === 'workspace' && <g fill="var(--g-symbol)"><rect x="34" y="34" width="15" height="15" rx="4" /><rect x="34" y="52" width="15" height="15" rx="4" /><rect x="52" y="52" width="15" height="15" rx="4" /></g>}
            {variant === 'schedule' && <><rect x="34" y="36" width="32" height="29" rx="4" fill="var(--g-symbol)" /><path d="M42 31v10m16-10v10M35 45h30m-22 9 5 5 10-9" /></>}
            {(variant === 'squads' || variant === 'following' || variant === 'joining') && <><circle cx="43" cy="41" r="6" fill="var(--g-symbol)" /><circle cx="59" cy="41" r="6" fill="var(--g-symbol)" /><path d="M32 64v-5c0-13 22-13 22 0v5m0 0v-5c0-10 16-10 16 0v5" fill="var(--g-symbol)" /></>}
            {variant === 'family' && <path d="M50 65 35 51c-14-15 5-27 15-14 10-13 29-1 15 14Z" fill="var(--g-symbol)" />}
            {variant === 'referee' && <><path d="M38 68V32h29L57 43l10 11H38" fill="var(--g-symbol)" /></>}
        </g>}
    </svg>;
}
