import { useBrandStyle } from '../branding/BrandStyleContext';
import { GMark } from '../branding/GMark';

export type BrandVariant = 'george' | 'workspace' | 'legacy' | 'pitch' | 'store' | 'jobs' | 'campaigns' | 'map' | 'joining' | 'squads' | 'schedule' | 'family' | 'referee' | 'following';

/** Brand Book edition 01, pages 9 and 14: 140:100 frame, 10-unit strokes.
 * Shortcut interiors adapt the pitch frame; the map uses a compact outlined location pin. */
export function BrandMark({ world = false, className = '', variant = 'legacy', size }: { world?: boolean; className?: string; variant?: BrandVariant; size?: number }) {
    const { style } = useBrandStyle();
    if (style === 'g') return <GMark variant={world ? 'map' : variant} size={size} className={className} />;
    if (variant !== 'legacy') return <svg className={`pitch-brand-mark ${className}`} data-brand-mark={variant} width={size} height={size ? size * 100 / 140 : undefined} viewBox="0 0 140 100" fill="none" stroke="currentColor" strokeWidth="10" aria-hidden="true" focusable="false">
        {variant === 'workspace' && <>
            <path d="M54 17V7h32v10" strokeLinejoin="round" /><rect x="5" y="17" width="130" height="78" rx="8" />
            <path d="m25 40 18 18m0-18L25 58M51 62l11-14 16 13 13-20" strokeWidth="8" strokeLinecap="round" strokeDasharray="1 15" />
            <circle cx="108" cy="65" r="11" strokeWidth="8" />
        </>}
        {variant === 'george' && <>
            <path d="M15 8h110a8 8 0 0 1 8 8v61a8 8 0 0 1-8 8H48L20 97l5-12H15a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z" strokeLinejoin="round" />
            <path d="M70 24c0 17 7 24 24 24-17 0-24 7-24 24 0-17-7-24-24-24 17 0 24-7 24-24Zm36-5c0 9 3 12 12 12-9 0-12 3-12 12 0-9-3-12-12-12 9 0 12-3 12-12Z" fill="currentColor" stroke="none" />
        </>}
        {variant === 'pitch' && <>
            <rect x="5" y="5" width="130" height="90" rx="10" />
            <path d="M70 5V95" /><circle cx="70" cy="50" r="20" />
        </>}
        {variant === 'store' && <>
            <path d="M48 32V24a22 18 0 0 1 44 0v8" strokeLinecap="round" />
            <rect x="5" y="32" width="130" height="63" rx="10" />
            <path d="M70 32V95" /><circle cx="70" cy="63.5" r="15" />
        </>}
        {variant === 'jobs' && <>
            <rect x="47" y="8" width="46" height="24" rx="7" />
            <rect x="5" y="32" width="130" height="63" rx="10" />
            <path d="M5 60H135" /><rect x="58" y="50" width="24" height="20" rx="4" fill="currentColor" stroke="none" />
        </>}
        {variant === 'campaigns' && <>
            <rect x="5" y="5" width="130" height="90" rx="10" />
            <path d="M70 5V30M70 70V95" /><circle cx="70" cy="50" r="20" />
            <path d="M50 50a20 20 0 0 0 40 0Z" fill="currentColor" stroke="none" />
        </>}
        {variant === 'map' && <>
            <rect x="5" y="5" width="130" height="90" rx="10" />
            <path d="M70 5V18M70 82V95M70 80S49 59 49 45a21 21 0 0 1 42 0c0 14-21 35-21 35Z" />
            <circle cx="70" cy="45" r="7" fill="currentColor" stroke="none" />
        </>}
        {['joining', 'squads', 'family', 'referee', 'following'].includes(variant) && <rect x="5" y="5" width="130" height="90" rx="10" />}
        {variant === 'joining' && <>
            <path d="M22 50H61M47 36l14 14-14 14M77 79V70c0-17 34-17 34 0v9" strokeLinejoin="round" />
            <circle cx="94" cy="33" r="10" />
        </>}
        {(variant === 'squads' || variant === 'following') && <>
            <circle cx="46" cy="32" r="10" /><circle cx="94" cy="32" r="10" />
            <path d="M26 80V68c0-22 40-22 40 0v12M74 80V68c0-22 40-22 40 0v12" />
        </>}
        {variant === 'schedule' && <>
            <rect x="5" y="15" width="130" height="80" rx="10" /><path d="M40 5V28M100 5V28M5 40H135M48 65l14 14 30-25" strokeLinejoin="round" />
        </>}
        {variant === 'family' && <path d="M70 79 35 48c-24-25 10-43 35-17 25-26 59-8 35 17Z" strokeLinejoin="round" />}
        {variant === 'referee' && <path d="M45 80V22h53L83 40l15 18H45" strokeLinejoin="round" />}
    </svg>;
    return <svg className={className} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
        {world ? <><g fill="var(--color-accent)">{[[64, 17], [111, 64], [64, 111], [17, 64]].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 15} y={y - 15} width="30" height="30" rx="9" transform={`rotate(45 ${x} ${y})`} />)}</g><circle cx="64" cy="64" r="19" fill="var(--color-text)" /></>
            : <><g fill="var(--color-accent)"><rect x="8" y="8" width="50" height="50" rx="15" /><rect x="8" y="70" width="50" height="50" rx="15" /><rect x="70" y="70" width="50" height="50" rx="15" /></g><circle cx="96" cy="33" r="28" fill="var(--color-text)" /></>}
    </svg>;
}
