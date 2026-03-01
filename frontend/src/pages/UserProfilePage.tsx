import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreatePostModal } from '../components/CreatePostModal';
import { PostTheaterModal } from '../components/PostTheaterModal';
import { apiClient } from '../api/axiosConfig';
import {
    MapPin, Trophy, PlaySquare, Edit, Camera,
    Heart, MessageCircle, Share2, MoreHorizontal,
    Briefcase, ShieldCheck, Zap, Lock, ArrowLeft, CheckCircle2
} from 'lucide-react';

interface UserProfile {
    id: number;
    username: string;
    fullName: string;
    role: 'PLAYER' | 'AGENT' | 'FAN';
    bio: string;
    position?: string;
    strongFoot?: string;
    location?: string;
    followers: number;
    following: number;
    experience: { club: string; years: string; role: string }[];
}

interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorName: string;
    clubId: number | null;
    clubName: string | null;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
    mediaUrls: string[];
}

export const UserProfilePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'timeline' | 'about' | 'connections'>('timeline');
    const [selectedPost, setSelectedPost] = useState<FeedPostDto | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);
    const API_BASE_URL = 'http://localhost:8080';

    const isMyProfile = true;

    // 1. WE ADDED THE loadFeed FUNCTION HERE!
    const loadFeed = () => {
        apiClient.get(`/feed/user/${id}`)
            .then(res => setPosts(res.data.posts || res.data))
            .catch(err => console.error("Failed to load user feed", err));
    };

    useEffect(() => {
        // 2. USE loadFeed IN THE EFFECT INSTEAD OF WRITING IT INLINE
        loadFeed();

        setProfile({
            id: Number(id),
            username: 'react_dev',
            fullName: 'Beqa Dolidze',
            role: 'PLAYER',
            bio: "Passionate center defensive mid looking for a semi-pro club in the Tbilisi area. Strong tackler, great vision.",
            position: 'CDM / CB',
            strongFoot: 'Right',
            location: 'Tbilisi, Georgia',
            followers: 239,
            following: 45,
            experience: [
                { club: 'FC Rustavi Academy', years: '2020 - 2023', role: 'Youth Player' },
                { club: 'Experimentuli', years: '2024 - Present', role: 'First Team' }
            ]
        });

        setLoading(false);
    }, [id]);

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading || !profile) return <div className="p-10 text-center font-bold text-gray-500 uppercase tracking-widest">Loading profile...</div>;

    const initials = profile.fullName.substring(0, 2).toUpperCase();

    return (
        <div className="w-full min-h-screen bg-[#111827] pb-20 font-sans">

            {/* === HEADER SECTION === */}
            <div className="bg-[#1e293b] border-b-2 border-gray-800 shadow-[0_8px_0px_0px_rgba(15,23,42,1)] mb-8">

                {/* Banner Image */}
                <div className="relative h-64 md:h-80 w-full bg-slate-800 overflow-hidden border-b-2 border-gray-800">
                    <img
                        src="https://images.unsplash.com/photo-1518605368461-1ee71161d91a?auto=format&fit=crop&q=80&w=1200&h=400"
                        alt="Cover"
                        className="w-full h-full object-cover opacity-60 mix-blend-overlay"
                    />

                    {/* Back Button */}
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-4 left-4 bg-[#1e293b] text-white px-4 py-2 rounded-xl border-2 border-gray-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] font-black uppercase text-xs tracking-wide flex items-center gap-2 hover:bg-gray-800 transition-all active:translate-y-1 active:shadow-none"
                    >
                        <ArrowLeft className="w-4 h-4 text-emerald-400" /> Back
                    </button>

                    {isMyProfile && (
                        <button className="absolute bottom-4 right-4 bg-[#1e293b] text-white px-4 py-2 rounded-xl border-2 border-gray-800 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] font-black uppercase text-xs tracking-wide flex items-center gap-2 hover:bg-gray-800 transition-all active:translate-y-1 active:shadow-none">
                            <Camera className="w-4 h-4 text-emerald-400" /> Cover Photo
                        </button>
                    )}
                </div>

                <div className="max-w-5xl mx-auto px-4 sm:px-8 pb-0 relative">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

                        {/* Avatar & Name */}
                        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16 md:-mt-12 relative z-10">

                            {/* The Squircle Neo-Brutalist Avatar */}
                            <div className="relative group">
                                <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl border-4 border-[#1e293b] bg-gray-700 flex items-center justify-center text-5xl font-black text-emerald-400 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
                                    {initials}
                                </div>
                                {/* Orange Badge */}
                                <div className="absolute -bottom-3 -right-3 bg-orange-500 text-white p-2.5 rounded-xl shadow-sm border-2 border-[#1e293b]">
                                    <Trophy className="w-5 h-5" />
                                </div>
                            </div>

                            <div className="text-center md:text-left mb-2 md:mb-4">
                                <h1 className="text-3xl font-black text-white uppercase tracking-wide flex items-center justify-center md:justify-start gap-2">
                                    {profile.fullName}
                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                </h1>
                                <p className="text-gray-400 font-bold mt-1 uppercase text-sm tracking-wider">
                                    {profile.followers} Followers • <span className="text-emerald-400">{profile.role}</span>
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-2 md:mb-4 w-full md:w-auto justify-center md:justify-end">
                            {isMyProfile ? (
                                <>
                                    <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-6 py-2.5 rounded-xl font-black uppercase text-sm tracking-wide shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 border-2 border-transparent transition-all active:translate-y-1 active:shadow-none">
                                        <PlaySquare className="w-5 h-5" /> Add Highlight
                                    </button>
                                    <button className="bg-[#1e293b] hover:bg-gray-800 text-white px-6 py-2.5 rounded-xl font-black uppercase text-sm tracking-wide shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] border-2 border-gray-700 flex items-center justify-center gap-2 transition-all active:translate-y-1 active:shadow-none">
                                        <Edit className="w-5 h-5 text-emerald-400" /> Edit Profile
                                    </button>
                                </>
                            ) : (
                                <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-10 py-2.5 rounded-xl font-black uppercase text-sm tracking-wide shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all active:translate-y-1 active:shadow-none">
                                    Message
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar mt-6 border-t-2 border-gray-800 pt-2">
                        {['timeline', 'about', 'connections'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-6 py-4 font-black text-xs sm:text-sm uppercase tracking-widest transition-colors ${
                                    activeTab === tab
                                        ? "text-emerald-400 border-b-4 border-emerald-500 bg-gray-800/30"
                                        : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/30"
                                }`}
                            >
                                {tab === 'timeline' ? 'Match Feed' : tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* === MAIN CONTENT (2 Column Grid) === */}
            <div className="max-w-5xl mx-auto px-4 sm:px-0 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT COLUMN: Intro & Details */}
                    <div className="lg:col-span-1 flex flex-col gap-6">

                        {/* Player Manifesto */}
                        <div className="bg-[#1e293b] rounded-3xl p-6 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
                            <h2 className="text-emerald-400 font-black italic uppercase tracking-wider mb-4 flex items-center gap-2">
                                Player Manifesto
                            </h2>
                            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700/50 mb-4">
                                <p className="text-gray-300 font-medium italic leading-relaxed text-sm">
                                    "{profile.bio}"
                                </p>
                            </div>
                            {isMyProfile && (
                                <button className="w-full bg-gray-800 hover:bg-gray-700 text-white font-black uppercase text-xs tracking-wider py-2.5 rounded-xl border-2 border-gray-700 transition-colors">
                                    Edit Manifesto
                                </button>
                            )}
                        </div>

                        {/* Player Intel */}
                        <div className="bg-[#1e293b] rounded-3xl p-6 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
                            <h2 className="text-emerald-400 font-black italic uppercase tracking-wider mb-5">Player Intel</h2>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-emerald-500 shrink-0 border border-gray-700">
                                        <MapPin className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Base</p>
                                        <p className="font-bold text-white uppercase text-sm">{profile.location}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-blue-400 shrink-0 border border-gray-700">
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Role</p>
                                        <p className="font-bold text-white uppercase text-sm">{profile.position}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-orange-400 shrink-0 border border-gray-700">
                                        <div className="w-5 h-5 border-2 border-current rounded-md flex items-center justify-center text-[10px] font-black">L/R</div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Foot</p>
                                        <p className="font-bold text-white uppercase text-sm">{profile.strongFoot}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Experience */}
                        <div className="bg-[#1e293b] rounded-3xl p-6 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
                            <h2 className="text-emerald-400 font-black italic uppercase tracking-wider mb-5">Experience</h2>
                            <div className="flex flex-col gap-5">
                                {profile.experience.map((exp, idx) => (
                                    <div key={idx} className="flex gap-4 items-start">
                                        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center shrink-0 border border-gray-700">
                                            <Briefcase className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="font-black text-white uppercase text-sm">{exp.club}</p>
                                            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mt-0.5">{exp.role}</p>
                                            <p className="text-[10px] text-gray-500 font-bold tracking-wider mt-1">{exp.years}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Connections */}
                        <div className="bg-[#1e293b] rounded-3xl p-6 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
                            <div className="flex justify-between items-center mb-3">
                                <h2 className="text-emerald-400 font-black italic uppercase tracking-wider">Network</h2>
                                {isMyProfile && (
                                    <span title="Only you can see this">
                                        <Lock className="w-4 h-4 text-gray-500 hover:text-white transition-colors cursor-help" />
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-medium text-gray-400">
                                {isMyProfile ? "You follow 12 clubs and 33 people." : "Connections are private."}
                            </p>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: The Match Feed (Timeline) */}
                    <div className="lg:col-span-2 flex flex-col gap-6">

                        {activeTab === 'timeline' && (
                            <>
                                {/* Create Post / Highlight Upload Mock */}
                                {isMyProfile && (
                                    <div className="bg-[#1e293b] rounded-3xl p-5 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex gap-4 items-center">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-700 text-emerald-400 flex items-center justify-center font-black text-sm shrink-0 border-2 border-gray-600">
                                            {initials}
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="What's on your mind?"
                                            className="flex-1 bg-gray-800 rounded-xl py-3 px-5 text-sm font-medium text-white placeholder-gray-500 outline-none border-2 border-transparent hover:border-gray-700 transition-colors cursor-pointer"
                                            readOnly onClick={() => setIsModalOpen(true)}
                                        />
                                    </div>
                                )}

                                {/* Posts from Database */}
                                {posts.length === 0 ? (
                                    <div className="bg-[#1e293b] rounded-3xl p-10 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] text-center flex flex-col items-center justify-center mt-2">
                                        <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 text-gray-600 border-2 border-gray-700">
                                            <PlaySquare className="w-8 h-8" />
                                        </div>
                                        <h3 className="font-black text-white text-xl uppercase tracking-wide mb-2">No Match Footage Yet</h3>
                                        <p className="text-gray-400 font-medium text-sm max-w-sm">
                                            When clubs tag this player in match highlights, they will automatically appear here on their timeline.
                                        </p>
                                    </div>
                                ) : (
                                    posts.map(post => (
                                        <div key={post.id} className="bg-[#1e293b] rounded-3xl border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden">

                                            {/* Post Header */}
                                            <div className="p-5 flex justify-between items-start">
                                                <div className="flex gap-4 items-center">
                                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm bg-gray-700 text-emerald-400 border-2 border-gray-600">
                                                        {post.authorName.substring(0,2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-white text-sm uppercase tracking-wide">
                                                            {post.authorName}
                                                            {post.clubName && <span className="font-bold text-gray-500"> via {post.clubName}</span>}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-1">
                                                            {formatTime(post.createdAt)} • <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <button className="text-gray-500 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors">
                                                    <MoreHorizontal className="w-5 h-5" />
                                                </button>
                                            </div>

                                            {/* Post Body */}
                                            <div className="px-5 pb-4">
                                                <p className="text-gray-300 whitespace-pre-line leading-relaxed text-sm font-medium">
                                                    {post.content}
                                                </p>
                                            </div>

                                            {/* RENDERING THE UPLOADED MEDIA! */}
                                            {post.mediaUrls && post.mediaUrls.length > 0 && (
                                                <div
                                                    className="w-full bg-black border-y-2 border-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setSelectedPost(post)}
                                                >
                                                    {post.mediaUrls[0].endsWith('.mp4') || post.mediaUrls[0].endsWith('.mov') ? (
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <video
                                                                src={`${API_BASE_URL}${post.mediaUrls[0]}`}
                                                                controls
                                                                className="w-full max-h-[500px] object-contain"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={`${API_BASE_URL}${post.mediaUrls[0]}`}
                                                            alt="Post attachment"
                                                            className="w-full max-h-[500px] object-cover"
                                                        />
                                                    )}
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            <div className="px-3 py-2 border-t-2 border-gray-800 flex justify-between bg-gray-800/30">
                                                <button className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors ${post.isLikedByMe ? "text-emerald-400 bg-gray-800" : "text-gray-400 hover:text-emerald-400 hover:bg-gray-800"}`}>
                                                    <Heart className="w-4 h-4" fill={post.isLikedByMe ? "currentColor" : "none"} /> {post.likeCount || "Like"}
                                                </button>
                                                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                                                    <MessageCircle className="w-4 h-4" /> {post.commentCount || "Comment"}
                                                </button>
                                                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                                                    <Share2 className="w-4 h-4" /> Share
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </>
                        )}

                        {activeTab === 'about' && (
                            <div className="bg-[#1e293b] rounded-3xl p-10 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] text-center text-gray-500 font-bold uppercase tracking-widest">
                                Detailed biography coming soon.
                            </div>
                        )}

                        {activeTab === 'connections' && (
                            <div className="bg-[#1e293b] rounded-3xl p-10 border-2 border-gray-800 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] text-center text-gray-500 font-bold uppercase tracking-widest">
                                {isMyProfile ? "Manage your network here." : "Connections are private."}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Render the Create Post Modal */}
            <CreatePostModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onPostCreated={loadFeed}
            />

            {/* Render the Theater View Modal */}
            <PostTheaterModal
                isOpen={!!selectedPost}
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
            />
        </div>
    );
};