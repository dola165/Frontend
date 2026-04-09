import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Loader2, PlusCircle } from 'lucide-react';
import { CreateClubModal } from '../components/club/CreateClubModal';
import { EntityHeaderBand, EntityPageLayout, EntitySection } from '../components/layout/EntityPageLayout';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import type { ClubMembershipContext } from '../features/clubs/domain';
import { MyClubInvitationsPanel } from '../features/invites/components/MyClubInvitationsPanel';

export const MyClubPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [membershipContext, setMembershipContext] = useState<ClubMembershipContext | null>(null);
    const [isCreateClubOpen, setIsCreateClubOpen] = useState(false);

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

    return (
        <div className="bg-base min-h-full">
            <EntityHeaderBand>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] accent-primary">Club Workspace Router</p>
                        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-primary">My Club</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary">
                            This destination opens your managed club when one exists. When it does not, the page stays as a structured holding workspace for invitation review and club creation.
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
                center={<MyClubInvitationsPanel onInvitationAccepted={(invitation) => navigate(`/clubs/${invitation.clubId}`)} />}
                right={(
                    <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Utility Layer" title="Workspace Actions" bodyClassName="px-4 py-4">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center border border-subtle bg-base">
                                    <Building2 className="h-4 w-4 accent-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
                                        {canCreateClub ? 'Create or browse' : 'Browse existing clubs'}
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-secondary">
                                        Use the right rail for club creation and directory actions while the center stays focused on invite decisions.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                                {canCreateClub && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateClubOpen(true)}
                                        className="inline-flex items-center justify-between gap-2 border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <PlusCircle className="h-3.5 w-3.5" />
                                            Create Club
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </button>
                                )}
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

            <CreateClubModal
                isOpen={isCreateClubOpen}
                onClose={() => setIsCreateClubOpen(false)}
                onCreated={(clubId) => navigate(`/clubs/${clubId}`)}
            />
        </div>
    );
};
