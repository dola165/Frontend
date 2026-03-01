import { useState, useRef, useEffect } from 'react';
import { apiClient } from '../api/axiosConfig';
import { X, Video, UserPlus, Loader2, Search } from 'lucide-react';

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPostCreated: () => void;
}

interface UserSearchDto {
    id: number;
    fullName: string;
    username: string;
    position: string;
}

export function CreatePostModal({ isOpen, onClose, onPostCreated }: CreatePostModalProps) {
    const [content, setContent] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Tagging States
    const [isTagging, setIsTagging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchDto[]>([]);
    const [taggedUsers, setTaggedUsers] = useState<UserSearchDto[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Live Search Effect
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            apiClient.get(`/users/search?q=${searchQuery}`)
                .then(res => setSearchResults(res.data))
                .catch(err => console.error("Search failed", err));
        }, 300); // 300ms delay so we don't spam the backend while typing

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const toggleTag = (user: UserSearchDto) => {
        if (taggedUsers.find(u => u.id === user.id)) {
            setTaggedUsers(taggedUsers.filter(u => u.id !== user.id)); // Remove tag
        } else {
            setTaggedUsers([...taggedUsers, user]); // Add tag
        }
    };

    const handleSubmit = async () => {
        if (!content.trim() && !selectedFile) return;
        setIsUploading(true);

        try {
            let mediaIds: number[] = [];

            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const uploadRes = await apiClient.post('/media/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                mediaIds.push(uploadRes.data.id);
            }

            await apiClient.post('/feed/posts', {
                content: content,
                clubId: null,
                mediaIds: mediaIds,
                taggedUserIds: taggedUsers.map(u => u.id) // Send the tagged IDs!
            });

            setContent('');
            setSelectedFile(null);
            setPreviewUrl(null);
            setTaggedUsers([]);
            setIsTagging(false);
            onPostCreated();
            onClose();

        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to create post.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-2xl shadow-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50 flex justify-between items-center">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-wide">
                        {isTagging ? "Tag Players" : "Create Highlight"}
                    </h2>
                    <button onClick={() => {
                        if (isTagging) setIsTagging(false);
                        else onClose();
                    }} className="p-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body (Changes based on whether we are tagging or posting) */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 no-scrollbar min-h-[200px]">

                    {isTagging ? (
                        /* TAGGING UI */
                        <div className="flex flex-col gap-4 h-full">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search for a player..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-100 dark:bg-gray-800 border-2 border-transparent focus:border-emerald-500 rounded-xl py-2.5 pl-9 pr-4 text-sm text-gray-900 dark:text-white outline-none transition-colors"
                                    autoFocus
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                {searchResults.map(user => {
                                    const isSelected = !!taggedUsers.find(u => u.id === user.id);
                                    return (
                                        <div
                                            key={user.id}
                                            onClick={() => toggleTag(user)}
                                            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors border-2 ${isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 text-xs shrink-0">
                                                {user.fullName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-900 dark:text-white text-sm">{user.fullName}</p>
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{user.position || "Player"}</p>
                                            </div>
                                            {isSelected && <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center mr-2"><X className="w-3 h-3 text-white" /></div>}
                                        </div>
                                    )
                                })}
                                {searchQuery && searchResults.length === 0 && (
                                    <div className="text-center text-gray-500 text-sm mt-4 font-medium">No players found.</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* NORMAL POST UI */
                        <>
                            <textarea
                                placeholder="What's happening? Add a description to your highlight..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full bg-transparent text-gray-900 dark:text-white text-lg resize-none outline-none min-h-[100px] placeholder-gray-400"
                            />

                            {/* Render Tagged Users Chips */}
                            {taggedUsers.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center mr-1">With:</span>
                                    {taggedUsers.map(user => (
                                        <span key={user.id} className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-black tracking-wider flex items-center gap-1">
                                            @{user.fullName}
                                            <X className="w-3 h-3 cursor-pointer hover:text-emerald-900" onClick={() => toggleTag(user)} />
                                        </span>
                                    ))}
                                </div>
                            )}

                            {previewUrl && (
                                <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shrink-0">
                                    <button
                                        onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                        className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black transition-colors z-10"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    {selectedFile?.type.startsWith('video/') ? (
                                        <video src={previewUrl} controls className="w-full max-h-[300px] object-contain" />
                                    ) : (
                                        <img src={previewUrl} alt="Preview" className="w-full max-h-[300px] object-contain" />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50 flex justify-between items-center shrink-0">

                    {isTagging ? (
                        <button
                            onClick={() => setIsTagging(false)}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 py-2.5 rounded-xl font-black uppercase text-sm tracking-wide transition-colors"
                        >
                            Done Tagging
                        </button>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <input
                                    type="file" ref={fileInputRef} className="hidden"
                                    accept="image/*,video/mp4,video/quicktime"
                                    onChange={handleFileSelect}
                                />
                                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-blue-600 dark:text-emerald-400 bg-blue-50 dark:bg-emerald-400/10 hover:bg-blue-100 dark:hover:bg-emerald-400/20 rounded-lg transition-colors font-bold flex items-center gap-2 text-sm" title="Add Media">
                                    <Video className="w-5 h-5" /> Media
                                </button>
                                <button
                                    onClick={() => setIsTagging(true)}
                                    className="p-2 text-blue-600 dark:text-emerald-400 bg-blue-50 dark:bg-emerald-400/10 hover:bg-blue-100 dark:hover:bg-emerald-400/20 rounded-lg transition-colors font-bold flex items-center gap-2 text-sm" title="Tag Players"
                                >
                                    <UserPlus className="w-5 h-5" /> Tag
                                </button>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={isUploading || (!content.trim() && !selectedFile)}
                                className="bg-blue-600 dark:bg-emerald-500 hover:bg-blue-700 dark:hover:bg-emerald-400 text-white dark:text-slate-900 px-6 py-2 rounded-xl font-black uppercase text-sm tracking-wide disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isUploading ? 'Posting...' : 'Post'}
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    );
}