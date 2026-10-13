import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Loader2, Search, ShieldCheck } from 'lucide-react';
import { EntityFrame, EntityHeaderBand } from '../components/layout/EntityPageLayout';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import type { ClubMembershipContext } from '../features/clubs/domain';
import { MyClubInvitationsPanel } from '../features/invites/components/MyClubInvitationsPanel';
import { useAuth } from '../context/AuthContext';
import { ClubAccessEntry } from '../components/layout/ClubAccessEntry';
import { accessibleClubs } from '../components/layout/clubAccess';

export const MyClubPage = () => <ClubAccessEntry><SingleClubPage /></ClubAccessEntry>;

/**
 * `/my-club` for someone without a club yet. One page for everyone: find a club, create one when the server allows it,
 * and answer invitations. A role at a club comes from the club (joining, an invitation), never from what the account says.
 */
const SingleClubPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [membershipContext, setMembershipContext] = useState<ClubMembershipContext | null>(null);
    const ownClubIds = accessibleClubs(user?.navigationCapabilities).map(club=>club.id).join(',');
    const hasProjection = user?.navigationCapabilities !== undefined;

    useEffect(() => {
        let current = true;
        fetchMyClubMembershipContext()
            .then((context) => {
                if (!current) return;
                setMembershipContext(context);
                if (context?.clubId && (!hasProjection || ownClubIds.split(',').includes(String(context.clubId)))) {
                    navigate(`/clubs/${context.clubId}`, { replace: true });
                    return;
                }
                setLoading(false);
            })
            .catch(() => { if (current) setLoading(false); });
        return () => { current = false; };
    }, [navigate, ownClubIds, hasProjection]);

    if (loading) {
        return (
            <div className="flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center bg-[color:var(--theme-page)]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-[var(--color-accent)]" />
                    <p className="text-sm font-semibold text-[color:var(--text-secondary)]">Finding your club</p>
                </div>
            </div>
        );
    }

    const canCreateClub = Boolean(membershipContext?.canCreateClub);

    return (
        <div className="min-h-full bg-[color:var(--theme-page)] pb-12 text-[color:var(--text-primary)]">
            <EntityHeaderBand className="bg-[linear-gradient(110deg,color-mix(in_srgb,var(--theme-surface)_94%,var(--color-accent)_6%),var(--theme-surface))]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                            <ShieldCheck className="h-3.5 w-3.5" /> No club yet
                        </div>
                        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">My Club</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">Your club appears here once you join one, or once a club adds you. Until then, find one near you.</p>
                    </div>
                    <button type="button" onClick={() => navigate('/world/clubs')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-bold text-[var(--color-on-accent)] shadow-[0_10px_28px_color-mix(in_srgb,_var(--color-shadow)_22%,_transparent)] transition hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60">
                        <Search className="h-4 w-4" /> Find a club
                    </button>
                </div>
            </EntityHeaderBand>

            <EntityFrame className="py-6">
                <div className="mx-auto flex max-w-6xl flex-col gap-6">
                    {canCreateClub && (
                        <section className="overflow-hidden rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)]">
                            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"><Building2 className="h-5 w-5" /></div>
                                    <div>
                                        <h2 className="text-xl font-bold tracking-tight">Run a club or academy?</h2>
                                        <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">Create it here: squads, schedule, players and staff in one workspace.</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => navigate('/clubs/create')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-inset)] px-5 text-sm font-bold text-[color:var(--text-primary)] transition hover:border-[var(--color-accent)]/40">
                                    Create a club <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </section>
                    )}
                    <MyClubInvitationsPanel onInvitationAccepted={(invitation) => navigate(`/clubs/${invitation.clubId}`)} />
                </div>
            </EntityFrame>
        </div>
    );
};
