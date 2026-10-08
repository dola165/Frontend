import { usePostReactions } from '../hooks/usePostReactions';
import { reactionFields } from '../components/feed/reactions';
import { usePagedProfilePosts } from '../hooks/usePagedProfilePosts';
import { ProfilePostPagination } from '../components/profile/ProfilePostPagination';
import '../components/profile/profile-layout.css';
import { RepresentationPanel, RepresentationShortcut } from '../features/agents/RepresentationPanel';
import { ClubApproachesPanel } from '../features/agents/ClubApproachesPanel';
import { ReportControl } from '../features/moderation/Reporting';
import { ConnectionsDialog } from '../components/profile/ConnectionsDialog';
import { RoleProfileSummary } from '../features/roles/RoleProfileSummary';
import { ProfileCareer } from '../features/roles/ProfileCareer';
import { roleLabel, profileRoles, isProfessionalRole, type FootballProfile, type RoleProfile } from '../features/roles/domain';
import { formatDate } from '../utils/formatting';
import { ImageCropperModal } from '../ui/ImageCropperModal';
import { CROP_IMAGE_ACCEPT } from '../utils/cropImageHelper';
import { useIdentityImageEditor } from '../hooks/useIdentityImageEditor';
import { MediaImage } from '../components/ui/MediaImage';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Activity,
    ArrowLeft,
    BarChart3,
    BellRing,
    Building2,
    Camera,
    Film,
    Footprints,
    Image,
    Loader2,
    MapPin,
    MessageCircle,
    PlayCircle,
    Ruler,
    Share2,
    ShieldCheck,
    Trophy,
    UserRound,
    Users,
    Weight
} from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { FeedPost, type FeedPostDto, type CommentDto } from '../components/feed/FeedPost';
import { PostComposer } from '../components/feed/PostComposer';
import { PostTheaterModal } from '../components/PostTheaterModal';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import { extractApiErrorMessage } from '../utils/apiError';
import { getStoredUserId, setStoredUserId } from '../utils/authStorage';
import { StatusBadge } from '../components/ui/StatusBadge';

interface CareerHistoryDto {
    id: number;
    clubName: string;
    season: string;
    category: string;
    appearances: number;
    goals: number;
    assists: number;
    cleanSheets: number;
}

interface UserProfile {
    footballProfile?: FootballProfile | null;
    roleProfiles?: RoleProfile[];
    id: number;
    username: string;
    fullName?: string | null;
    role: string;
    position?: string | null;
    secondaryPosition?: string | null;
    preferredFoot?: string | null;
    bio?: string | null;
    availabilityStatus?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    followerCount: number;
    followingCount: number;
    isFollowedByMe: boolean;
    careerHistory?: CareerHistoryDto[];
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    dateOfBirth?: string | null;
    isPrivate?: boolean;
}

type ProfileTab = 'about' | 'stats' | 'images' | 'videos';

interface MediaEntry {
    key: string;
    postId: number;
    url: string;
    kind: 'image' | 'video';
    createdAt: string;
    summary: string;
}

interface FollowedClubBrief {
    id: number;
    name: string;
    logoUrl?: string | null;
    cityName?: string | null;
    countryName?: string | null;
}

const normalizeTab = (value: string | null): ProfileTab => {
    if (value === 'stats' || value === 'career' || value === 'portfolio') return 'stats';
    if (value === 'images' || value === 'media') return 'images';
    if (value === 'videos') return 'videos';
    return 'about'; // default + legacy 'feed'/'timeline'
};

const timeAgo = (iso: string, t: (key: string, options?: Record<string, unknown>) => string): string => {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const minutes = Math.floor((Date.now() - then) / 60000);
    if (minutes < 1) return t('userProfile.justNow');
    if (minutes < 60) return t('userProfile.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('userProfile.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('userProfile.daysAgo', { count: days });
    return formatDate(iso);
};

const StatCard = ({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) => (
    <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-4 py-3.5">
        <div className="flex items-center gap-2 text-[color:var(--club-theme-text-secondary)]">
            <Icon className="h-4 w-4" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{label}</span>
        </div>
        <p className="mt-2 text-xl font-bold text-[color:var(--club-theme-text-primary)]">{value}</p>
    </div>
);

const CareerEntryCard = ({ entry }: { entry: CareerHistoryDto }) => (
    <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[color:var(--club-tone-green)]" />
                    <p className="text-sm font-semibold text-[color:var(--club-theme-text-primary)]">{entry.clubName}</p>
                </div>
                <p className="mt-1 text-[11px] font-medium text-[color:var(--club-theme-text-secondary)]">{entry.season} · {entry.category}</p>
            </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--club-theme-text-primary)]">
                {entry.appearances} apps
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--club-theme-text-primary)]">
                {entry.goals} goals
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--club-theme-text-primary)]">
                {entry.assists} ast
            </span>
            {entry.cleanSheets > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--club-theme-text-primary)]">
                    {entry.cleanSheets} cs
                </span>
            )}
        </div>
    </div>
);

export const UserProfilePage = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const bannerInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [profileError, setProfileError] = useState('');

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const postPages = usePagedProfilePosts(`/posts/user/${id}`);
    const { posts, setPosts } = postPages;
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(getStoredUserId());
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [commentsErrors, setCommentsErrors] = useState<Record<number, string | null>>({});
    const [commentsLoading, setCommentsLoading] = useState<Record<number, boolean>>({});
    const [pendingLikes, setPendingLikes] = useState<Record<number, boolean>>({});
    const [likeErrors, setLikeErrors] = useState<Record<number, string | null>>({});
    const [followedClubs, setFollowedClubs] = useState<FollowedClubBrief[]>([]);
    const [followedClubsLoading, setFollowedClubsLoading] = useState(false);
    const [detailsExpanded, setDetailsExpanded] = useState(searchParams.has('representation'));

    useEffect(() => {
        if (!profile?.id || !searchParams.has('representation')) return;
        const frame = requestAnimationFrame(() => document.getElementById('representation')?.scrollIntoView({ block: 'center' }));
        return () => cancelAnimationFrame(frame);
    }, [profile?.id, searchParams]);

    useEffect(() => {
        setCommentsData({}); setCommentsErrors({}); setCommentsLoading({}); setOpenComments({}); setPendingLikes({}); setLikeErrors({}); setSelectedPost(null);
    }, [postPages.pageKey]);

    const connections = searchParams.get('connections');
    const setConnections = (kind: 'followers' | 'following' | null) => {
        const params = new URLSearchParams(searchParams);
        if (kind) params.set('connections', kind); else params.delete('connections');
        setSearchParams(params, { replace: true, preventScrollReset: true });
    };
    const requestedTab = normalizeTab(searchParams.get('tab'));
    const isMyProfile = profile != null && String(profile.id) === currentUserId;

    useEffect(() => {
        if (!isMyProfile) {
            setFollowedClubs([]);
            return;
        }
        let cancelled = false;
        setFollowedClubsLoading(true);
        apiClient.get<FollowedClubBrief[]>('/clubs/followed')
            .then((res) => {
                if (!cancelled) setFollowedClubs(res.data);
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setFollowedClubsLoading(false);
            });
        return () => { cancelled = true; };
    }, [isMyProfile]);

    const loadComments = async (postId: number, force = false) => {
        if (commentsData[postId] && !force) return;

        setCommentsLoading((current) => ({ ...current, [postId]: true }));
        setCommentsErrors((current) => ({ ...current, [postId]: null }));
        try {
            const res = await apiClient.get<CommentDto[]>(`/posts/${postId}/comments`);
            setCommentsData((prev) => ({ ...prev, [postId]: res.data }));
        } catch (err) {
            setCommentsErrors((current) => ({ ...current, [postId]: extractApiErrorMessage(err, 'Comments could not load.') }));
        } finally {
            setCommentsLoading((current) => ({ ...current, [postId]: false }));
        }
    };

    const fetchProfile = useCallback(async (showLoading = true, signal?: AbortSignal) => {
        if (!id) return;

        if (showLoading) {
            setLoading(true);
        }

        try {
            const userRes = await apiClient.get(`/users/${id}`, { signal });
            if (signal?.aborted) return;
            setProfile(userRes.data);
        } catch (err) {
            if (signal?.aborted) return;
            console.error('Failed to fetch user profile', err);
            setProfile(null);
            setCommentsData({});
        } finally {
            if (showLoading && !signal?.aborted) {
                setLoading(false);
            }
        }
    }, [id]);

    useEffect(() => {
        const controller = new AbortController();
        apiClient.get('/users/me', { signal: controller.signal })
            .then((res) => {
                if (!controller.signal.aborted && res.data?.id != null) {
                    const userId = String(res.data.id);
                    setCurrentUserId(userId);
                    setStoredUserId(userId);
                }
            })
            .catch(() => undefined);

        void fetchProfile(true, controller.signal);
        return () => controller.abort();
    }, [fetchProfile]);

    const setActiveTab = (tab: ProfileTab) => {
        const nextParams = new URLSearchParams(searchParams);
        if (tab === 'about') {
            nextParams.delete('tab');
        } else {
            nextParams.set('tab', tab);
        }
        setSearchParams(nextParams, { replace: true });
    };

    const imageEditor = useIdentityImageEditor(async (type, url) => {
        if (!isMyProfile) throw new Error('You can only change your own profile photos.');
        const field = type === 'avatar' ? 'avatarUrl' : 'bannerUrl';
        await apiClient.put('/users/me', { [field]: url });
        setProfile(current => current?.id === profile?.id ? { ...current, [field]: url } : current);
    }, `user:${id}:${currentUserId}`);
    const { uploading } = imageEditor;
    const handleImageUpload = (event: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (isMyProfile) void imageEditor.select(file, type);
    };

    const handleFollowToggle = async () => {
        if (!profile) return;
        const previousFollowed = profile.isFollowedByMe;
        const previousCount = profile.followerCount;

        setProfile({
            ...profile,
            isFollowedByMe: !previousFollowed,
            followerCount: previousFollowed ? previousCount - 1 : previousCount + 1
        });

        try {
            await apiClient.post(`/users/${profile.id}/follow`);
        } catch {
            setProfile({
                ...profile,
                isFollowedByMe: previousFollowed,
                followerCount: previousCount
            });
        }
    };

    const reactions = usePostReactions(postPages.pageKey, saved => {
        const update = (post: FeedPostDto) => post.id === saved.id ? reactionFields(post, saved) : post;
        setPosts(current => current.map(update));
        setSelectedPost(current => current ? update(current) : null);
    });

    const handleLikeToggle = async (postId: number) => {
        if (pendingLikes[postId]) return;
        const currentPost = posts.find((post) => post.id === postId) ?? (selectedPost?.id === postId ? selectedPost : null);
        if (!currentPost) return;
        const previous = currentPost.isLikedByMe;
        const desired = !previous;
        const applyState = (liked: boolean) => {
            const update = (post: FeedPostDto) => post.id !== postId || post.isLikedByMe === liked ? post : {
                ...post,
                isLikedByMe: liked,
                likeCount: Math.max(0, post.likeCount + (liked ? 1 : -1)),
            };
            setPosts((current) => current.map(update));
            setSelectedPost((current) => current ? update(current) : null);
        };
        setPendingLikes((current) => ({ ...current, [postId]: true }));
        setLikeErrors((current) => ({ ...current, [postId]: null }));
        applyState(desired);

        try {
            const response = await apiClient.put<{ isLiked: boolean }>(`/posts/${postId}/like`, { liked: desired });
            applyState(response.data.isLiked);
        } catch (error) {
            applyState(previous);
            setLikeErrors((current) => ({ ...current, [postId]: extractApiErrorMessage(error, 'Like could not be saved. Your previous choice was restored.') }));
        } finally {
            setPendingLikes((current) => ({ ...current, [postId]: false }));
        }
    };

    const toggleComments = async (postId: number) => {
        const isOpen = openComments[postId];
        setOpenComments((prev) => ({ ...prev, [postId]: !isOpen }));
        if (!isOpen) {
            await loadComments(postId);
        }
    };

    const submitComment = async (postId: number, content: string) => {
        const res = await apiClient.post<CommentDto>(`/posts/${postId}/comments`, { content });
        setCommentsData((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
        setPosts((current) => current.map((post) => (post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post)));
        setSelectedPost((current) => current?.id === postId ? { ...current, commentCount: current.commentCount + 1 } : current);
    };

    const mediaEntries = useMemo<MediaEntry[]>(() => (
        posts.flatMap((post) => {
            const urls = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.image ? [post.image] : [];

            return urls.map((url, index) => {
                const resolvedUrl = resolveMediaUrl(url) || url;
                return {
                    key: `${post.id}-${index}`,
                    postId: post.id,
                    url,
                    kind: /\.(mp4|mov|webm)(?:[?#].*)?$/i.test(resolvedUrl) ? 'video' : 'image',
                    createdAt: post.createdAt,
                    summary: post.content || 'Profile media'
                };
            });
        })
    ), [posts]);

    const imageEntries = useMemo(() => mediaEntries.filter((entry) => entry.kind === 'image'), [mediaEntries]);
    const videoEntries = useMemo(() => mediaEntries.filter((entry) => entry.kind === 'video'), [mediaEntries]);

    const recentPosts = useMemo(
        () => [...posts]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5),
        [posts]
    );

    const careerTotals = useMemo(() => {
        return (profile?.careerHistory || []).reduce((acc, item) => ({
            clubs: acc.clubs + 1,
            appearances: acc.appearances + item.appearances,
            goals: acc.goals + item.goals,
            assists: acc.assists + item.assists,
            cleanSheets: acc.cleanSheets + item.cleanSheets
        }), {
            clubs: 0,
            appearances: 0,
            goals: 0,
            assists: 0,
            cleanSheets: 0
        });
    }, [profile?.careerHistory]);

    const renderMediaGrid = (entries: MediaEntry[]) => (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {entries.map((entry) => {
                const mediaUrl = resolveMediaUrl(entry.url) || entry.url;
                const relatedPost = posts.find((post) => post.id === entry.postId) || null;

                return (
                    <button
                        key={entry.key}
                        type="button"
                        aria-label={entry.kind === 'video' ? `Open video from post ${entry.postId}` : `View image from post ${entry.postId}`}
                        onClick={() => {
                            setSelectedPost(relatedPost);
                            if (relatedPost) {
                                void loadComments(relatedPost.id);
                            }
                        }}
                        className="group relative overflow-hidden rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] aspect-square"
                    >
                        {entry.kind === 'video' ? (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[color:var(--color-elevated)]/85 px-2 text-center text-[color:var(--color-text)]">
                                <PlayCircle className="h-10 w-10" aria-hidden="true" />
                                <span className="text-xs font-semibold">Video · Open to play</span>
                            </div>
                        ) : (
                            <MediaImage src={mediaUrl} alt="Profile media" loading="lazy" className="h-full w-full object-cover" />
                        )}
                        {entry.kind === 'image' && <div className="absolute inset-0 bg-[color:var(--color-overlay)]/0 transition-colors group-hover:bg-[color:var(--color-overlay)]/40 flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-[color:var(--color-text)] uppercase tracking-[0.08em] transition-opacity">
                                View Post
                            </span>
                        </div>}
                    </button>
                );
            })}
        </div>
    );

    const handleShare = async () => {
        if (!profile) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${profile.fullName || profile.username} — GrassKickZ`,
                    url: window.location.href,
                });
            } catch {
                // user cancelled
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                setProfileError('Profile link copied to clipboard.');
                setTimeout(() => setProfileError(''), 3000);
            } catch {
                setProfileError('Failed to copy link.');
                setTimeout(() => setProfileError(''), 3000);
            }
        }
    };

    // --- Loading state ---
    if (loading) {
        return (
            <div className="club-page-shell bg-[var(--color-surface)] flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
            </div>
        );
    }

    // --- Not-found state ---
    if (!profile) {
        return (
            <div className="club-page-shell bg-[var(--color-surface)] flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className="bg-[var(--color-surface)] border border-[color-mix(in_srgb,_var(--color-border)_5.1%,_transparent)] px-8 py-10 text-center">
                    <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-[var(--color-accent)]" />
                    <h2 className="text-xl font-semibold  text-[var(--color-text)]">Profile Not Found</h2>
                    <button type="button" onClick={() => navigate(-1)} className="mt-4 text-sm font-semibold  text-[var(--color-accent)]">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const displayName = profile.fullName || profile.username;
    const initials = displayName.substring(0, 2).toUpperCase();
    const bannerUrl = resolveMediaUrl(profile.bannerUrl);
    const avatarUrl = resolveMediaUrl(profile.avatarUrl);
    const playerAge = profile.dateOfBirth
        ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / 31556952000)
        : null;

    const identities = profileRoles(profile);
    const canSeeDetails = !profile.isPrivate || isMyProfile;
    const isPlayer = canSeeDetails && identities.includes('PLAYER');
    const isProfessional = canSeeDetails && (identities.some(isProfessionalRole) || (isMyProfile && !!profile.footballProfile?.entries.length));
    const activeTab = requestedTab === 'stats' && !isProfessional ? 'about' : requestedTab;

    const tabs: Array<{ id: ProfileTab; label: string; icon: typeof Activity }> = [
        { id: 'about', label: t('userProfile.tabs.about'), icon: UserRound },
        ...(isProfessional ? [{ id: 'stats' as ProfileTab, label: 'Career', icon: Trophy }] : []),
        { id: 'images', label: t('userProfile.tabs.images'), icon: Image },
        { id: 'videos', label: t('userProfile.tabs.videos'), icon: Film },
    ];

    // --- Left Panel content ---
    const leftPanel = (
        <div className="flex flex-col gap-4">
            {profile.isPrivate && !isMyProfile && (
                <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-4 py-3">
                    <p className="text-sm font-semibold text-[color:var(--club-theme-text-primary)]">This profile is private.</p>
                    <p className="mt-1 text-xs text-[color:var(--club-theme-text-muted)]">
                        Only basic identity details are shown. Photos, personal details, and personal posts are private.
                    </p>
                </div>
            )}
            {(!profile.isPrivate || isMyProfile) && <>
                                    <RoleProfileSummary profiles={profile.roleProfiles ?? []} />
                                    {isMyProfile && <Link to="/account/roles" className="text-sm font-semibold text-[var(--club-tone-green)]">Edit football roles →</Link>}
                                    <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            <UserRound className="h-4 w-4 text-[color:var(--club-tone-green)]" />
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--club-theme-text-muted)]">{t('userProfile.aboutTitle')}</p>
                                        </div>
                                        <p className="mt-3 text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                                            {profile.bio || t('userProfile.bioEmpty')}
                                        </p>
                                        {profile.availabilityStatus && (
                                            <p className="mt-3 text-xs font-semibold text-[color:var(--club-tone-green)]">{profile.availabilityStatus}</p>
                                        )}
                                    </div>

                                    {isProfessional && <ProfileCareer key={`overview-${profile.id}`} profile={profile} isMyProfile={isMyProfile} compact={activeTab !== 'stats'} onChanged={footballProfile => setProfile(current => current?.id === profile.id ? { ...current, footballProfile } : current)} />}
                                    {activeTab === 'stats' && isPlayer && <>
                                    {/* Career totals */}
                                    <div className="profile-stat-grid">
                                        <StatCard icon={Building2} label="Clubs" value={careerTotals.clubs} />
                                        <StatCard icon={Activity} label="Apps" value={careerTotals.appearances} />
                                        <StatCard icon={Trophy} label="Goals" value={careerTotals.goals} />
                                        <StatCard icon={Users} label="Assists" value={careerTotals.assists} />
                                        <StatCard icon={ShieldCheck} label="Clean Sheets" value={careerTotals.cleanSheets} />
                                    </div>

                                    {/* Career history */}
                                    {(profile.careerHistory || []).length === 0 ? (
                                        <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-5 py-12 text-center">
                                            <BarChart3 className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-muted)]" />
                                            <p className="mt-4 text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                                                Career history has not been published for this profile yet.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {(profile.careerHistory || []).map((entry) => (
                                                <CareerEntryCard key={entry.id} entry={entry} />
                                            ))}
                                        </div>
                                    )}
                                    </>}
            </>}
            <RepresentationPanel profileId={profile.id} own={isMyProfile} roles={profileRoles(profile)} />
            {isMyProfile && <ClubApproachesPanel mode="participant" />}
            {/* Followed clubs — real follow data on the owner's own profile */}
            {isMyProfile && (
                <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] p-5">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--club-theme-text-muted)]">Followed clubs</p>
                        {followedClubs.length > 0 && (
                            <Link to="/clubs/following" className="text-[11px] font-semibold text-[color:var(--club-tone-green)] hover:underline">
                                View all
                            </Link>
                        )}
                    </div>
                    {followedClubsLoading ? (
                        <div className="mt-3 flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-[color:var(--club-theme-text-muted)]" />
                        </div>
                    ) : followedClubs.length === 0 ? (
                        <div className="mt-3">
                            <p className="text-xs leading-5 text-[color:var(--club-theme-text-secondary)]">
                                You haven't followed any clubs yet. Follow clubs to keep their updates close.
                            </p>
                            <Link to="/clubs" className="mt-2 inline-flex text-[11px] font-semibold text-[color:var(--club-tone-green)] hover:underline">
                                Find clubs to follow
                            </Link>
                        </div>
                    ) : (
                        <ul className="mt-3 space-y-2.5">
                            {followedClubs.slice(0, 5).map((club) => {
                                const clubLogoUrl = resolveMediaUrl(club.logoUrl);
                                const clubLocation = [club.cityName, club.countryName].filter(Boolean).join(', ');
                                return (
                                    <li key={club.id}>
                                        <Link to={`/clubs/${club.id}`} className="group flex items-center gap-2.5">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] text-[10px] font-bold text-[color:var(--club-theme-text-primary)]">
                                                {clubLogoUrl ? <MediaImage src={clubLogoUrl} alt="" className="h-full w-full object-cover" /> : club.name.substring(0, 2).toUpperCase()}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-xs font-semibold text-[color:var(--club-theme-text-primary)] group-hover:underline">{club.name}</span>
                                                {clubLocation && (
                                                    <span className="block truncate text-[10px] text-[color:var(--club-theme-text-muted)]">{clubLocation}</span>
                                                )}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            {/* Player details */}
            {isPlayer && (
                <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--club-theme-text-muted)] mb-3">Player Profile</p>
                    <div className="space-y-3">
                        {profile.position && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-green-soft)]">
                                    <MapPin className="h-4 w-4 text-[color:var(--club-tone-green)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[color:var(--club-theme-text-primary)]">{profile.position}</p>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">Primary Position</p>
                                </div>
                            </div>
                        )}
                        {playerAge != null && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-cyan-soft)]">
                                    <span className="text-xs font-bold text-[color:var(--club-tone-cyan)]">{playerAge}</span>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[color:var(--club-theme-text-primary)]">{playerAge} years</p>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">Age</p>
                                </div>
                            </div>
                        )}
                        {profile.preferredFoot && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-blue-soft)]">
                                    <Footprints className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[color:var(--club-theme-text-primary)]">{profile.preferredFoot}</p>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">Preferred Foot</p>
                                </div>
                            </div>
                        )}
                        {profile.heightCm && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-accent-orange-soft)]">
                                    <Ruler className="h-4 w-4 text-[color:var(--club-accent-orange)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[color:var(--club-theme-text-primary)]">{profile.heightCm} cm</p>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">Height</p>
                                </div>
                            </div>
                        )}
                        {profile.weightKg && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-purple-soft)]">
                                    <Weight className="h-4 w-4 text-[color:var(--club-tone-purple)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[color:var(--club-theme-text-primary)]">{profile.weightKg} kg</p>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">Weight</p>
                                </div>
                            </div>
                        )}
                        {profile.availabilityStatus && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-green-soft)]">
                                    <Activity className="h-4 w-4 text-[color:var(--club-tone-green)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[color:var(--club-theme-text-primary)]">{profile.availabilityStatus}</p>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">Availability</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Career context — PLAYER only */}
            {isPlayer && (
            <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--club-theme-text-muted)] mb-3">Recent Career</p>
                {(profile.careerHistory || []).length === 0 ? (
                    <p className="text-xs leading-5 text-[color:var(--club-theme-text-secondary)]">No career history published yet.</p>
                ) : (
                    <div className="space-y-2">
                        {(profile.careerHistory || []).slice(0, 3).map((entry) => (
                            <div key={entry.id} className="flex items-center gap-2 text-xs">
                                <Building2 className="h-3.5 w-3.5 shrink-0 text-[color:var(--club-tone-green)]" />
                                <span className="font-semibold text-[color:var(--club-theme-text-primary)]">{entry.clubName}</span>
                                <span className="text-[color:var(--club-theme-text-muted)]">{entry.season}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            )}
        </div>
    );

    // --- Right Panel content: recent activity (latest public posts) ---
    const openPost = (post: FeedPostDto) => {
        setSelectedPost(post);
        void loadComments(post.id);
    };

    const rightPanel = (
        <div className="flex flex-col gap-4">
            <section className="overflow-hidden rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)]">
                <div className="flex items-center gap-2 border-b border-[color:var(--club-theme-border-subtle)] px-4 py-3.5">
                    <Activity className="h-3.5 w-3.5 text-[color:var(--club-tone-green)]" />
                    <span className="text-[11px] font-semibold text-[color:var(--club-tone-green)]">{t('userProfile.recentActivity')}</span>
                </div>
                {recentPosts.length === 0 ? (
                    <p className="px-4 py-5 text-xs leading-5 text-[color:var(--club-theme-text-muted)]">
                        {t('userProfile.recentActivityEmpty')}
                    </p>
                ) : (
                    <ul className="divide-y divide-[color:var(--club-theme-border-subtle)]">
                        {recentPosts.map((post) => (
                            <li key={post.id}>
                                <button
                                    type="button"
                                    onClick={() => openPost(post)}
                                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[color:var(--color-ink)]/[0.03]"
                                >
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--club-tone-green-soft)]">
                                        {(post.mediaUrls && post.mediaUrls.length > 0) || post.image ? (
                                            <Image className="h-3.5 w-3.5 text-[color:var(--club-tone-green)]" />
                                        ) : (
                                            <Activity className="h-3.5 w-3.5 text-[color:var(--club-tone-green)]" />
                                        )}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="line-clamp-2 text-xs leading-5 text-[color:var(--club-theme-text-secondary)]">
                                            {post.content || t('userProfile.sharedMedia')}
                                        </span>
                                        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[color:var(--club-theme-text-muted)]">
                                            {timeAgo(post.createdAt, t)}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );

    // --- Client-side action buttons ---
    const systemBtnClass = 'inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)]/8 bg-[color:var(--color-ink)]/[0.04] px-4 py-3 text-[11px] font-semibold  text-[color:var(--club-theme-text-primary)] transition-colors hover:bg-[color:var(--color-ink)]/[0.07]';
    const accentBtnClass = 'inline-flex items-center gap-2 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green)] px-5 py-3 text-[11px] font-semibold  text-[var(--color-on-accent)] transition-all hover:brightness-105';

    return (
        <div className="club-page-shell min-h-full bg-[color:var(--club-theme-base)]">
            {(connections === 'followers' || connections === 'following') && (!profile.isPrivate || isMyProfile) && <ConnectionsDialog key={`${profile.id}-${connections}`} userId={profile.id} kind={connections} showFollowingStatus={connections === 'following' && isMyProfile} onClose={() => setConnections(null)} />}
            {/* Error toast */}
            {profileError && (
                <div className="mt-4 flex w-full items-center gap-3 rounded-[4px] border border-[color:var(--state-danger)]/30 bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                    {profileError}
                </div>
            )}

            {/* ===== HERO SECTION ===== */}
            <section className="border-b border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-band)]">
                {/* Banner area */}
                <div className={`relative overflow-hidden ${bannerUrl ? 'h-[200px] sm:h-[240px]' : 'h-[120px] sm:h-[150px]'}`}>
                    {bannerUrl ? (
                        <MediaImage src={bannerUrl} alt={`${displayName} banner`} className="h-full w-full object-cover object-top" />
                    ) : (
                        <div className="h-full w-full bg-[color:var(--club-theme-surface)]" />
                    )}

                    {/* Gradient overlay blends into the current theme */}
                    <div className="absolute inset-0 bg-[image:var(--color-hero-scrim)]" />

                    {/* Ambient radial glows */}
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,_var(--color-info)_8%,_transparent),transparent_30%),radial-gradient(circle_at_top_left,color-mix(in_srgb,_var(--color-accent)_8%,_transparent),transparent_26%)]" />

                    {/* Back button */}
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-on-media)]/20 bg-[color:var(--color-overlay)]/75 px-3 py-2 text-[11px] font-semibold text-[color:var(--color-on-media)] backdrop-blur-md transition-colors hover:bg-[color:var(--color-overlay)]/90"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>

                    {/* Edit Banner button */}
                    {isMyProfile && (
                        <div className="absolute right-5 top-5 z-10">
                            <button
                                type="button"
                                onClick={() => bannerInputRef.current?.click()}
                                disabled={!!uploading}
                                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-on-media)]/20 bg-[color:var(--color-overlay)]/75 px-3 py-2 text-[11px] font-semibold text-[color:var(--color-on-media)] backdrop-blur-md transition-colors hover:bg-[color:var(--color-overlay)]/90"
                            >
                                {uploading === 'banner' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                Banner
                            </button>
                            <input type="file" ref={bannerInputRef} className="hidden" accept={CROP_IMAGE_ACCEPT} onChange={(event) => handleImageUpload(event, 'banner')} />
                        </div>
                    )}
                </div>

                {/* Hero content area */}
                <div className="bg-[color:var(--club-theme-surface)]">
                    <div className="club-profile-frame mx-auto relative w-full py-6 lg:py-8">
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                            {/* Left: Avatar + Identity */}
                            <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
                                {/* Avatar — overlaps banner bottom */}
                                <div className="relative -mt-[76px] shrink-0 sm:-mt-[96px] lg:-mt-[112px]">
                                    <div className="h-24 w-24 sm:h-28 sm:w-28 lg:h-36 lg:w-36 overflow-hidden rounded-xl border-[5px] border-[color:var(--club-band)] bg-[color-mix(in_srgb,_var(--color-page)_92%,_transparent)] shadow-[0_18px_44px_color-mix(in_srgb,_var(--color-shadow)_35%,_transparent)]">
                                        {avatarUrl ? (
                                            <MediaImage src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold uppercase text-[color:var(--club-theme-text-primary)]">
                                                {initials}
                                            </div>
                                        )}
                                    </div>
                                    {isMyProfile && (
                                        <>
                                            <button
                                                type="button"
                                                aria-label="Change profile photo"
                                                onClick={() => avatarInputRef.current?.click()}
                                                disabled={!!uploading}
                                                className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-elevated)] text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-inset)]"
                                            >
                                                {uploading === 'avatar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                            </button>
                                            <input type="file" ref={avatarInputRef} className="hidden" accept={CROP_IMAGE_ACCEPT} onChange={(event) => handleImageUpload(event, 'avatar')} />
                                        </>
                                    )}
                                </div>

                                {/* Identity */}
                                <div className="min-w-0 pb-2">
                                    <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[color:var(--club-theme-text-primary)] sm:text-5xl">
                                        {displayName}
                                    </h1>
                                    <p className="mt-0.5 text-sm text-[color:var(--club-theme-text-secondary)]">@{profile.username}</p>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {identities.map(role => <StatusBadge key={role} tone={isProfessionalRole(role) ? 'success' : 'neutral'}>{roleLabel(role)}</StatusBadge>)}
                                        {profile.availabilityStatus && <StatusBadge tone="info">{profile.availabilityStatus}</StatusBadge>}
                                    </div>

                                    {(profile.position || profile.secondaryPosition) && (
                                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold  text-[color:var(--club-theme-text-secondary)]">
                                            {profile.position && <span>{profile.position}</span>}
                                            {profile.secondaryPosition && (
                                                <>
                                                    <span className="h-1 w-1 rounded-full bg-[color:var(--club-divider-dot)]" />
                                                    <span>{profile.secondaryPosition}</span>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                                        <button type="button" onClick={() => setConnections('followers')} disabled={profile.isPrivate && !isMyProfile} className="rounded-md px-1 py-2 hover:underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] disabled:cursor-default disabled:no-underline" title={profile.isPrivate && !isMyProfile ? 'Connections are private' : undefined}>
                                            <strong>{profile.followerCount}</strong> <span className="text-[color:var(--club-theme-text-secondary)]">{t('userProfile.followers')}</span>
                                        </button>
                                        <span className="h-1 w-1 rounded-full bg-[color:var(--club-divider-dot)]" />
                                        <button type="button" onClick={() => setConnections('following')} disabled={profile.isPrivate && !isMyProfile} className="rounded-md px-1 py-2 hover:underline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] disabled:cursor-default disabled:no-underline" title={profile.isPrivate && !isMyProfile ? 'Connections are private' : undefined}>
                                            <strong>{profile.followingCount}</strong> <span className="text-[color:var(--club-theme-text-secondary)]">{t('userProfile.following')}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Action buttons */}
                            <div className="flex flex-wrap gap-2">
                                {isMyProfile ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/account?tab=profile')}
                                            className={systemBtnClass}
                                        >
                                            <ShieldCheck className="h-4 w-4" />
                                            Account Center
                                        </button>
                                        <Link to="/reports" className={systemBtnClass}>Reports &amp; safety</Link>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/notifications?scope=personal')}
                                            className={systemBtnClass}
                                        >
                                            <BellRing className="h-4 w-4" />
                                            Notifications
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleFollowToggle}
                                            className={profile.isFollowedByMe ? systemBtnClass : accentBtnClass}
                                        >
                                            {profile.isFollowedByMe ? 'Following' : 'Follow'}
                                        </button>
                                        <ReportControl targetType="ACCOUNT" targetId={profile.id} personId={profile.id} className={systemBtnClass} />
                                        <RepresentationShortcut profileId={profile.id} className={accentBtnClass} onOpen={() => { setDetailsExpanded(true); requestAnimationFrame(() => document.getElementById('representation')?.scrollIntoView({block:'center',behavior:'smooth'})); }} />
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/messages?chatWith=${profile.id}`)}
                                            className={systemBtnClass}
                                        >
                                            <MessageCircle className="h-4 w-4" />
                                            Message
                                        </button>
                                    </>
                                )}
                                <button type="button" onClick={handleShare} className={systemBtnClass}>
                                    <Share2 className="h-4 w-4" />
                                    Share
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== STICKY TAB BAR ===== */}
            <div className="border-b border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-surface)]">
                <div className="club-profile-frame mx-auto w-full overflow-x-auto">
                    <div role="tablist" aria-label="Profile sections" className="flex min-w-max items-stretch gap-2.5 py-3">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    role="tab"
                                    id={`profile-tab-${tab.id}`}
                                    aria-selected={isActive}
                                    aria-controls="profile-tab-panel"
                                    tabIndex={isActive ? 0 : -1}
                                    onKeyDown={event => {
                                        const index = tabs.findIndex(item => item.id === tab.id);
                                        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                                            : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
                                            : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
                                        if (next === null) return;
                                        event.preventDefault();
                                        document.getElementById(`profile-tab-${tabs[next].id}`)?.focus();
                                    }}
                                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-left text-[12px] font-semibold transition-all ${
                                        isActive
                                            ? 'border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green-soft)] text-[color:var(--club-theme-text-primary)]'
                                            : 'border-transparent bg-transparent text-[color:var(--club-theme-text-secondary)] hover:border-[color:var(--color-border)]/8 hover:bg-[color:var(--color-ink)]/[0.04] hover:text-[color:var(--club-theme-text-primary)]'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[color:var(--club-tone-green)]' : 'text-[color:var(--club-theme-text-secondary)]'}`} />
                                    <span className="text-[11px] font-semibold ">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ===== CONTENT GRID ===== */}
            <div className="club-profile-frame mx-auto w-full pb-10 pt-4">
                <div className="profile-content-grid">
                    <aside className="profile-information" aria-label="Profile information">
                        <button type="button" className="profile-details-toggle" aria-expanded={detailsExpanded || activeTab === 'stats' || searchParams.has('representation')} onClick={() => { const expanded = detailsExpanded || activeTab === 'stats' || searchParams.has('representation') || searchParams.has('representation'); const next = new URLSearchParams(searchParams); next.delete('representation'); if (activeTab === 'stats') next.delete('tab'); setSearchParams(next, { replace:true, preventScrollReset:true }); setDetailsExpanded(!expanded); }}>About & career</button>
                        <div className={`profile-info-content ${detailsExpanded || activeTab === 'stats' || searchParams.has('representation') ? 'is-open' : ''}`}>{leftPanel}</div>
                    </aside>
                    <div className="profile-feed-column" aria-label="Profile feed">
                        <div id="profile-tab-panel" role="tabpanel" aria-labelledby={`profile-tab-${activeTab}`} tabIndex={0} className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
                            {(postPages.loading || postPages.error) && <ProfilePostPagination {...postPages}/>}
                            {/* Tab: About me — bio + posts */}
                            {(activeTab === 'about' || activeTab === 'stats') && (
                                <>
                                    {isMyProfile && (
                                        <PostComposer authorName={displayName} avatarUrl={profile.avatarUrl} onPostCreated={postPages.refresh} compact />
                                    )}

                                    {postPages.loading || postPages.error ? null : posts.length === 0 ? (
                                        <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-5 py-12 text-center">
                                            <Activity className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-muted)]" />
                                            <p className="mt-4 text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                                                {t('userProfile.postsEmpty')}
                                            </p>
                                        </div>
                                    ) : (
                                        posts.map((post) => (
                                            <FeedPost
                                                key={post.id}
                                                post={post}
                                                isCommentsOpen={openComments[post.id]}
                                                commentsData={commentsData[post.id]}
                                                onLikeToggle={handleLikeToggle}
    onReactionChange={reactions.change}
                                                onToggleComments={toggleComments}
                                                onSubmitComment={submitComment}
                                                likePending={reactions.pending[post.id] === true || pendingLikes[post.id] === true}
                                                likeError={reactions.errors[post.id] || likeErrors[post.id]}
                                                commentsError={commentsErrors[post.id]}
                                                onRetryComments={(postId) => void loadComments(postId, true)}
                                                onImageClick={() => {
                                                    setSelectedPost(post);
                                                    void loadComments(post.id);
                                                }}
                                                compact
                                            />
                                        ))
                                    )}
                                </>
                            )}

                            {/* Tab: Images */}
                            {activeTab === 'images' && (
                                <>
                                    {imageEntries.length === 0 ? (
                                        <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-5 py-12 text-center">
                                            <Image className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-muted)]" />
                                            <p className="mt-4 text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                                                {t('userProfile.imagesEmpty')}
                                            </p>
                                        </div>
                                    ) : (
                                        renderMediaGrid(imageEntries)
                                    )}
                                </>
                            )}

                            {/* Tab: Videos */}
                            {activeTab === 'videos' && (
                                <>
                                    {videoEntries.length === 0 ? (
                                        <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-5 py-12 text-center">
                                            <Film className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-muted)]" />
                                            <p className="mt-4 text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                                                {t('userProfile.videosEmpty')}
                                            </p>
                                        </div>
                                    ) : (
                                        renderMediaGrid(videoEntries)
                                    )}
                                </>
                            )}
                            {!postPages.loading && !postPages.error && <ProfilePostPagination {...postPages}/>}
                        </div>
                    </div>

                    {/* RIGHT PANEL — recent activity */}
                    <div className="profile-activity-column">
                        {rightPanel}
                    </div>
                </div>
            </div>

            {imageEditor.error && !imageEditor.source && <p role="alert" className="px-5 py-3 text-[color:var(--color-danger)]">{imageEditor.error}</p>}
            {imageEditor.source && <ImageCropperModal isOpen imageUrl={imageEditor.source.imageUrl}
                title={imageEditor.source.type === 'banner' ? 'Adjust cover photo' : 'Adjust profile photo'}
                aspectRatio={imageEditor.source.type === 'banner' ? 3 : 1} roundPreview={imageEditor.source.type === 'avatar'}
                onClose={imageEditor.close} onCropComplete={imageEditor.save} isProcessing={!!uploading} error={imageEditor.error}/>}
            {/* Post theater modal */}
            <PostTheaterModal
                isOpen={!!selectedPost}
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
                commentsData={selectedPost ? commentsData[selectedPost.id] : undefined}
                onSubmitComment={submitComment}
                onLikeToggle={handleLikeToggle}
    onReactionChange={reactions.change}
                likePending={selectedPost ? reactions.pending[selectedPost.id] === true || pendingLikes[selectedPost.id] === true : false}
                likeError={selectedPost ? reactions.errors[selectedPost.id] || likeErrors[selectedPost.id] : null}
                commentsLoading={selectedPost ? commentsLoading[selectedPost.id] === true : false}
                commentsError={selectedPost ? commentsErrors[selectedPost.id] : null}
                onRetryComments={(postId) => void loadComments(postId, true)}
            />
        </div>
    );
};
