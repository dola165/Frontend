/**
 * Reusable skeleton loading placeholder with pulse animation.
 * Dark-mode compatible — uses translucent white on dark backgrounds.
 */
export const SkeletonCard = ({ lines = 3, className = '' }: { lines?: number; className?: string }) => (
    <div className={`animate-pulse rounded-xl border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] p-5 ${className}`}>
        <div className="mb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/[0.04]" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
                <div className="h-2.5 w-1/4 rounded bg-white/[0.03]" />
            </div>
        </div>
        {Array.from({ length: lines }).map((_, i) => (
            <div
                key={i}
                className="mb-2 h-3 rounded bg-white/[0.03]"
                style={{ width: `${85 - i * 15}%` }}
            />
        ))}
    </div>
);

export const SkeletonMessageRow = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse flex items-center gap-3 rounded-xl border border-[#ffffff0d] bg-[rgba(255,255,255,0.02)] p-4 ${className}`}>
        <div className="h-11 w-11 shrink-0 rounded-full bg-white/[0.04]" />
        <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between">
                <div className="h-3 w-24 rounded bg-white/[0.04]" />
                <div className="h-2.5 w-10 rounded bg-white/[0.03]" />
            </div>
            <div className="h-2.5 w-full rounded bg-white/[0.03]" />
        </div>
    </div>
);

export const SkeletonHero = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse ${className}`}>
        <div className="h-[300px] w-full rounded-xl bg-white/[0.02]" />
        <div className="-mt-20 ml-8 h-24 w-24 rounded-full border-[5px] border-[var(--club-band)] bg-white/[0.04]" />
        <div className="mt-4 ml-8 space-y-2">
            <div className="h-6 w-48 rounded bg-white/[0.04]" />
            <div className="h-4 w-32 rounded bg-white/[0.03]" />
        </div>
    </div>
);
