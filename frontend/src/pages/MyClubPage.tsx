import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Loader2, PlusCircle, Search, Users } from 'lucide-react';
import { EntityHeaderBand, EntityPageLayout, EntitySection } from '../components/layout/EntityPageLayout';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import type { ClubMembershipContext } from '../features/clubs/domain';
import { MyClubInvitationsPanel } from '../features/invites/components/MyClubInvitationsPanel';
import { useAuth } from '../context/AuthContext';

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
            .catch(() => {
                setLoading(false);
            });
    }, [navigate]);

    if (loading) {
        return (
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin accent-primary" />
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-secondary">Checking club workspace</p>
                </div>
            </div>
        );
    }

    const canCreateClub = Boolean(membershipContext?.canCreateClub);
    const hasNoClub = !membershipContext?.clubId;

    return (
        <div className="bg-base min-h-full">
            <EntityHeaderBand>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] accent-primary">Club Workspace Router</p>
                        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-primary">My Club</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">
                            {userRole === 'ORGANIZER'
                                ? 'This is your club command center. Create and manage your organization, review invitations, and build your squad.'
                                : userRole === 'PLAYER'
                                ? 'Find clubs to join, browse your invitations, and connect with teams looking for players like you.'
                                : 'Discover fan clubs, follow your favorite teams, and connect with fellow supporters.'}
                        </p>
                    </div>

                    <div className="border border-subtle bg-base">
                        <div className="grid divide-y divide-[color:var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Active Club</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">None</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Create Club</p>
                                <p className={`mt-2 text-xl font-black uppercase tracking-tight ${canCreateClub ? 'accent-primary' : 'text-primary'}`}>{canCreateClub ? 'Allowed' : 'Locked'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Invites</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">Review</p>
                            </div>
                        </div>
                    </div>
                </div>
            </EntityHeaderBand>

            <EntityPageLayout
                left={(
                    <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Workspace Context" title="Club Access" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
                                <span className="text-secondary">Current State</span>
                                <span className="text-primary">No Active Club</span>
                            </div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
                                <span className="text-secondary">Create Club</span>
                                <span className={canCreateClub ? 'accent-primary' : 'text-primary'}>{canCreateClub ? 'Available' : 'Unavailable'}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
                                <span className="text-secondary">Invite Review</span>
                                <span className="text-primary">Open Below</span>
                            </div>
                        </EntitySection>

                        <EntitySection eyebrow="Destination Logic" title="How This Page Behaves" bodyClassName="px-4 py-4">
                            <p className="text-sm leading-6 text-secondary">
                                Once this account joins or owns a club, this route resolves directly into the club workspace. Until then, the left rail keeps the context stable while the center remains dedicated to invite handling.
                            </p>
                        </EntitySection>
                    </div>
                )}
                center={
                    <div className="flex flex-col gap-6">
                        {hasNoClub && userRole === 'ORGANIZER' && canCreateClub && (
                            <EntitySection bodyClassName="px-8 py-10 flex flex-col items-center text-center">
                                <div className="flex h-16 w-16 items-center justify-center border-2 border-accent-primary bg-accent-primary-soft mb-5">
                                    <Building2 className="h-8 w-8 accent-primary" />
                                </div>
                                <h2 className="text-xl font-black uppercase tracking-tight text-primary">Create Your Club</h2>
                                <p className="mt-3 max-w-lg text-sm leading-6 text-secondary">
                                    Set up your squad, manage rosters, schedule matches, and invite players — all from your club workspace.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/clubs/create')}
                                    className="mt-6 inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-6 py-3 text-sm font-black uppercase tracking-[0.16em] accent-primary hover:brightness-110 transition-all"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    Create Club
                                </button>
                            </EntitySection>
                        )}
                        {hasNoClub && userRole === 'PLAYER' && (
                            <EntitySection bodyClassName="px-8 py-10 flex flex-col items-center text-center">
                                <div className="flex h-16 w-16 items-center justify-center border-2 border-accent-primary bg-accent-primary-soft mb-5">
                                    <Search className="h-8 w-8 accent-primary" />
                                </div>
                                <h2 className="text-xl font-black uppercase tracking-tight text-primary">Find Your Club</h2>
                                <p className="mt-3 max-w-lg text-sm leading-6 text-secondary">
                                    Browse clubs looking for players, respond to tryout invitations, and find the right team for your position and ambitions.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/clubs')}
                                    className="mt-6 inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-6 py-3 text-sm font-black uppercase tracking-[0.16em] accent-primary hover:brightness-110 transition-all"
                                >
                                    <Search className="h-4 w-4" />
                                    Browse Clubs
                                </button>
                            </EntitySection>
                        )}
                        {hasNoClub && userRole === 'FAN' && (
                            <EntitySection bodyClassName="px-8 py-10 flex flex-col items-center text-center">
                                <div className="flex h-16 w-16 items-center justify-center border-2 border-accent-primary bg-accent-primary-soft mb-5">
                                    <Users className="h-8 w-8 accent-primary" />
                                </div>
                                <h2 className="text-xl font-black uppercase tracking-tight text-primary">Fan Clubs</h2>
                                <p className="mt-3 max-w-lg text-sm leading-6 text-secondary">
                                    Join fanmade supporter groups, follow your favorite clubs, and connect with fellow fans. Fan club creation is coming soon.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/clubs')}
                                    className="mt-6 inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-6 py-3 text-sm font-black uppercase tracking-[0.16em] accent-primary hover:brightness-110 transition-all"
                                >
                                    <Search className="h-4 w-4" />
                                    Discover Clubs
                                </button>
                            </EntitySection>
                        )}
                        <MyClubInvitationsPanel onInvitationAccepted={(invitation) => navigate(`/clubs/${invitation.clubId}`)} />
                    </div>
                }
                right={(
                    <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Utility Layer" title="Workspace Actions" bodyClassName="px-4 py-4">
                            <div className="flex flex-col gap-2">
                                <button
                                    type="button"
                                    onClick={() => navigate('/clubs')}
                                    className="inline-flex items-center justify-between gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                >
                                    <span>Browse Clubs</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </EntitySection>
                    </div>
                )}
            />
        </div>
    );
};
