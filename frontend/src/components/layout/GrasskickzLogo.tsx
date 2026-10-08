import { useState, type HTMLAttributes } from 'react';

interface GrasskickzLogoProps extends HTMLAttributes<HTMLDivElement> {
    compact?: boolean;
    wordmark?: boolean;
}

export const GrasskickzLogo = ({ compact = false, wordmark = false, className = '', ...props }: GrasskickzLogoProps) => {
    const [imageFailed, setImageFailed] = useState(false);
    const logoHeight = compact ? 24 : 27;

    if (wordmark) return <div className={`home-brand ${className}`} {...props}>
        <span className="home-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.8" /><path d="m16 10 5.7 4.2-2.2 6.6h-7l-2.2-6.6Z" fill="currentColor" /><path d="m16 10 0-6M21.7 14.2l5.3-1.7m-7.5 8.3 3.4 4.6m-10.4-4.6-3.4 4.6m1.2-11.2L5 12.5" stroke="currentColor" strokeWidth="1.8" /></svg>
        </span>
        <span className="home-brand-wordmark" aria-label="GrassKickZ">Grass<span>Kick</span>Z</span>
    </div>;

    return (
        <div className={`flex items-center ${className}`.trim()} {...props}>
            {!imageFailed ? (
                <img
                    src="/brand/grasskickz-main.png"
                    alt="Grasskickz"
                    className="block w-auto object-contain"
                    style={{ height: `${logoHeight}px` }}
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <div className="flex flex-col leading-none">
                    <span className={`bg-[linear-gradient(135deg,var(--accent-highlight),var(--color-accent)_55%,color-mix(in_srgb,var(--color-accent)_70%,var(--bg-base)))] bg-clip-text font-semibold tracking-[-0.06em] text-transparent ${compact ? 'text-lg' : 'text-[1.45rem]'}`}>
                        Grasskickz
                    </span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.26em] text-[color:var(--text-secondary)]">
                        Connecting The Game
                    </span>
                </div>
            )}
        </div>
    );
};
