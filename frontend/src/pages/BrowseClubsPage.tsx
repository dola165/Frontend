import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Check, Clock, Loader2, MapPin, Plus, Send, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { createClubApplication, fetchMyClubMembershipContext, selfRegisterClubPlayer } from '../features/clubs/api';
import type { ClubMembershipContext } from '../features/clubs/domain';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { useAuth } from '../context/AuthContext';
import { buildLoginRedirectPath } from '../utils/authRedirect';
import { extractApiErrorMessage } from '../utils/apiError';

interface ClubProfile {
    id: number;
    name: string;
    description: string;
    type: string;
    isOfficial: boolean;
    followerCount: number;
    memberCount: number;
    isFollowedByMe: boolean;
    addressText?: string;
    logoUrl?: string;
    joinPolicy?: 'OPEN_TRIAL' | 'APPLICATION_REQUIRED' | 'INVITE_ONLY';
    relationshipState?: 'NONE' | 'INVITED' | 'APPLIED' | 'TRIALIST' | 'ACTIVE' | 'LEFT' | 'REMOVED';
}

export const BrowseClubsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { status } = useAuth();
    const [clubs, setClubs] = useState<ClubProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [membershipContext, setMembershipContext] = useState<ClubMembershipContext | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [applyingClubId, setApplyingClubId] = useState<number | null>(null);
    const [joiningClubId, setJoiningClubId] = useState<number | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [actionMessageType, setActionMessageType] = useState<'success' | 'error'>('success');

    useEffect(() => {
        let active = true;

        const loadDirectory = async () => {
            setLoading(true);
            setErrorMessage(null);

            try {
                const membershipPromise =
                    status === 'authenticated'
                        ? fetchMyClubMembershipContext().catch(() => null)
                        : Promise.resolve(null);

                const [clubsResponse, membershipResponse] = await Promise.all([
                    apiClient.get<ClubProfile[]>('/clubs'),
                    membershipPromise
                ]);

                if (!active) {
                    return;
                }

                setClubs(clubsResponse.data);
                setMembershipContext(membershipResponse);
            } catch (error) {
                if (!active) {
                    return;
                }
                setClubs([]);
                setMembershipContext(null);
                setErrorMessage(extractApiErrorMessage(error, 'Failed to load the club directory.'));
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void loadDirectory();

        return () => {
            active = false;
        };
    }, [status]);

    const showActionMessage = (text: string, type: 'success' | 'error') => {
        setActionMessage(text);
        setActionMessageType(type);
        setTimeout(() => setActionMessage(null), 4000);
    };

    const handleJoinClub = async (clubId: number) => {
        if (status !== 'authenticated') {
            navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
            return;
        }
        setJoiningClubId(clubId);
        try {
            await selfRegisterClubPlayer(clubId);
            showActionMessage('Joined club as trialist.', 'success');
            setClubs((current) =>
                current.map((c) => (c.id === clubId ? { ...c, relationshipState: 'TRIALIST' as const } : c))
            );
        } catch (err) {
            showActionMessage(extractApiErrorMessage(err, 'Failed to join club.'), 'error');
        } finally {
            setJoiningClubId(null);
        }
    };

    const handleApplyClub = async (clubId: number) => {
        if (status !== 'authenticated') {
            navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
            return;
        }
        setApplyingClubId(clubId);
        try {
            await createClubApplication(clubId, 'PLAYER', null);
            showActionMessage('Application submitted.', 'success');
            setClubs((current) =>
                current.map((c) => (c.id === clubId ? { ...c, relationshipState: 'APPLIED' as const } : c))
            );
        } catch (err) {
            showActionMessage(extractApiErrorMessage(err, 'Failed to submit application.'), 'error');
        } finally {
            setApplyingClubId(null);
        }
    };

    const handleFollowToggle = async (event: React.MouseEvent, clubId: number) => {
        event.preventDefault();
        setErrorMessage(null);

        if (status !== 'authenticated') {
            navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash));
            return;
        }

        setClubs((current) =>
            current.map((club) =>
                club.id === clubId
                    ? {
                        ...club,
                        isFollowedByMe: !club.isFollowedByMe,
                        followerCount: club.isFollowedByMe ? club.followerCount - 1 : club.followerCount + 1
                    }
                    : club
            )
        );

        try {
            await apiClient.post(`/clubs/${clubId}/follow`);
        } catch (error) {
            setClubs((current) =>
                current.map((club) =>
                    club.id === clubId
                        ? {
                            ...club,
                            isFollowedByMe: !club.isFollowedByMe,
                            followerCount: club.isFollowedByMe ? club.followerCount - 1 : club.followerCount + 1
                        }
                        : club
                )
            );
            setErrorMessage(extractApiErrorMessage(error, 'Failed to update follow status.'));
        }
    };

    if (loading) {
        return (
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-secondary">Loading club directory</p>
            </div>
        );
    }

    return (
        <div className="bg-base min-h-full">
            <div className="mx-auto flex w-full flex-col gap-6 px-6 py-6 sm:px-8">
                <header className="border-b border-subtle pb-5">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] accent-primary">Destination Page</p>
                            <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-primary">Club Directory</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
                                Browse clubs as operational records first: identity, location, size, status, and actions in one scanable list.
                            </p>
                        </div>

                        <section className="bg-surface border border-subtle px-4 py-4 xl:w-[360px]">
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">My Club Workspace</p>
                            <div className="mt-3 flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center border border-subtle bg-base">
                                    <Building2 className="h-4 w-4 accent-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
                                        {status === 'authenticated'
                                            ? membershipContext?.clubName || 'No club attached'
                                            : 'Sign in required'}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-secondary">
                                        {status === 'authenticated'
                                            ? membershipContext?.clubId
                                                ? 'Open your club workspace directly or create a new one if the role allows it.'
                                                : 'Create a club or review invites from existing clubs.'
                                            : 'Sign in to manage club operations or follow directory records.'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {status !== 'authenticated' ? (
                                    <button
                                        type="button"
                                        onClick={() => navigate(buildLoginRedirectPath(location.pathname, location.search, location.hash))}
                                        className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary"
                                    >
                                        Sign In
                                    </button>
                                ) : membershipContext?.canCreateClub ? (
                                    <button
                                        type="button"
                                        onClick={() => navigate('/clubs/create')}
                                        className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Create Club
                                    </button>
                                ) : null}

                                {status === 'authenticated' && membershipContext?.clubId && (
                                    <Link
                                        to={`/clubs/${membershipContext.clubId}`}
                                        className="inline-flex items-center gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                    >
                                        Open My Club
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                )}
                            </div>
                        </section>
                    </div>
                </header>

                {errorMessage && (
                    <div className="border border-rose-300/50 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                        {errorMessage}
                    </div>
                )}

                {actionMessage && (
                    <div className={`border px-4 py-3 text-sm font-semibold ${
                        actionMessageType === 'success'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-rose-300/50 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                    }`}>
                        {actionMessage}
                    </div>
                )}

                <section className="bg-surface border border-subtle">
                        <div className="hidden border-b border-subtle px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-secondary lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:gap-4">
                        <span>Club</span>
                        <span>Description</span>
                        <span>Location</span>
                        <span>Structure</span>
                        <span>Actions</span>
                    </div>

                    {clubs.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <p className="text-sm font-semibold text-secondary">No clubs are available in the directory right now.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[color:var(--border-subtle)]">
                            {clubs.map((club) => {
                                const logoUrl = resolveMediaUrl(club.logoUrl);

                                return (
                            <article key={club.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.6fr)_150px_170px_180px] lg:items-center">
                                        <div className="min-w-0">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-subtle bg-base text-sm font-black uppercase text-primary">
                                                    {logoUrl ? (
                                                        <img src={logoUrl} alt={`${club.name} logo`} className="h-full w-full object-cover" />
                                                    ) : (
                                                        club.name.substring(0, 2).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link to={`/clubs/${club.id}`} className="truncate text-sm font-black uppercase tracking-[0.16em] text-primary hover:underline">
                                                            {club.name}
                                                        </Link>
                                                        {club.isOfficial && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] accent-primary">
                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                                Official
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">
                                                        {club.type}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-sm leading-6 text-secondary">
                                            {club.description || 'No club summary provided yet.'}
                                        </p>

                                        <div className="text-sm text-secondary">
                                            <div className="inline-flex items-center gap-1.5">
                                                <MapPin className="h-3.5 w-3.5 accent-primary" />
                                                <span>{club.addressText?.split(',')[0] || 'Location pending'}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Users className="h-3.5 w-3.5 accent-primary" />
                                                {club.memberCount} members
                                            </span>
                                            <span>{club.followerCount} followers</span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                            {/* Join / Apply */}
                                            {status === 'authenticated' && club.relationshipState === 'NONE' && club.joinPolicy === 'OPEN_TRIAL' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleJoinClub(club.id)}
                                                    disabled={joiningClubId === club.id}
                                                    className="inline-flex items-center gap-1.5 border border-accent-primary bg-accent-primary-soft px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60"
                                                >
                                                    {joiningClubId === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                                                    Join
                                                </button>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'NONE' && club.joinPolicy === 'APPLICATION_REQUIRED' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleApplyClub(club.id)}
                                                    disabled={applyingClubId === club.id}
                                                    className="inline-flex items-center gap-1.5 border border-accent-primary bg-accent-primary-soft px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] accent-primary disabled:opacity-60"
                                                >
                                                    {applyingClubId === club.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                                    Apply
                                                </button>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'ACTIVE' && (
                                                <span className="inline-flex items-center gap-1 border border-emerald-600 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                    <Check className="h-3 w-3" />
                                                    Member
                                                </span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'APPLIED' && (
                                                <span className="inline-flex items-center gap-1 border border-amber-600 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                                    <Clock className="h-3 w-3" />
                                                    Pending
                                                </span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'INVITED' && (
                                                <span className="inline-flex items-center gap-1 border border-sky-600 bg-sky-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                                                    Invited
                                                </span>
                                            )}
                                            {status === 'authenticated' && club.relationshipState === 'TRIALIST' && (
                                                <span className="inline-flex items-center gap-1 border border-purple-600 bg-purple-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                                                    Trialist
                                                </span>
                                            )}

                                            <button
                                                type="button"
                                                onClick={(event) => handleFollowToggle(event, club.id)}
                                                className={`inline-flex items-center gap-2 border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] ${
                                                    club.isFollowedByMe
                                                        ? 'border-accent-primary bg-accent-primary-soft accent-primary'
                                                        : 'border-subtle bg-base text-primary'
                                                }`}
                                            >
                                                {club.isFollowedByMe ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                                {club.isFollowedByMe ? 'Following' : 'Follow'}
                                            </button>

                                            <Link
                                                to={`/clubs/${club.id}`}
                                                className="inline-flex items-center gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                            >
                                                Open
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
