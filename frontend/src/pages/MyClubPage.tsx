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
            <div className="bg-[#0f1117] flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-[#16a34a]" />
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#a1a1aa]">Checking club workspace</p>
                </div>
            </div>
        );
    }

    const canCreateClub = Boolean(membershipContext?.canCreateClub);
    const hasNoClub = !membershipContext?.clubId;

    return (
        <div className="bg-[#0f1117] min-h-full">
            <EntityHeaderBand>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">Club Workspace Router</p>
                        <h1 className="mt-2 text-3xl font-semibold uppercase tracking-tight text-[#f4f4f5]">My Club</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#a1a1aa]">
                            {userRole === 'ORGANIZER'
                                ? 'This is your club command center. Create and manage your organization, review invitations, and build your squad.'
                                : userRole === 'PLAYER'
                                ? 'Find clubs to join, browse your invitations, and connect with teams looking for players like you.'
                                : 'Discover fan clubs, follow your favorite teams, and connect with fellow supporters.'}
                        </p>
                    </div>

                    <div className="border border-[#ffffff0d] bg-[#0f1117]">
                        <div className="grid divide-y divide-[color:#ffffff0d] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-semibold  text-[#a1a1aa]">Active Club</p>
                                <p className="mt-2 text-xl font-semibold uppercase tracking-tight text-[#f4f4f5]">None</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-semibold  text-[#a1a1aa]">Create Club</p>
                                <p className={`mt-2 text-xl font-semibold uppercase tracking-tight ${canCreateClub ? 'text-[#16a34a]' : 'text-[#f4f4f5]'}`}>{canCreateClub ? 'Allowed' : 'Locked'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-semibold  text-[#a1a1aa]">Invites</p>
                                <p className="mt-2 text-xl font-semibold uppercase tracking-tight text-[#f4f4f5]">Review</p>
                            </div>
                        </div>
                    </div>
                </div>
            </EntityHeaderBand>

            <EntityPageLayout
                left={(
                    <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Workspace Context" title="Club Access" bodyClassName="divide-y divide-[color:#ffffff0d]">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-semibold ">
                                <span className="text-[#a1a1aa]">Current State</span>
                                <span className="text-[#f4f4f5]">No Active Club</span>
                            </div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-semibold ">
                                <span className="text-[#a1a1aa]">Create Club</span>
                                <span className={canCreateClub ? 'text-[#16a34a]' : 'text-[#f4f4f5]'}>{canCreateClub ? 'Available' : 'Unavailable'}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-semibold ">
                                <span className="text-[#a1a1aa]">Invite Review</span>
                                <span className="text-[#f4f4f5]">Open Below</span>
                            </div>
                        </EntitySection>

                        <EntitySection eyebrow="Destination Logic" title="How This Page Behaves" bodyClassName="px-4 py-4">
                            <p className="text-sm leading-6 text-[#a1a1aa]">
                                Once this account joins or owns a club, this route resolves directly into the club workspace. Until then, the left rail keeps the context stable while the center remains dedicated to invite handling.
                            </p>
                        </EntitySection>
                    </div>
                )}
                center={
                    <div className="flex flex-col gap-6">
                        {hasNoClub && userRole === 'ORGANIZER' && canCreateClub && (
                            <EntitySection bodyClassName="px-8 py-10 flex flex-col items-center text-center">
                                <div className="flex h-16 w-16 items-center justify-center border-2 border-[#16a34a] bg-[#16a34a]-soft mb-5">
                                    <Building2 className="h-8 w-8 text-[#16a34a]" />
                                </div>
                                <h2 className="text-xl font-semibold uppercase tracking-tight text-[#f4f4f5]">Create Your Club</h2>
                                <p className="mt-3 max-w-lg text-sm leading-6 text-[#a1a1aa]">
                                    Set up your squad, manage rosters, schedule matches, and invite players — all from your club workspace.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/clubs/create')}
                                    className="mt-6 inline-flex items-center gap-2 border border-[#16a34a] bg-[#16a34a]-soft px-6 py-3 text-sm font-semibold  text-[#16a34a] hover:brightness-110 transition-all"
                                >
                                    <PlusCircle className="h-4 w-4" />
                                    Create Club
                                </button>
                            </EntitySection>
                        )}
                        {hasNoClub && userRole === 'PLAYER' && (
                            <EntitySection bodyClassName="px-8 py-10 flex flex-col items-center text-center">
                                <div className="flex h-16 w-16 items-center justify-center border-2 border-[#16a34a] bg-[#16a34a]-soft mb-5">
                                    <Search className="h-8 w-8 text-[#16a34a]" />
                                </div>
                                <h2 className="text-xl font-semibold uppercase tracking-tight text-[#f4f4f5]">Find Your Club</h2>
                                <p className="mt-3 max-w-lg text-sm leading-6 text-[#a1a1aa]">
                                    Browse clubs looking for players, respond to tryout invitations, and find the right team for your position and ambitions.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/clubs')}
                                    className="mt-6 inline-flex items-center gap-2 border border-[#16a34a] bg-[#16a34a]-soft px-6 py-3 text-sm font-semibold  text-[#16a34a] hover:brightness-110 transition-all"
                                >
                                    <Search className="h-4 w-4" />
                                    Browse Clubs
                                </button>
                            </EntitySection>
                        )}
                        {hasNoClub && userRole === 'FAN' && (
                            <EntitySection bodyClassName="px-8 py-10 flex flex-col items-center text-center">
                                <div className="flex h-16 w-16 items-center justify-center border-2 border-[#16a34a] bg-[#16a34a]-soft mb-5">
                                    <Users className="h-8 w-8 text-[#16a34a]" />
                                </div>
                                <h2 className="text-xl font-semibold uppercase tracking-tight text-[#f4f4f5]">Fan Clubs</h2>
                                <p className="mt-3 max-w-lg text-sm leading-6 text-[#a1a1aa]">
                                    Join fanmade supporter groups, follow your favorite clubs, and connect with fellow fans. Fan club creation is coming soon.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/clubs')}
                                    className="mt-6 inline-flex items-center gap-2 border border-[#16a34a] bg-[#16a34a]-soft px-6 py-3 text-sm font-semibold  text-[#16a34a] hover:brightness-110 transition-all"
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
                                    className="inline-flex items-center justify-between gap-2 border border-[#ffffff0d] bg-[#0f1117] px-3 py-2 text-[11px] font-semibold  text-[#f4f4f5]"
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
