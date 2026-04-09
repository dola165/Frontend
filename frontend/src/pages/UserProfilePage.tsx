import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Activity,
    ArrowLeft,
    BarChart3,
    BellRing,
    Building2,
    Camera,
    Film,
    Loader2,
    MapPin,
    Ruler,
    ShieldCheck,
    Weight
} from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { FeedPost, type FeedPostDto, type CommentDto } from '../components/feed/FeedPost';
import { PostComposer } from '../components/feed/PostComposer';
import { PostTheaterModal } from '../components/PostTheaterModal';
import { EntityBannerBand, EntityHeaderBand, EntityPageLayout, EntitySection } from '../components/layout/EntityPageLayout';
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

interface LabelValueItem {
    label: string;
    value: string | number;
    accent?: boolean;
}

const normalizeTab = (value: string | null): ProfileTab => (value === 'stats' || value === 'media' ? value : 'feed');

const formatDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const RecordRow = ({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) => (
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
        <span className="text-secondary">{label}</span>
        <span className={`max-w-[62%] text-right ${accent ? 'accent-primary' : 'text-primary'}`}>{value}</span>
    </div>
);

const SummaryCell = ({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) => (
    <div className="px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">{label}</p>
        <p className={`mt-2 text-xl font-black uppercase tracking-tight ${accent ? 'accent-primary' : 'text-primary'}`}>{value}</p>
    </div>
);

export const UserProfilePage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const bannerInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<'banner' | 'avatar' | null>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(getStoredUserId());
    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});

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
            const [userRes, postsRes] = await Promise.all([
                apiClient.get(`/users/${id}`),
                apiClient.get(`/posts/user/${id}`).catch(() => ({ data: { posts: [] } }))
            ]);

            setProfile(userRes.data);
            setPosts(postsRes.data?.posts || []);
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
                headers: { 'Content-Type': 'multipart/form-data' }
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
            alert('Failed to update profile image.');
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
            alert('Failed to post comment.');
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

    if (loading) {
        return (
            <div className="bg-base flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin accent-primary" />
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Loading profile workspace</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="bg-base flex min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className="border border-subtle bg-surface px-8 py-10 text-center">
                    <h2 className="text-xl font-black uppercase tracking-[0.18em] text-primary">Personnel Not Found</h2>
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
    const profileTabs: Array<{ id: ProfileTab; label: string; icon: typeof Activity; description: string }> = [
        { id: 'feed', label: 'Timeline', icon: Activity, description: 'Primary timeline and updates' },
        { id: 'stats', label: 'Career Stats', icon: BarChart3, description: 'Historical production and appearances' },
        { id: 'media', label: 'Media', icon: Film, description: 'Attached images and video from the timeline' }
    ];

    const recordRows: LabelValueItem[] = profile.role === 'PLAYER'
        ? [
            { label: 'Primary Role', value: profile.position || profile.role },
            { label: 'Secondary Role', value: profile.secondaryPosition || 'Not listed' },
            { label: 'Preferred Foot', value: profile.preferredFoot || 'Not listed' },
            { label: 'Availability', value: profile.availabilityStatus || 'Not listed', accent: true },
            { label: 'Height', value: profile.heightCm ? `${profile.heightCm} cm` : 'N/A' },
            { label: 'Weight', value: profile.weightKg ? `${profile.weightKg} kg` : 'N/A' }
        ]
        : profile.role === 'AGENT'
            ? [
                { label: 'Agency', value: profile.agencyName || 'Not listed' },
                { label: 'License', value: profile.fifaLicenseNumber || 'Not listed' },
                { label: 'Verification', value: profile.agentVerified ? 'Verified' : 'Pending', accent: true },
                { label: 'Clients Visible', value: mediaEntries.length > 0 ? 'Active' : 'Building' }
            ]
            : [
                { label: 'Role', value: profile.role },
                { label: 'Primary Position', value: profile.position || 'Not listed' },
                { label: 'Followers', value: profile.followerCount },
                { label: 'Following', value: profile.followingCount }
            ];

    const centerSummary: LabelValueItem[] = activeTab === 'stats'
        ? [
            { label: 'Clubs', value: careerTotals.clubs },
            { label: 'Appearances', value: careerTotals.appearances },
            { label: profile.role === 'PLAYER' ? 'Goals' : 'Assists', value: profile.role === 'PLAYER' ? careerTotals.goals : careerTotals.assists, accent: true }
        ]
        : activeTab === 'media'
            ? [
                { label: 'Media Posts', value: mediaEntries.length },
                { label: 'Timeline Posts', value: posts.length },
                { label: 'Followers', value: profile.followerCount, accent: true }
            ]
            : [
                { label: 'Posts', value: posts.length },
                { label: 'Media', value: mediaEntries.length },
                { label: 'Followers', value: profile.followerCount, accent: true }
            ];

    const leftRail = (
        <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
            <EntitySection eyebrow="Profile Navigation" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                {profileTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex w-full items-center justify-between gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                                isActive ? 'border-accent-muted bg-elevated text-primary' : 'border-transparent text-secondary hover:bg-base hover:text-primary'
                            }`}
                        >
                            <span className="flex items-center gap-3">
                                <Icon className={`h-4 w-4 ${isActive ? 'accent-primary' : ''}`} />
                                <span>
                                    <span className="block text-[11px] font-black uppercase tracking-[0.16em]">{tab.label}</span>
                                    <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-secondary">{tab.description}</span>
                                </span>
                            </span>
                        </button>
                    );
                })}
            </EntitySection>

            <EntitySection eyebrow="Professional Record" title={profile.role === 'PLAYER' ? 'Playing Profile' : profile.role === 'AGENT' ? 'Agency Profile' : 'Profile Record'} bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                {recordRows.map((item) => (
                    <RecordRow key={item.label} label={item.label} value={item.value} accent={item.accent} />
                ))}
            </EntitySection>

            <EntitySection eyebrow="Career Context" title="Recent Path" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                {(profile.careerHistory || []).length === 0 ? (
                    <div className="px-4 py-5 text-sm leading-6 text-secondary">Career history has not been published yet.</div>
                ) : (
                    (profile.careerHistory || []).slice(0, 4).map((entry) => (
                        <div key={entry.id} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black uppercase tracking-[0.12em] text-primary">{entry.clubName}</p>
                                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-secondary">{entry.season}</p>
                                </div>
                                <Building2 className="h-4 w-4 shrink-0 accent-primary" />
                            </div>
                        </div>
                    ))
                )}
            </EntitySection>
        </div>
    );

    const centerSurface = (
        <div className="flex flex-col gap-4">
            <EntitySection
                eyebrow="Main Surface"
                title={activeTab === 'feed' ? 'Timeline' : activeTab === 'stats' ? 'Career Stats' : 'Media Stream'}
                description={activeTab === 'feed'
                    ? 'Primary activity stays here in a readable feed lane, with posts kept inside a disciplined center width.'
                    : activeTab === 'stats'
                        ? 'Performance history stays grouped as rows for fast football scanning.'
                        : 'Attached images and videos are surfaced as rows instead of gallery-card clutter.'}
                bodyClassName="grid divide-y divide-[color:var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
            >
                {centerSummary.map((item) => (
                    <SummaryCell key={item.label} label={item.label} value={item.value} accent={item.accent} />
                ))}
            </EntitySection>

            {activeTab === 'feed' && (
                <div className="flex flex-col gap-4">
                    {isMyProfile && (
                        <PostComposer authorName={displayName} onPostCreated={() => void fetchProfile(false)} compact />
                    )}

                    {posts.length === 0 ? (
                        <EntitySection eyebrow="Timeline" title="No Activity Yet" bodyClassName="px-5 py-12 text-center">
                            <div className="mx-auto flex max-w-md flex-col items-center">
                                <Activity className="h-10 w-10 text-secondary" />
                                <p className="mt-4 text-sm leading-6 text-secondary">Updates, match notes, and public profile posts will appear here once this account starts publishing.</p>
                            </div>
                        </EntitySection>
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
                            />
                        ))
                    )}
                </div>
            )}

            {activeTab === 'stats' && (
                <EntitySection eyebrow="Career Stats" title="Professional Record" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                    {(profile.careerHistory || []).length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <BarChart3 className="mx-auto h-10 w-10 text-secondary" />
                            <p className="mt-4 text-sm leading-6 text-secondary">This backend has not published career history for this profile yet.</p>
                        </div>
                    ) : (
                        <>
                            {(profile.careerHistory || []).map((entry) => (
                                <article key={entry.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[150px_minmax(0,1fr)_auto] lg:items-start">
                                    <div className="text-[11px] font-black uppercase tracking-[0.16em] accent-primary">{entry.season}</div>
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-[0.12em] text-primary">{entry.clubName}</p>
                                        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.16em] text-secondary">{entry.category}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">{entry.appearances} apps</span>
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">{entry.goals} goals</span>
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">{entry.assists} assists</span>
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">{entry.cleanSheets} clean sheets</span>
                                    </div>
                                </article>
                            ))}
                        </>
                    )}
                </EntitySection>
            )}

            {activeTab === 'media' && (
                <EntitySection eyebrow="Media Stream" title="Attached Media" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                    {mediaEntries.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                            <Film className="mx-auto h-10 w-10 text-secondary" />
                            <p className="mt-4 text-sm leading-6 text-secondary">Open post media from the timeline once this profile starts publishing image or video updates.</p>
                        </div>
                    ) : (
                        mediaEntries.map((entry) => {
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
                                    className="grid w-full gap-4 px-4 py-4 text-left transition-colors hover:bg-base sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-center"
                                >
                                    <div className="overflow-hidden border border-subtle bg-base">
                                        {entry.kind === 'video' ? (
                                            <video src={mediaUrl} className="h-20 w-full object-cover sm:w-[120px]" />
                                        ) : (
                                            <img src={mediaUrl} alt="Timeline media" className="h-20 w-full object-cover sm:w-[120px]" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black uppercase tracking-[0.12em] text-primary">{entry.kind === 'video' ? 'Video Attachment' : 'Image Attachment'}</p>
                                        <p className="mt-2 text-sm leading-6 text-secondary">{entry.summary}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 sm:justify-end">
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-primary">{formatDateTime(entry.createdAt)}</span>
                                        <span className="border border-subtle bg-base px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] accent-primary">Open Post</span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </EntitySection>
            )}
        </div>
    );

    const rightRail = (
        <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--app-header-height)+24px)]">
            <EntitySection eyebrow="Utility Layer" title={isMyProfile ? 'Account Utility' : 'Scouting Snapshot'} bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                <RecordRow label="Followers" value={profile.followerCount} />
                <RecordRow label="Following" value={profile.followingCount} />
                <RecordRow label="Media Entries" value={mediaEntries.length} />
                <RecordRow label="Availability" value={profile.availabilityStatus || 'Not listed'} accent />
            </EntitySection>

            <EntitySection eyebrow="Profile Signals" title="Visibility" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                <div className="flex items-start gap-3 px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center border border-subtle bg-base">
                        <MapPin className="h-4 w-4 accent-primary" />
                    </div>
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Primary Position</p>
                        <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{profile.position || profile.role}</p>
                    </div>
                </div>
                {profile.role === 'PLAYER' && (
                    <>
                        <div className="flex items-start gap-3 px-4 py-3">
                            <div className="flex h-9 w-9 items-center justify-center border border-subtle bg-base">
                                <Ruler className="h-4 w-4 accent-primary" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Height</p>
                                <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{profile.heightCm ? `${profile.heightCm} cm` : 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 px-4 py-3">
                            <div className="flex h-9 w-9 items-center justify-center border border-subtle bg-base">
                                <Weight className="h-4 w-4 accent-primary" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Weight</p>
                                <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{profile.weightKg ? `${profile.weightKg} kg` : 'N/A'}</p>
                            </div>
                        </div>
                    </>
                )}
                {profile.role === 'AGENT' && (
                    <div className="flex items-start gap-3 px-4 py-3">
                        <div className="flex h-9 w-9 items-center justify-center border border-subtle bg-base">
                            <ShieldCheck className="h-4 w-4 accent-primary" />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">License</p>
                            <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{profile.fifaLicenseNumber || 'Not listed'}</p>
                        </div>
                    </div>
                )}
            </EntitySection>
        </div>
    );

    return (
        <>
            <EntityBannerBand>
                <div className="relative h-40 overflow-hidden sm:h-48 lg:h-56">
                    {bannerUrl ? (
                        <img src={bannerUrl} alt={`${displayName} banner`} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full bg-inset" />
                    )}

                    <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--theme-overlay),transparent_60%)]" />

                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="absolute left-4 top-4 inline-flex items-center gap-2 border border-subtle bg-surface px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>

                    {isMyProfile && (
                        <div className="absolute right-4 top-4 z-10">
                            <button
                                type="button"
                                onClick={() => bannerInputRef.current?.click()}
                                className="inline-flex items-center gap-2 border border-subtle bg-surface px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                            >
                                {uploading === 'banner' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                Banner
                            </button>
                            <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(event) => handleImageUpload(event, 'banner')} />
                        </div>
                    )}
                </div>
            </EntityBannerBand>

            <EntityHeaderBand>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                    <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                            <div className="flex h-20 w-20 items-center justify-center overflow-hidden border border-subtle bg-base text-xl font-black uppercase text-primary sm:h-24 sm:w-24">
                                {avatarUrl ? <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" /> : initials}
                            </div>
                            {isMyProfile && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => avatarInputRef.current?.click()}
                                        className="absolute -bottom-2 -right-2 inline-flex h-8 w-8 items-center justify-center border border-subtle bg-surface text-primary"
                                    >
                                        {uploading === 'avatar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                                    </button>
                                    <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(event) => handleImageUpload(event, 'avatar')} />
                                </>
                            )}
                        </div>

                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] accent-primary">Profile Workspace</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-black uppercase tracking-tight text-primary sm:text-3xl">{displayName}</h1>
                                <StatusBadge tone="neutral">{profile.role}</StatusBadge>
                                {profile.agentVerified && <StatusBadge tone="success">Verified</StatusBadge>}
                                {profile.availabilityStatus && <StatusBadge tone="info">{profile.availabilityStatus}</StatusBadge>}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">
                                <span>{profile.position || profile.role}</span>
                                {profile.secondaryPosition && (
                                    <>
                                        <span className="h-1 w-1 rounded-full bg-[color:var(--accent-muted)]" />
                                        <span>{profile.secondaryPosition}</span>
                                    </>
                                )}
                                {profile.agencyName && (
                                    <>
                                        <span className="h-1 w-1 rounded-full bg-[color:var(--accent-muted)]" />
                                        <span>{profile.agencyName}</span>
                                    </>
                                )}
                            </div>
                            <p className="mt-4 max-w-3xl text-sm leading-6 text-secondary">
                                {profile.bio || 'No biography has been published on this profile yet.'}
                            </p>
                        </div>
                    </div>

                    <div className="border border-subtle bg-base">
                        <div className="grid divide-y divide-[color:var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <SummaryCell label="Followers" value={profile.followerCount} />
                            <SummaryCell label="Following" value={profile.followingCount} />
                            <SummaryCell label="Posts" value={posts.length} accent />
                        </div>

                        <div className="flex flex-wrap gap-2 border-t border-subtle px-4 py-4">
                            {isMyProfile ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/notifications?scope=personal')}
                                        className="inline-flex items-center gap-2 border border-accent-primary bg-accent-primary-soft px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] accent-primary"
                                    >
                                        <BellRing className="h-4 w-4" />
                                        Notifications
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/account?tab=profile')}
                                        className="inline-flex items-center gap-2 border border-subtle bg-surface px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                    >
                                        <ShieldCheck className="h-4 w-4" />
                                        Account Center
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleFollowToggle}
                                    className={`inline-flex items-center gap-2 border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] ${profile.isFollowedByMe ? 'border-accent-primary bg-accent-primary-soft accent-primary' : 'border-subtle bg-surface text-primary'}`}
                                >
                                    <ShieldCheck className="h-4 w-4" />
                                    {profile.isFollowedByMe ? 'Following' : 'Follow'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </EntityHeaderBand>

            <EntityPageLayout left={leftRail} center={centerSurface} right={rightRail} />

            <PostTheaterModal
                isOpen={!!selectedPost}
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
                commentsData={selectedPost ? commentsData[selectedPost.id] : undefined}
                onSubmitComment={submitComment}
                onLikeToggle={handleLikeToggle}
            />
        </>
    );
};
