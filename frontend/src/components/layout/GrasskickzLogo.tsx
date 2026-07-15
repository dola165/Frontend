import { useState, type HTMLAttributes } from 'react';

interface GrasskickzLogoProps extends HTMLAttributes<HTMLDivElement> {
    compact?: boolean;
}

export const GrasskickzLogo = ({ compact = false, className = '', ...props }: GrasskickzLogoProps) => {
    const [imageFailed, setImageFailed] = useState(false);
    const logoHeight = compact ? 30 : 34;

    return (
        <div className={`flex items-center ${className}`.trim()} {...props}>
            {!imageFailed ? (
                <img
                    src="/logo/logo.jpg"
                    alt="Grasskickz"
                    className="block w-auto object-contain"
                    style={{ height: `${logoHeight}px` }}
                    onError={() => setImageFailed(true)}
                />
            ) : (
                <div className="flex flex-col leading-none">
                    <span className={`bg-[linear-gradient(135deg,var(--accent-highlight),#16a34a_55%,color-mix(in_srgb,#16a34a_70%,var(--bg-base)))] bg-clip-text font-semibold tracking-[-0.06em] text-transparent ${compact ? 'text-lg' : 'text-[1.45rem]'}`}>
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
