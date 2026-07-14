import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Activity,
    ArrowLeft,
    BarChart3,
    BellRing,
    Briefcase,
    Building2,
    Camera,
    ExternalLink,
    Film,
    Footprints,
    HeartHandshake,
    Image,
    Loader2,
    MapPin,
    MessageCircle,
    Ruler,
    Share2,
    ShieldCheck,
    Trophy,
    Users,
    Weight
} from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { FeedPost, type FeedPostDto, type CommentDto } from '../components/feed/FeedPost';
import { PostComposer } from '../components/feed/PostComposer';
import { PostTheaterModal } from '../components/PostTheaterModal';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
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
    agencyName?: string | null;
    fifaLicenseNumber?: string | null;
    agentVerified?: boolean | null;
    followerCount: number;
    followingCount: number;
    isFollowedByMe: boolean;
    careerHistory?: CareerHistoryDto[];
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    dateOfBirth?: string | null;
}

type ProfileTab = 'feed' | 'stats' | 'media';

interface MediaEntry {
    key: string;
    postId: number;
    url: string;
    kind: 'image' | 'video';
    createdAt: string;
    summary: string;
}

const normalizeTab = (value: string | null): ProfileTab => (value === 'stats' || value === 'media' ? value : 'feed');

const positionColors: Record<string, string> = {
    GK: 'var(--club-tone-green)',
    DEF: 'var(--club-tone-blue)',
    MID: 'var(--club-tone-cyan)',
    FWD: 'var(--club-accent-orange)',
};

const positionAbbr = (pos: string | null | undefined): string => {
    if (!pos) return '';
    const p = pos.toLowerCase();
    if (p.includes('goalkeeper')) return 'GK';
    if (p.includes('centre-back') || p.includes('left-back') || p.includes('right-back') || p.includes('defender')) return 'DEF';
    if (p.includes('midfield')) return 'MID';
    if (p.includes('winger') || p.includes('striker') || p.includes('forward')) return 'FWD';
    return pos.substring(0, 3).toUpperCase();
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
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const bannerInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<'banner' | 'avatar' | null>(null);
    const [profileError, setProfileError] = useState('');

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(getStoredUserId());
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [agentRep, setAgentRep] = useState<{ agencyName: string; agentUserId: number; agentVerified: boolean } | null>(null);

    const activeTab = normalizeTab(searchParams.get('tab'));

    const loadComments = async (postId: number) => {
        if (commentsData[postId]) return;

        try {
            const res = await apiClient.get<CommentDto[]>(`/posts/${postId}/comments`);
            setCommentsData((prev) => ({ ...prev, [postId]: res.data }));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchProfile = async (showLoading = true) => {
        if (!id) return;

        if (showLoading) {
            setLoading(true);
        }

        try {
            const [userRes, postsRes, repRes] = await Promise.all([
                apiClient.get(`/users/${id}`),
                apiClient.get(`/posts/user/${id}`).catch(() => ({ data: { posts: [] } })),
                apiClient.get(`/agents/players/${id}/representation`).catch(() => ({ data: null }))
            ]);

            setProfile(userRes.data);
            setPosts(postsRes.data?.posts || []);
            if (repRes.data) {
                setAgentRep({
                    agencyName: repRes.data.agencyName || repRes.data.fullName || 'Unknown Agent',
                    agentUserId: repRes.data.agentUserId || repRes.data.playerUserId,
                    agentVerified: repRes.data.agentVerified || false
                });
            } else {
                setAgentRep(null);
            }
        } catch (err) {
            console.error('Failed to fetch user profile', err);
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        apiClient.get('/users/me')
            .then((res) => {
                if (res.data?.id != null) {
                    const userId = String(res.data.id);
                    setCurrentUserId(userId);
                    setStoredUserId(userId);
                }
            })
            .catch(() => undefined);

        void fetchProfile();
    }, [id]);

    const setActiveTab = (tab: ProfileTab) => {
        const nextParams = new URLSearchParams(searchParams);
        if (tab === 'feed') {
            nextParams.delete('tab');
        } else {
            nextParams.set('tab', tab);
        }
        setSearchParams(nextParams, { replace: true });
    };

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
        if (!event.target.files || !event.target.files[0]) return;

        const file = event.target.files[0];
        setUploading(type);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const mediaRes = await apiClient.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { context: type }
            });
            const imageUrl = mediaRes.data?.url;

            if (!imageUrl) {
                throw new Error('Upload did not return a media URL.');
            }

            await apiClient.put('/users/me', {
                [type === 'avatar' ? 'avatarUrl' : 'bannerUrl']: imageUrl
            });

            await fetchProfile(false);
        } catch (err) {
            console.error('Upload failed', err);
            setProfileError('Failed to update profile image.');
            setTimeout(() => setProfileError(''), 4000);
        } finally {
            setUploading(null);
            if (event.target) {
                event.target.value = '';
            }
        }
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

    const handleLikeToggle = async (postId: number) => {
        setPosts((current) => current.map((post) => (
            post.id === postId
                ? {
                    ...post,
                    isLikedByMe: !post.isLikedByMe,
                    likeCount: post.isLikedByMe ? post.likeCount - 1 : post.likeCount + 1
                }
                : post
        )));

        if (selectedPost?.id === postId) {
            setSelectedPost((prev) => (
                prev
                    ? {
                        ...prev,
                        isLikedByMe: !prev.isLikedByMe,
                        likeCount: prev.isLikedByMe ? prev.likeCount - 1 : prev.likeCount + 1
                    }
                    : null
            ));
        }

        try {
            await apiClient.post(`/posts/${postId}/like`);
        } catch {
            // Keep optimistic UI for now.
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
        try {
            const res = await apiClient.post<CommentDto>(`/posts/${postId}/comments`, { content });
            setCommentsData((prev) => ({ ...prev, [postId]: [...(prev[postId] || []), res.data] }));
            setPosts((current) => current.map((post) => (post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post)));
            if (selectedPost?.id === postId) {
                setSelectedPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : null));
            }
        } catch (err) {
            console.error('Failed to post comment', err);
        }
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
                    kind: /\.(mp4|mov|webm)$/i.test(resolvedUrl) ? 'video' : 'image',
                    createdAt: post.createdAt,
                    summary: post.content || 'Timeline media'
                };
            });
        })
    ), [posts]);

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
            <div className="club-page-shell bg-base flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-primary border-t-transparent" />
            </div>
        );
    }

    // --- Not-found state ---
    if (!profile) {
        return (
            <div className="club-page-shell bg-base flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className="bg-surface border border-subtle px-8 py-10 text-center">
                    <ShieldCheck className="mx-auto mb-4 h-12 w-12 accent-primary" />
                    <h2 className="text-xl font-black uppercase tracking-[0.18em] text-primary">Profile Not Found</h2>
                    <button type="button" onClick={() => navigate(-1)} className="mt-4 text-sm font-black uppercase tracking-[0.16em] accent-primary">
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
    const isMyProfile = String(profile.id) === currentUserId;
    const posAbbr = positionAbbr(profile.position);
    const playerAge = profile.dateOfBirth
        ? Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / 31556952000)
        : null;

    const isPlayer = profile.role === 'PLAYER';

    const tabs: Array<{ id: ProfileTab; label: string; icon: typeof Activity }> = [
        { id: 'feed', label: 'Timeline', icon: Activity },
        ...(isPlayer ? [{ id: 'stats' as ProfileTab, label: 'Career', icon: Trophy }] : []),
        { id: 'media', label: 'Media', icon: Image },
    ];

    // --- Left Panel content ---
    const leftPanel = (
        <div className="flex flex-col gap-4">
            {/* Profile summary card */}
            <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border-2 border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-theme-base)] text-lg font-bold text-[color:var(--club-theme-text-primary)]">
                        {avatarUrl ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" /> : initials}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-[color:var(--club-theme-text-primary)] truncate">{displayName}</p>
                        <p className="text-xs text-[color:var(--club-theme-text-secondary)]">@{profile.username}</p>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="text-center">
                        <p className="text-lg font-bold text-[color:var(--club-theme-text-primary)]">{profile.followerCount}</p>
                        <p className="text-[10px] font-medium text-[color:var(--club-theme-text-muted)]">Followers</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-[color:var(--club-theme-text-primary)]">{profile.followingCount}</p>
                        <p className="text-[10px] font-medium text-[color:var(--club-theme-text-muted)]">Following</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-[color:var(--club-theme-text-primary)]">{posts.length}</p>
                        <p className="text-[10px] font-medium text-[color:var(--club-theme-text-muted)]">Posts</p>
                    </div>
                </div>
            </div>

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
                        {agentRep && (
                            <div className="flex items-center gap-3 pt-3 border-t border-[color:var(--club-theme-border-subtle)]">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-violet-soft)]">
                                    <Briefcase className="h-4 w-4 text-[color:var(--club-tone-violet)]" />
                                </div>
                                <div>
                                    <a href={`/agent/${agentRep.agentUserId}`} className="text-xs font-semibold text-[color:var(--club-tone-violet)] hover:underline">
                                        {agentRep.agencyName}
                                        {agentRep.agentVerified && <span className="ml-1 text-[10px] text-[color:var(--club-tone-green)]">✓</span>}
                                    </a>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">Represented by</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Agent profile details */}
            {profile.role === 'AGENT' && (
                <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--club-theme-text-muted)] mb-3">Agency Profile</p>
                    <div className="space-y-3">
                        {profile.agencyName && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-blue-soft)]">
                                    <Building2 className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[color:var(--club-theme-text-primary)]">{profile.agencyName}</p>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">Agency</p>
                                </div>
                            </div>
                        )}
                        {profile.fifaLicenseNumber && (
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--club-tone-green-soft)]">
                                    <ShieldCheck className="h-4 w-4 text-[color:var(--club-tone-green)]" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-[color:var(--club-theme-text-primary)]">{profile.fifaLicenseNumber}</p>
                                    <p className="text-[10px] text-[color:var(--club-theme-text-muted)]">License</p>
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

    // --- Right Panel content ---
    const rightPanel = (
        <div className="flex flex-col gap-4">
            <StatCard icon={Users} label="Followers" value={profile.followerCount} />
            <StatCard icon={Users} label="Following" value={profile.followingCount} />
            <StatCard icon={Film} label="Media" value={mediaEntries.length} />
            {isPlayer && profile.position && (
                <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--club-theme-text-muted)] mb-2">Position</p>
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                        style={{ backgroundColor: `color-mix(in srgb, ${posAbbr ? positionColors[posAbbr] || 'var(--club-tone-green)' : 'var(--club-tone-green)'} 15%, transparent)`, color: posAbbr ? positionColors[posAbbr] || 'var(--club-tone-green)' : 'var(--club-tone-green)' }}
                    >
                        {profile.position}
                    </span>
                </div>
            )}

            {/* Talanti Foundation — Charity card (always visible) */}
            <div className="rounded-[4px] border border-[color:var(--club-tone-pink)]/30 px-4 py-3.5" style={{ background: 'rgba(10,10,12,0.6)' }}>
                <div className="flex items-center gap-2 mb-2">
                    <HeartHandshake className="h-4 w-4 text-[color:var(--club-tone-pink)]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--club-theme-text-muted)]">Talanti Foundation</p>
                </div>
                <p className="text-xs text-secondary leading-relaxed mb-3">
                    Fund your training, equipment, or community project. Every player deserves a chance.
                </p>
                <div className="flex gap-2">
                    <a
                        href="https://www.gofundme.com/discover"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-[4px] border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[rgba(255,107,157,0.08)]"
                        style={{ borderColor: 'rgba(255,107,157,0.3)', color: 'var(--club-tone-pink)' }}
                    >
                        Donate
                        <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                        href="https://www.gofundme.com/create"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1 rounded-[4px] border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                        style={{ borderColor: 'var(--club-theme-border-subtle)', color: 'var(--club-theme-text-secondary)' }}
                    >
                        Start Fundraiser
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
            </div>
        </div>
    );

    // --- Client-side action buttons ---
    const systemBtnClass = 'inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-primary)] transition-colors hover:bg-white/[0.07]';
    const accentBtnClass = 'inline-flex items-center gap-2 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#04110a] transition-all hover:brightness-105';

    return (
        <div className="club-page-shell min-h-full bg-[color:var(--club-theme-base)]">
            {/* Error toast */}
            {profileError && (
                <div className="mx-auto mt-4 flex w-full max-w-[min(1880px,calc(100vw-48px))] items-center gap-3 rounded-[4px] border border-[color:var(--state-danger)]/30 bg-[color:var(--state-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--state-danger)]">
                    {profileError}
                </div>
            )}

            {/* ===== HERO SECTION ===== */}
            <section className="border-b border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-band)]">
                {/* Banner area */}
                <div className="relative h-[240px] sm:h-[300px] lg:h-[360px] overflow-hidden">
                    {bannerUrl ? (
                        <img src={bannerUrl} alt={`${displayName} banner`} className="h-full w-full object-cover object-top" />
                    ) : (
                        <div className="h-full w-full bg-[color:var(--club-theme-surface)]" />
                    )}

                    {/* Gradient overlay — dark fade to bottom */}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,16,0.04)_0%,rgba(5,9,16,0.55)_40%,rgba(5,9,16,0.92)_75%,#050910_100%)]" />

                    {/* Ambient radial glows */}
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(30,144,255,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_26%)]" />

                    {/* Back button */}
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/24 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-md transition-colors hover:bg-black/40"
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
                                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/24 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white backdrop-blur-md transition-colors hover:bg-black/40"
                            >
                                {uploading === 'banner' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                Banner
                            </button>
                            <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(event) => handleImageUpload(event, 'banner')} />
                        </div>
                    )}
                </div>

                {/* Hero content area */}
                <div className="bg-[#050910]">
                    <div className="mx-auto w-full max-w-[min(1880px,calc(100vw-24px))] px-3 relative py-6 lg:py-8">
                        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                            {/* Left: Avatar + Identity */}
                            <div className="flex items-start gap-4">
                                {/* Avatar — overlaps banner bottom */}
                                <div className="relative shrink-0 -mt-[76px] sm:-mt-[96px] lg:-mt-[112px]">
                                    <div className="h-24 w-24 sm:h-28 sm:w-28 lg:h-36 lg:w-36 overflow-hidden rounded-[28px] border-[5px] border-[color:var(--club-band)] bg-[rgba(6,11,18,0.92)] shadow-[0_18px_44px_rgba(2,6,12,0.35)]">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-2xl font-black uppercase text-[color:var(--club-theme-text-primary)]">
                                                {initials}
                                            </div>
                                        )}
                                    </div>
                                    {isMyProfile && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => avatarInputRef.current?.click()}
                                                className="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-black/34 text-[color:var(--club-theme-text-primary)] transition-colors hover:bg-white/[0.12]"
                                            >
                                                {uploading === 'avatar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                            </button>
                                            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(event) => handleImageUpload(event, 'avatar')} />
                                        </>
                                    )}
                                </div>

                                {/* Identity */}
                                <div className="min-w-0 pt-2">
                                    <h1 className="text-3xl font-black tracking-[-0.04em] text-[color:var(--club-theme-text-primary)] sm:text-5xl">
                                        {displayName}
                                    </h1>
                                    <p className="mt-0.5 text-sm text-[color:var(--club-theme-text-secondary)]">@{profile.username}</p>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <StatusBadge tone="neutral">{profile.role}</StatusBadge>
                                        {profile.agentVerified && <StatusBadge tone="success">Verified</StatusBadge>}
                                        {profile.availabilityStatus && <StatusBadge tone="info">{profile.availabilityStatus}</StatusBadge>}
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--club-theme-text-secondary)]">
                                        <span>{profile.position || profile.role}</span>
                                        {profile.secondaryPosition && (
                                            <>
                                                <span className="h-1 w-1 rounded-full bg-[color:var(--club-divider-dot)]" />
                                                <span>{profile.secondaryPosition}</span>
                                            </>
                                        )}
                                        {profile.agencyName && (
                                            <>
                                                <span className="h-1 w-1 rounded-full bg-[color:var(--club-divider-dot)]" />
                                                <span>{profile.agencyName}</span>
                                            </>
                                        )}
                                    </div>

                                    <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--club-theme-text-secondary)]">
                                        {profile.bio || 'No biography has been published on this profile yet.'}
                                    </p>
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
                                        <button type="button" className={systemBtnClass}>
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
            <div className="border-b border-[color:var(--club-theme-border-subtle)] bg-[rgba(5,9,16,0.96)]">
                <div className="mx-auto w-full overflow-x-auto px-6 sm:px-8">
                    <div className="flex min-w-max items-stretch gap-2.5 py-3">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-left text-[12px] font-semibold transition-all ${
                                        isActive
                                            ? 'border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green-soft)] text-[color:var(--club-theme-text-primary)]'
                                            : 'border-transparent bg-transparent text-[color:var(--club-theme-text-secondary)] hover:border-white/8 hover:bg-white/[0.04] hover:text-[color:var(--club-theme-text-primary)]'
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[color:var(--club-tone-green)]' : 'text-[color:var(--club-theme-text-secondary)]'}`} />
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ===== CONTENT GRID ===== */}
            <div className="mx-auto w-full max-w-[min(1440px,calc(100vw-48px))] px-6 pb-10 pt-4 sm:px-8">
                <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)_320px] lg:items-start lg:justify-center">
                    {/* LEFT PANEL — profile info */}
                    <div className="hidden lg:block lg:sticky lg:top-[14px] pl-6">
                        {leftPanel}
                    </div>

                    {/* CENTER — tab content */}
                    <div className="min-w-0">
                        {/* Mobile: profile info shown above content */}
                        <div className="mb-6 lg:hidden">
                            {leftPanel}
                        </div>

                        {/* Tab: Timeline */}
                        {activeTab === 'feed' && (
                            <div className="flex flex-col gap-4">
                                {isMyProfile && (
                                    <PostComposer authorName={displayName} onPostCreated={() => void fetchProfile(false)} compact />
                                )}

                                {posts.length === 0 ? (
                                    <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-5 py-12 text-center">
                                        <Activity className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-muted)]" />
                                        <p className="mt-4 text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                                            Updates, match notes, and public profile posts will appear here once this account starts publishing.
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
                                            onToggleComments={toggleComments}
                                            onSubmitComment={submitComment}
                                            onImageClick={() => {
                                                setSelectedPost(post);
                                                void loadComments(post.id);
                                            }}
                                            compact
                                        />
                                    ))
                                )}
                            </div>
                        )}

                        {/* Tab: Career Stats */}
                        {activeTab === 'stats' && (
                            <div className="flex flex-col gap-4">
                                {/* Career totals */}
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                            </div>
                        )}

                        {/* Tab: Media */}
                        {activeTab === 'media' && (
                            <div className="flex flex-col gap-4">
                                {mediaEntries.length === 0 ? (
                                    <div className="rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] px-5 py-12 text-center">
                                        <Image className="mx-auto h-10 w-10 text-[color:var(--club-theme-text-muted)]" />
                                        <p className="mt-4 text-sm leading-6 text-[color:var(--club-theme-text-secondary)]">
                                            No media has been posted yet. Images and videos from timeline posts will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                        {mediaEntries.map((entry) => {
                                            const mediaUrl = resolveMediaUrl(entry.url) || entry.url;
                                            const relatedPost = posts.find((post) => post.id === entry.postId) || null;

                                            return (
                                                <button
                                                    key={entry.key}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedPost(relatedPost);
                                                        if (relatedPost) {
                                                            void loadComments(relatedPost.id);
                                                        }
                                                    }}
                                                    className="group relative overflow-hidden rounded-[4px] border border-[color:var(--club-theme-border-subtle)] bg-[color:var(--club-card)] aspect-square"
                                                >
                                                    {entry.kind === 'video' ? (
                                                        <video src={mediaUrl} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <img src={mediaUrl} alt="Timeline media" className="h-full w-full object-cover" />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/40 flex items-center justify-center">
                                                        <span className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-white uppercase tracking-[0.08em] transition-opacity">
                                                            {entry.kind === 'video' ? 'Play' : 'View Post'}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="hidden lg:block lg:sticky lg:top-[14px]">
                        {rightPanel}
                    </div>
                </div>
            </div>

            {/* Post theater modal */}
            <PostTheaterModal
                isOpen={!!selectedPost}
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
                commentsData={selectedPost ? commentsData[selectedPost.id] : undefined}
                onSubmitComment={submitComment}
                onLikeToggle={handleLikeToggle}
            />
        </div>
    );
};
