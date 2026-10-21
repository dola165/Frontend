import { MediaImage } from '../ui/MediaImage';
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
    PLANNING: 'border-[color:var(--color-info)]/25 bg-[color:var(--color-info)]/10 text-[color:var(--color-info)]',
    ACTIVE: 'border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]',
    COMPLETED: 'border-[color:var(--color-border)]/10 bg-[color:var(--color-ink)]/[0.06] text-[color:var(--color-secondary)]',
    CANCELLED: 'border-[color:var(--color-danger)]/25 bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]',
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
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/20 px-2.5 py-1 text-xs font-medium text-[color:var(--color-text)]">
            <Icon className="h-3.5 w-3.5 text-[color:var(--color-muted)]" />
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
        <div role={children ? undefined : 'img'} aria-label={children ? undefined : name} className={`relative isolate overflow-hidden bg-[var(--color-surface)] ${className}`.trim()}>
            {showFallback ? (
                <div
                    data-testid="tournament-visual-fallback"
                    className="absolute inset-0"
                    style={{
                        background:
                            'radial-gradient(circle at 82% 14%, color-mix(in srgb, var(--color-accent) 24%, transparent), transparent 24%), radial-gradient(circle at 18% 90%, color-mix(in srgb, var(--color-accent) 34%, transparent), transparent 32%), linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface) 48%, var(--color-page) 100%)',
                    }}
                >
                    <div className="absolute -right-8 top-1/2 h-[115%] w-[58%] -translate-y-1/2 rotate-[-7deg] rounded-[44%] border border-[color:var(--color-border)]/10" />
                    <div className="absolute right-[20%] top-1/2 h-[115%] w-px -translate-y-1/2 rotate-[-7deg] bg-[color:var(--color-ink)]/10" />
                    <div className="absolute right-[18%] top-1/2 h-20 w-20 -translate-y-1/2 rounded-full border border-[color:var(--color-border)]/10" />
                    <div className="absolute right-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--color-accent)]/20 bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] shadow-2xl shadow-[var(--color-shadow)]/30">
                        <Trophy className="h-6 w-6" />
                    </div>
                </div>
            ) : (
                <MediaImage
                    src={resolvedUrl}
                    alt=""
                    className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`.trim()}
                    loading="lazy"
                    onError={() => setFailedUrl(resolvedUrl)}
                />
            )}
            {overlay && <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-page)]/95 via-[var(--color-page)]/35 to-[color:var(--color-ink)]/10" />}
            {children ? <div className="relative z-10 h-full">{children}</div> : null}
        </div>
    );
};

export const TournamentIdentity = ({ name, subtitle }: { name: string; subtitle?: string | null }) => (
    <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/[0.05] text-sm font-bold text-[color:var(--color-accent)]">
            {name.trim().slice(0, 2).toUpperCase() || 'GK'}
        </span>
        <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[color:var(--color-text)]">{name}</span>
            {subtitle ? <span className="mt-0.5 block truncate text-xs text-[color:var(--color-muted)]">{subtitle}</span> : null}
        </span>
    </div>
);

export const RegistrationPolicyBadge = ({ policy }: { policy?: 'OPEN' | 'APPROVAL_ONLY' | 'INVITE_ONLY' | null }) => {
    const { t } = useTranslation();
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)]/[0.08] bg-[color:var(--color-ink)]/20 px-2.5 py-1 text-xs font-medium text-[color:var(--color-text)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--color-muted)]" />
            {tournamentPolicyText(policy, t)}
        </span>
    );
};
