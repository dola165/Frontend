import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Crown, Loader2, UserRound, UsersRound } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { ClubManagementTab } from '../ClubManagementModal';

interface ClubStaffMember {
    userId: number;
    fullName: string;
    avatarUrl?: string | null;
    role: string;
    bio?: string | null;
}

interface TabPeopleProps {
    clubId: number;
    clubName: string;
    isOwnClubAdmin: boolean;
    onOpenManageClub?: (tab: ClubManagementTab) => void;
}

const publicClubTitleKey = (role: string): string => {
    switch (role) {
        case 'OWNER':
            return 'clubPeople.presidentOwner';
        case 'CLUB_ADMIN':
            return 'clubPeople.clubDirector';
        case 'COACH':
            return 'clubPeople.coach';
        default:
            return role;
    }
};

const roleChipClass: Record<string, string> = {
    OWNER: 'border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green-soft)] text-[color:var(--club-tone-green)]',
    CLUB_ADMIN: 'border-[color:var(--club-tone-blue-border)] bg-[color:var(--club-tone-blue-soft)] text-[color:var(--club-tone-blue)]',
    COACH: 'border-[color:var(--club-tone-cyan-border)] bg-[color:var(--club-tone-cyan-soft)] text-[color:var(--club-tone-cyan)]',
};

const initialsFrom = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'GK';

const StaffCard = ({ member, featured }: { member: ClubStaffMember; featured?: boolean }) => {
    const { t } = useTranslation();
    const avatarUrl = resolveMediaUrl(member.avatarUrl);
    const displayName = member.fullName || 'Club Staff';
    const chipClass = roleChipClass[member.role] ?? 'border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] text-[color:var(--club-theme-text-secondary)]';

    return (
        <article
            className={`group relative overflow-hidden rounded-2xl border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] p-5 transition-all hover:border-[color:var(--club-theme-border-strong)] hover:shadow-[0_10px_28px_rgba(2,6,12,0.22)] ${featured ? 'sm:col-span-2' : ''}`}
        >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.10),transparent_65%)]" />

            <div className="relative flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] text-lg font-bold text-[color:var(--club-theme-text-primary)] ring-1 ring-white/[0.04]">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                    ) : (
                        initialsFrom(displayName)
                    )}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[color:var(--club-theme-text-primary)]">{displayName}</p>
                    <span className={`mt-1.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${chipClass}`}>
                        {t(publicClubTitleKey(member.role))}
                    </span>
                </div>
            </div>

            {member.bio && (
                <p className="relative mt-4 text-sm leading-6 text-[color:var(--club-theme-text-secondary)] line-clamp-3">
                    {member.bio}
                </p>
            )}

            <Link
                to={`/profile/${member.userId}`}
                className="relative mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--club-tone-green)] transition-colors hover:text-[color:var(--club-tone-green)]/80 hover:underline"
            >
                {t('clubPeople.viewProfile')}
                <ArrowRight className="h-3.5 w-3.5" />
            </Link>
        </article>
    );
};

export const TabPeople = ({ clubId, clubName, isOwnClubAdmin, onOpenManageClub }: TabPeopleProps) => {
    const { t } = useTranslation();
    const [staff, setStaff] = useState<ClubStaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadStaff = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get<ClubStaffMember[]>(`/clubs/${clubId}/staff`);
            setStaff(Array.isArray(response.data) ? response.data : []);
        } catch (err) {
            console.error('Failed to load club staff', err);
            setError(t('clubPeople.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadStaff();
    }, [clubId]);

    const leadership = staff.filter((member) => member.role === 'OWNER' || member.role === 'CLUB_ADMIN');
    const coaching = staff.filter((member) => member.role === 'COACH');
    const others = staff.filter((member) => member.role !== 'OWNER' && member.role !== 'CLUB_ADMIN' && member.role !== 'COACH');

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[color:var(--club-theme-text-muted)]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-6 py-12 text-center">
                <UsersRound className="h-9 w-9 text-[color:var(--club-tone-pink)]" />
                <div>
                    <h3 className="text-base font-semibold text-[color:var(--club-theme-text-primary)]">{t('clubPeople.staffUnavailable')}</h3>
                    <p className="mt-1 text-sm text-[color:var(--club-theme-text-secondary)]">{error}</p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadStaff()}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-[color:var(--club-theme-text-primary)] hover:bg-white/[0.07]"
                >
                    {t('clubPeople.tryAgain')}
                </button>
            </div>
        );
    }

    if (staff.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-6 py-14 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--club-tone-green-soft)]">
                    <UserRound className="h-8 w-8 text-[color:var(--club-tone-green)]" />
                </span>
                <div>
                    <h3 className="text-base font-semibold text-[color:var(--club-theme-text-primary)]">{t('clubPeople.emptyTitle', { clubName })}</h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                        {t('clubPeople.emptyBody')}
                    </p>
                </div>
                {isOwnClubAdmin && onOpenManageClub && (
                    <button
                        type="button"
                        onClick={() => onOpenManageClub('personnel')}
                        className="mt-1 inline-flex items-center gap-2 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green)] px-5 py-2.5 text-[11px] font-semibold text-[#04110a] transition-all hover:brightness-105"
                    >
                        <UsersRound className="h-4 w-4" />
                        {t('clubPeople.addStaff')}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-[-0.02em] text-[color:var(--club-theme-text-primary)]">{t('clubPeople.title')}</h2>
                    <p className="mt-1 text-sm text-[color:var(--club-theme-text-secondary)]">
                        {t('clubPeople.subtitle', { clubName })}
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-3 py-1 text-xs font-semibold text-[color:var(--club-theme-text-secondary)]">
                    <UsersRound className="h-3.5 w-3.5" />
                    {staff.length}
                </span>
            </header>

            {leadership.length > 0 && (
                <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-green-soft)]">
                            <Crown className="h-4 w-4 text-[color:var(--club-tone-green)]" />
                        </span>
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--club-theme-text-secondary)]">{t('clubPeople.management')}</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {leadership.map((member) => (
                            <StaffCard key={member.userId} member={member} featured={leadership.length === 1} />
                        ))}
                    </div>
                </section>
            )}

            {coaching.length > 0 && (
                <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-cyan-soft)]">
                            <UsersRound className="h-4 w-4 text-[color:var(--club-tone-cyan)]" />
                        </span>
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--club-theme-text-secondary)]">{t('clubPeople.coachingStaff')}</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {coaching.map((member) => (
                            <StaffCard key={member.userId} member={member} />
                        ))}
                    </div>
                </section>
            )}

            {others.length > 0 && (
                <section className="flex flex-col gap-3">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-blue-soft)]">
                            <UsersRound className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                        </span>
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--club-theme-text-secondary)]">{t('clubPeople.clubStaff')}</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {others.map((member) => (
                            <StaffCard key={member.userId} member={member} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};
