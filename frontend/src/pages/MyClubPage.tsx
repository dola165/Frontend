import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, Loader2, MapPinned, Search, ShieldCheck, Users } from 'lucide-react';
import { EntityFrame, EntityHeaderBand } from '../components/layout/EntityPageLayout';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import type { ClubMembershipContext } from '../features/clubs/domain';
import { MyClubInvitationsPanel } from '../features/invites/components/MyClubInvitationsPanel';
import { useAuth } from '../context/AuthContext';

const journeySteps = [
    { icon: Search, title: 'Discover clubs', description: 'Explore clubs by location, level, and the way they welcome new players.' },
    { icon: MapPinned, title: 'Choose your fit', description: 'Open a club profile to understand its squads, training, and entry process.' },
    { icon: CheckCircle2, title: 'Take the next step', description: 'Join an open training session, send a request, or respond to an invitation.' }
];

export const MyClubPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const userRole = user?.role;
    const [loading, setLoading] = useState(true);
    const [membershipContext, setMembershipContext] = useState<ClubMembershipContext | null>(null);

    useEffect(() => {
        fetchMyClubMembershipContext()
            .then((context) => {
                setMembershipContext(context);
                if (context?.clubId) {
                    navigate(`/clubs/${context.clubId}`, { replace: true });
                    return;
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [navigate]);

    if (loading) {
        return (
            <div className="flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center bg-[color:var(--theme-page)]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-[#16a34a]" />
                    <p className="text-sm font-semibold text-[color:var(--text-secondary)]">Finding your club</p>
                </div>
            </div>
        );
    }

    const canCreateClub = Boolean(membershipContext?.canCreateClub);
    const isOrganizer = userRole === 'ORGANIZER';
    const isPlayer = userRole === 'PLAYER';
    const pageIntro = isOrganizer
        ? 'Create your club, review invitations, and start building your football community.'
        : isPlayer
            ? 'This is where your next club starts. Find the right team, understand how to join, and keep track of invitations.'
            : 'Discover clubs to follow and stay close to the teams and communities you care about.';

    return (
        <div className="min-h-full bg-[color:var(--theme-page)] pb-12 text-[color:var(--text-primary)]">
            <EntityHeaderBand className="bg-[linear-gradient(110deg,color-mix(in_srgb,var(--theme-surface)_94%,#16a34a_6%),var(--theme-surface))]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#16a34a]/25 bg-[#16a34a]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#3ddc78]">
                            <ShieldCheck className="h-3.5 w-3.5" /> No club yet
                        </div>
                        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--text-primary)] sm:text-4xl">My Club</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">{pageIntro}</p>
                    </div>
                    <button type="button" onClick={() => navigate('/clubs')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-5 text-sm font-bold text-white shadow-[0_10px_28px_rgba(22,163,74,0.22)] transition hover:bg-[#22b955] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]/60">
                        <Search className="h-4 w-4" /> Browse clubs
                    </button>
                </div>
            </EntityHeaderBand>

            <EntityFrame className="py-6">
                <div className="mx-auto flex max-w-6xl flex-col gap-6">
                    {isOrganizer && canCreateClub ? (
                        <section className="overflow-hidden rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)]">
                            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
                                <div>
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#16a34a]/25 bg-[#16a34a]/10 text-[#3ddc78]"><Building2 className="h-5 w-5" /></div>
                                    <h2 className="mt-5 text-2xl font-bold tracking-tight">Build your club on GrassKickZ</h2>
                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">Set up your club profile, create squads, invite players, and organize your football operations in one place.</p>
                                </div>
                                <button type="button" onClick={() => navigate('/clubs/create')} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-5 text-sm font-bold text-white transition hover:bg-[#22b955]">
                                    Create a club <ArrowRight className="h-4 w-4" />
                                </button>
                            </div>
                        </section>
                    ) : isPlayer ? (
                        <section className="overflow-hidden rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
                            <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
                                <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#3ddc78]">Find your team</p>
                                    <h2 className="mt-3 max-w-xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Your next training session could start here.</h2>
                                    <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--text-secondary)]">Browse clubs, compare their entry options, and choose the environment that fits your goals. Each club will show whether you can join training, send a request, or wait for an invitation.</p>
                                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                        <button type="button" onClick={() => navigate('/clubs')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-5 text-sm font-bold text-white transition hover:bg-[#22b955]">
                                            Explore clubs <ArrowRight className="h-4 w-4" />
                                        </button>
                                        <button type="button" onClick={() => navigate('/map')} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-inset)] px-5 text-sm font-bold text-[color:var(--text-primary)] transition hover:border-[#16a34a]/40">
                                            <MapPinned className="h-4 w-4" /> Find clubs nearby
                                        </button>
                                    </div>
                                </div>
                                <div className="border-t border-[color:var(--theme-border)] bg-[color:var(--theme-surface-inset)] p-5 sm:p-6 lg:border-l lg:border-t-0">
                                    <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">How joining works</p>
                                    <div className="mt-3 space-y-2">
                                        {journeySteps.map(({ icon: Icon, title, description }, index) => (
                                            <div key={title} className="flex gap-4 rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-4">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#16a34a]/10 text-[#3ddc78]"><Icon className="h-4 w-4" /></div>
                                                <div>
                                                    <p className="text-sm font-bold"><span className="mr-2 text-[#3ddc78]">0{index + 1}</span>{title}</p>
                                                    <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">{description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface)] p-6 sm:p-8">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#16a34a]/25 bg-[#16a34a]/10 text-[#3ddc78]"><Users className="h-5 w-5" /></div>
                            <h2 className="mt-5 text-2xl font-bold tracking-tight">Find clubs worth following</h2>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">Explore club profiles, results, events, and football communities.</p>
                        </section>
                    )}
                    <MyClubInvitationsPanel onInvitationAccepted={(invitation) => navigate(`/clubs/${invitation.clubId}`)} />
                </div>
            </EntityFrame>
        </div>
    );
};
