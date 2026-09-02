import { useState, type ReactNode } from 'react';
import { Building2, ShieldCheck, Trophy, UserRound, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TournamentParticipantScope, TournamentStatus } from '../../features/tournaments/domain';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import {
    tournamentPolicyText,
    tournamentScopeText,
    tournamentStatusLabel,
} from './tournamentFormatters';

const statusTone: Record<TournamentStatus, string> = {
    PLANNING: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    ACTIVE: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    COMPLETED: 'border-white/10 bg-white/[0.06] text-zinc-300',
    CANCELLED: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
};

const scopeIcon = {
    PLAYER: UserRound,
    CLUB: Building2,
    SQUAD: UsersRound,
} as const;

export const TournamentStatusBadge = ({ status }: { status: TournamentStatus }) => {
    const { t } = useTranslation();
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${statusTone[status]}`}>
            {tournamentStatusLabel(status, t)}
        </span>
    );
};

export const TournamentScopeBadge = ({ scope }: { scope: TournamentParticipantScope }) => {
    const { t } = useTranslation();
    const Icon = scopeIcon[scope];
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-xs font-medium text-zinc-200">
            <Icon className="h-3.5 w-3.5 text-zinc-400" />
            {tournamentScopeText(scope, t)}
        </span>
    );
};

interface TournamentVisualProps {
    name: string;
    imageUrl?: string | null;
    className?: string;
    imageClassName?: string;
    overlay?: boolean;
    children?: ReactNode;
}

export const TournamentVisual = ({
    name,
    imageUrl,
    className = '',
    imageClassName = '',
    overlay = true,
    children,
}: TournamentVisualProps) => {
    const resolvedUrl = resolveMediaUrl(imageUrl);
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const showFallback = !resolvedUrl || failedUrl === resolvedUrl;

    return (
        <div aria-label={name} className={`relative isolate overflow-hidden bg-[#10231b] ${className}`.trim()}>
            {showFallback ? (
                <div
                    data-testid="tournament-visual-fallback"
                    className="absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(circle at 82% 14%, rgba(76, 222, 139, 0.24), transparent 24%), radial-gradient(circle at 18% 90%, rgba(47, 114, 86, 0.34), transparent 32%), linear-gradient(135deg, #142e23 0%, #101c18 48%, #0b1110 100%)',
                    }}
                >
                    <div className="absolute -right-8 top-1/2 h-[115%] w-[58%] -translate-y-1/2 rotate-[-7deg] rounded-[44%] border border-white/10" />
                    <div className="absolute right-[20%] top-1/2 h-[115%] w-px -translate-y-1/2 rotate-[-7deg] bg-white/10" />
                    <div className="absolute right-[18%] top-1/2 h-20 w-20 -translate-y-1/2 rounded-full border border-white/10" />
                    <div className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 shadow-2xl shadow-black/30">
                        <Trophy className="h-6 w-6" />
                    </div>
                </div>
            ) : (
                <img
                    src={resolvedUrl}
                    alt=""
                    className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`.trim()}
                    loading="lazy"
                    onError={() => setFailedUrl(resolvedUrl)}
                />
            )}
            {overlay && <div className="absolute inset-0 bg-gradient-to-t from-[#090c0b]/95 via-[#090c0b]/35 to-black/10" />}
            {children ? <div className="relative z-10 h-full">{children}</div> : null}
        </div>
    );
};

export const TournamentIdentity = ({ name, subtitle }: { name: string; subtitle?: string | null }) => (
    <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-sm font-bold text-emerald-300">
            {name.trim().slice(0, 2).toUpperCase() || 'GK'}
        </span>
        <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-100">{name}</span>
            {subtitle ? <span className="mt-0.5 block truncate text-xs text-zinc-500">{subtitle}</span> : null}
        </span>
    </div>
);

export const RegistrationPolicyBadge = ({ policy }: { policy?: 'OPEN' | 'APPROVAL_ONLY' | 'INVITE_ONLY' | null }) => {
    const { t } = useTranslation();
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-xs font-medium text-zinc-200">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
            {tournamentPolicyText(policy, t)}
        </span>
    );
};
