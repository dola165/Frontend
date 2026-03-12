import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig';
import {
    ThumbsUp, MessageCircle, Share2, ShieldCheck,
    Send, Image as ImageIcon, X, Loader2, MoreHorizontal, Heart, Plus
} from 'lucide-react';

// --- INTERFACES ---
interface FeedPostDto {
    id: number;
    content: string;
    createdAt: string;
    authorId: number;
    authorName: string;
    clubId: number | null;
    clubName: string | null;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
    mediaUrls?: string[];
}

interface CommentDto {
    id: number;
    authorName: string;
    content: string;
    createdAt: string;
}

// Utility to prepend backend URL if running locally
const getMediaUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('/uploads/')) return `http://localhost:8080${url}`;
    return url;
};

export const FeedPage = () => {
    // --- STATE ---
    const [posts, setPosts] = useState<FeedPostDto[]>([]);
    const [loading, setLoading] = useState(true);

    const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
    const [commentsData, setCommentsData] = useState<Record<number, CommentDto[]>>({});
    const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

    // COMPOSER STATE
    const [postContent, setPostContent] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [isPosting, setIsPosting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // LIGHTBOX (THEATER MODE) STATE
    const [lightboxPost, setLightboxPost] = useState<{ post: FeedPostDto, imageIndex: number } | null>(null);

    // --- FETCH DATA ---
    const fetchFeed = () => {
        apiClient.get('/feed')
            .then(res => setPosts(res.data.posts || res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchFeed(); }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightboxPost(null);
        };
        if (lightboxPost) window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxPost]);

    // --- COMPOSER LOGIC ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files]);
            const newUrls = files.map(file => URL.createObjectURL(file));
            setPreviewUrls(prev => [...prev, ...newUrls]);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (indexToRemove: number) => {
        setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
        setPreviewUrls(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const submitPost = async () => {
        if (!postContent.trim() && selectedFiles.length === 0) return;
        setIsPosting(true);

        try {
            const mediaIds: number[] = [];
            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                const mediaRes = await apiClient.post('/media/upload', formData);
                mediaIds.push(mediaRes.data.id);
            }

            await apiClient.post('/posts', {
                content: postContent,
                isPublic: true,
                clubId: null,
                mediaIds: mediaIds
            });

            setPostContent('');
            setSelectedFiles([]);
            setPreviewUrls([]);
            fetchFeed();
        } catch (error) {
            console.error("Failed to deploy post", error);
        } finally {
            setIsPosting(false);
        }
    };

    // --- INTERACTION LOGIC ---
    const toggleLike = async (postId: number) => {
        try {
            const res = await apiClient.post(`/posts/${postId}/like`);
            const isNowLiked = res.data.isLiked;

            setPosts(posts.map(p => {
                if (p.id === postId) {
                    return { ...p, isLikedByMe: isNowLiked, likeCount: isNowLiked ? p.likeCount + 1 : p.likeCount - 1 };
                }
                return p;
            }));

            // Sync lightbox if it's currently open
            if (lightboxPost?.post.id === postId) {
                setLightboxPost(prev => prev ? { ...prev, post: { ...prev.post, isLikedByMe: isNowLiked, likeCount: isNowLiked ? prev.post.likeCount + 1 : prev.post.likeCount - 1 } } : null);
            }
        } catch (err) { console.error("Failed to toggle like", err); }
    };

    const fetchComments = async (postId: number) => {
        if (!commentsData[postId]) {
            try {
                const res = await apiClient.get(`/posts/${postId}/comments`);
                setCommentsData(prev => ({ ...prev, [postId]: res.data }));
            } catch (err) { console.error("Failed to load comments", err); }
        }
    };

    const handleLikeToggle = async (postId: number) => {
        // Optimistically update UI immediately
        setPosts(current => current.map(post =>
            post.id === postId
                ? {
                    ...post,
                    isLikedByMe: !post.isLikedByMe,
                    likeCount: post.isLikedByMe ? post.likeCount - 1 : post.likeCount + 1
                }
                : post
        ));

        // Send request to backend
        try {
            await apiClient.post(`/feed/posts/${postId}/like`);
        } catch (error) {
            console.error("Failed to toggle like", error);
            // Optionally revert state here if it fails
        }
    };

    const toggleComments = (postId: number) => {
        const isCurrentlyOpen = !!openComments[postId];
        setOpenComments(prev => ({ ...prev, [postId]: !isCurrentlyOpen }));
        if (!isCurrentlyOpen) fetchComments(postId);
    };

    const submitComment = async (postId: number) => {
        const content = commentInputs[postId];
        if (!content?.trim()) return;

        try {
            const res = await apiClient.post(`/posts/${postId}/comments`, { content });
            const newComment = { id: res.data.commentId || Date.now(), authorName: "Me", content, createdAt: new Date().toISOString() };

            setCommentsData(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newComment] }));
            setCommentInputs(prev => ({ ...prev, [postId]: "" }));
            setPosts(posts.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));

            if (lightboxPost?.post.id === postId) {
                setLightboxPost(prev => prev ? { ...prev, post: { ...prev.post, commentCount: prev.post.commentCount + 1 } } : null);
            }
        } catch (err) { console.error("Failed to submit comment", err); }
    };

    const openLightbox = (post: FeedPostDto, index: number) => {
        setLightboxPost({ post, imageIndex: index });
        fetchComments(post.id); // Pre-load comments for the theater view
    };

    if (loading) return <div className="flex-1 flex justify-center items-center h-[calc(100vh-56px)] bg-slate-100 dark:bg-[#0f172a] text-emerald-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;

    return (
        <div className="min-h-[calc(100vh-56px)] bg-slate-100 dark:bg-[#0b141a] flex justify-center py-6 font-sans">
            <div className="w-full max-w-2xl px-4 flex flex-col gap-6">

                {/* STORIES SECTION */}
                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                    {/* Add Story Button */}
                    <div className="relative min-w-[110px] h-[190px] bg-white dark:bg-[#1e293b] rounded-xl border-2 border-slate-300 dark:border-black cursor-pointer overflow-hidden group shadow-md dark:shadow-[0_8px_20px_rgba(0,0,0,0.8)]">
                        <div className="h-2/3 bg-slate-200 dark:bg-slate-700">
                            {/* User's profile pic would go here */}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-1/3 flex items-center justify-center">
                            {/* RED BACKGROUND HERE */}
                            <div className="bg-rose-500 p-1.5 rounded-full border-4 border-white dark:border-[#1e293b] -mt-10 shadow-lg">
                                <Plus className="w-5 h-5 text-white" />
                            </div>
                            <span className="absolute bottom-2 text-[11px] font-bold text-slate-900 dark:text-white uppercase">Create Story</span>
                        </div>
                    </div>

                    {/* Mock Stories */}
                    {['Saba', 'Luka', 'Nika'].map((name, i) => (
                        <div key={i} className="relative min-w-[110px] h-[190px] rounded-xl overflow-hidden cursor-pointer border-2 border-slate-300 dark:border-black shadow-md dark:shadow-[0_8px_20px_rgba(0,0,0,0.8)] transition-transform hover:-translate-y-1">
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 z-10" />
                            {/* RED BORDER HERE */}
                            <div className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full border-4 border-rose-500 bg-slate-800 flex items-center justify-center text-[10px] font-black shadow-lg">
                                {name.substring(0,2).toUpperCase()}
                            </div>
                            <span className="absolute bottom-2 left-2 right-2 z-20 text-[11px] font-bold text-white uppercase tracking-tight">{name}</span>
                        </div>
                    ))}
                </div>

                {/* === THE COMPOSER === */}
                <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)] p-4 flex flex-col gap-3">                    <div className="flex gap-3">
                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center font-bold text-slate-500 shrink-0">ME</div>
                        <input
                            type="text"
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            placeholder="What's happening on the pitch?"
                            className="flex-1 bg-slate-100 dark:bg-slate-800/50 border-none text-slate-900 dark:text-white rounded-full px-4 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium text-sm"
                        />
                    </div>

                    {previewUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 ml-13">
                            {previewUrls.map((url, idx) => (
                                <div key={idx} className="relative w-20 h-20 shrink-0">
                                    <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover rounded-md border border-slate-200 dark:border-slate-700" />
                                    <button onClick={() => removeFile(idx)} className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full shadow-sm hover:bg-rose-500 transition-colors"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800 ml-13">
                        <div>
                            <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors flex items-center gap-2 font-bold text-sm">
                                <ImageIcon className="w-5 h-5 text-emerald-500" /> Photo
                            </button>
                        </div>
                        <button onClick={submitPost} disabled={isPosting || (!postContent.trim() && selectedFiles.length === 0)} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white px-6 py-2 rounded-md font-bold text-sm transition-all flex items-center gap-2">
                            {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
                        </button>
                    </div>
                </div>

                {/* === THE FEED === */}
                {posts.map((post) => (
                    <div
                        key={post.id}
                        className="group bg-white dark:bg-[#1e293b] rounded-md border-2 border-slate-300 dark:border-black overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-md dark:shadow-[0_10px_30px_rgba(0,0,0,0.7)] hover:shadow-xl dark:hover:shadow-[0_15px_40px_rgba(0,0,0,0.9)] hover:border-emerald-500/50 dark:hover:border-emerald-500/50 cursor-pointer"
                    >
                        {/* Header */}
                        <div className="p-4 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-sm bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 group-hover:scale-110 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-500/50 transition-all duration-300">
                                    {post.authorName.substring(0,2).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                        <Link to={`/users/${post.authorId}`} className="font-bold text-slate-900 dark:text-white hover:underline text-[15px]">
                                            {post.authorName}
                                        </Link>
                                        {post.clubName && (
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                                <ShieldCheck className="w-3.5 h-3.5" /> {post.clubName}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-500 font-medium">{new Date(post.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                </div>
                            </div>
                            <button className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors"><MoreHorizontal className="w-5 h-5" /></button>
                        </div>

                        {/* Body Text */}
                        {post.content && (
                            <div className="px-4 pb-3">
                                <p className="text-slate-800 dark:text-slate-200 text-[15px] leading-relaxed whitespace-pre-wrap">{post.content}</p>
                            </div>
                        )}

                        {/* Restructured Image Grid (Natural Facebook style) */}
                        {post.mediaUrls && post.mediaUrls.length > 0 && (
                            <div className={`grid gap-0.5 border-y border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 ${post.mediaUrls.length === 1 ? 'grid-cols-1' : post.mediaUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                {post.mediaUrls.map((url, i) => (
                                    <div
                                        key={i}
                                        className="relative w-full cursor-pointer hover:opacity-95 transition-opacity"
                                        style={{ maxHeight: post.mediaUrls!.length === 1 ? '500px' : '250px' }}
                                        onClick={() => openLightbox(post, i)}
                                    >
                                        <img src={getMediaUrl(url)} alt={`Attachment ${i}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Interaction Bar (Fixed: Text color changes, no full background) */}
                        <div className="flex border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827]">
                            {/* LIKE BUTTON */}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleLikeToggle(post.id); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 border-r border-slate-800 hover:bg-rose-500/10 hover:text-rose-500 ${post.isLikedByMe ? "text-rose-500 bg-rose-500/5" : "text-slate-500"}`}
                            >
                                <Heart
                                    className={`w-4 h-4 transition-transform duration-200 ${post.isLikedByMe ? 'scale-110' : 'hover:scale-125'}`}
                                    fill={post.isLikedByMe ? "currentColor" : "none"}
                                /> ACK
                            </button>
                            {/* COMMENT BUTTON */}
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleComments(post.id); }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 border-r border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:text-emerald-500 text-slate-500`}
                            >
                                <MessageCircle className="w-4 h-4 transition-transform duration-200 hover:scale-125" /> INTEL
                            </button>

                            {/* SHARE BUTTON */}
                            <button
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:text-blue-500"
                            >
                                <Share2 className="w-4 h-4 transition-transform duration-200 hover:scale-125" /> RELAY
                            </button>
                        </div>

                        {/* Standard Inline Comments */}
                        {openComments[post.id] && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-3">
                                {!commentsData[post.id] ? (
                                    <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                                ) : (
                                    commentsData[post.id].map(comment => (
                                        <div key={comment.id} className="flex gap-2">
                                            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">{comment.authorName.charAt(0)}</div>
                                            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2 flex flex-col">
                                                <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight">{comment.authorName}</span>
                                                <span className="text-[14px] text-slate-800 dark:text-slate-200 leading-snug">{comment.content}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div className="flex gap-2 items-center mt-2">
                                    <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0"></div>
                                    <input type="text" placeholder="Write a comment..." value={commentInputs[post.id] || ""} onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-sm rounded-full px-4 py-2 outline-none focus:ring-1 focus:ring-slate-300" />
                                    <button onClick={() => submitComment(post.id)} disabled={!commentInputs[post.id]?.trim()} className="text-blue-500 disabled:text-slate-400 p-2"><Send className="w-5 h-5" /></button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* === FACEBOOK-STYLE LIGHTBOX / THEATER MODE (Point 5) === */}
            {lightboxPost && (
                <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col md:flex-row backdrop-blur-sm animate-in fade-in duration-200">
                    <button onClick={() => setLightboxPost(null)} className="absolute top-4 left-4 z-50 p-2 bg-black/50 text-white rounded-full hover:bg-black/80 transition-colors"><X className="w-6 h-6" /></button>

                    {/* Left: Huge Image Viewer */}
                    <div className="flex-1 flex items-center justify-center p-4 md:p-12 relative h-[50vh] md:h-screen">
                        <img src={getMediaUrl(lightboxPost.post.mediaUrls![lightboxPost.imageIndex])} alt="Enlarged view" className="max-w-full max-h-full object-contain drop-shadow-2xl" />
                    </div>

                    {/* Right: Interaction Sidebar */}
                    <div className="w-full md:w-[400px] bg-white dark:bg-[#1e293b] h-[50vh] md:h-screen flex flex-col shadow-[-10px_0px_30px_rgba(0,0,0,0.5)]">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-emerald-500">{lightboxPost.post.authorName?.substring(0,2).toUpperCase()}</div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-[15px]">{lightboxPost.post.authorName}</h3>
                                <p className="text-xs text-slate-500 font-medium">{new Date(lightboxPost.post.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                            <p className="text-[15px] text-slate-800 dark:text-slate-200">{lightboxPost.post.content}</p>
                            <div className="flex items-center gap-4 mt-4">
                                <button onClick={() => toggleLike(lightboxPost.post.id)} className={`flex items-center gap-1.5 font-bold text-sm transition-colors ${lightboxPost.post.isLikedByMe ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                                    <ThumbsUp className={`w-5 h-5 ${lightboxPost.post.isLikedByMe ? 'fill-current' : ''}`} /> {lightboxPost.post.likeCount}
                                </button>
                                <span className="text-sm font-bold text-slate-500 flex items-center gap-1.5"><MessageCircle className="w-5 h-5"/> {lightboxPost.post.commentCount}</span>
                            </div>
                        </div>

                        {/* Lightbox Comments */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                            {!commentsData[lightboxPost.post.id] ? (
                                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                            ) : (
                                commentsData[lightboxPost.post.id].map(comment => (
                                    <div key={comment.id} className="flex gap-2">
                                        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">{comment.authorName.charAt(0)}</div>
                                        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2">
                                            <span className="text-[13px] font-bold text-slate-900 dark:text-white block">{comment.authorName}</span>
                                            <span className="text-[14px] text-slate-800 dark:text-slate-200">{comment.content}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Lightbox Input */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2 items-center bg-white dark:bg-[#1e293b] shrink-0">
                            <input type="text" placeholder="Write a comment..." value={commentInputs[lightboxPost.post.id] || ""} onChange={(e) => setCommentInputs(prev => ({ ...prev, [lightboxPost.post.id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && submitComment(lightboxPost.post.id)} className="flex-1 bg-slate-100 dark:bg-slate-800 text-sm rounded-full px-4 py-2.5 outline-none focus:ring-1 focus:ring-slate-300" />
                            <button onClick={() => submitComment(lightboxPost.post.id)} disabled={!commentInputs[lightboxPost.post.id]?.trim()} className="text-blue-500 disabled:text-slate-400 p-2"><Send className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};