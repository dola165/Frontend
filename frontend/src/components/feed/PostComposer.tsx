import { useRef, useState } from 'react';
import { Camera, Video, Loader2, X, Send } from 'lucide-react';
import { apiClient } from '../../api/axiosConfig';

interface PostComposerProps {
    clubId?: number;
    authorName?: string;
    onPostCreated: () => void;
    contextType?: string;
    contextId?: number;
    compact?: boolean;
    onExpand?: () => void;
}

export const PostComposer = ({
    clubId,
    authorName = 'You',
    onPostCreated,
    compact = false,
    onExpand
}: PostComposerProps) => {
    const [content, setContent] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(!compact);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const expandComposer = () => {
        if (!compact || isExpanded) return;
        setIsExpanded(true);
        onExpand?.();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            expandComposer();
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const removeFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async () => {
        if (!content.trim() && !selectedFile) return;
        setIsSubmitting(true);

        try {
            let mediaIds: number[] = [];

            // 1. Upload Media First (if a file was selected)
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const mediaRes = await apiClient.post('/media/upload', formData, {
                    headers: {'Content-Type': 'multipart/form-data'}
                });
                // Assuming the backend returns the MediaDto with an 'id'
                mediaIds.push(mediaRes.data.id);
            }

            // 2. Create the Post
            const postPayload = {
                content: content,
                clubId: clubId || null,
                isPublic: true,
                mediaIds: mediaIds
            };

            await apiClient.post('/posts', postPayload);

            // 3. Clean up and refresh
            setContent("");
            removeFile();
            onPostCreated(); // Tell the parent page to re-fetch the feed
            if (compact) {
                setIsExpanded(false);
            }

        } catch (error) {
            console.error("Failed to create post", error);
            alert("Failed to broadcast update.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const wrapperClassName = compact
        ? 'theme-surface rounded-xl border theme-border p-3 shadow-sm transition-colors'
        : 'theme-surface rounded-xl border-2 theme-border-strong p-4 shadow-lg transition-colors dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)]';
    const textareaClassName = compact
        ? `flex-1 border-none rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-inner resize-none transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:bg-slate-800/50 dark:text-white ${isExpanded ? 'min-h-[112px]' : 'min-h-[48px]'}`
        : 'flex-1 border-none rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-inner resize-none transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:bg-slate-800/50 dark:text-white min-h-[48px]';
    const submitButtonClassName = compact
        ? 'shrink-0 flex h-12 w-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white shadow-sm transition-all hover:bg-emerald-500 disabled:opacity-50'
        : 'shrink-0 flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-6 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-500 disabled:opacity-50';
    const previewOffsetClassName = 'ml-[52px]';

    return (
        <div className={wrapperClassName}>
            <div className={`flex items-start gap-3 ${isExpanded || previewUrl ? 'mb-3' : ''}`}>
                <div
                    className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm border border-emerald-700">
                    {authorName.substring(0, 2).toUpperCase()}
                </div>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onFocus={expandComposer}
                    onClick={expandComposer}
                    placeholder={clubId ? "Broadcast an update to followers..." : "Share intel with the network..."}
                    className={textareaClassName}
                    rows={compact ? (isExpanded ? 3 : 1) : (content.split('\n').length > 2 ? 3 : 1)}
                />
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!content.trim() && !selectedFile)}
                    className={submitButtonClassName}
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {!compact && 'POST'}
                </button>
            </div>

            {previewUrl && (
                <div
                    className={`relative ${previewOffsetClassName} mb-3 w-fit overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700`}>
                    <img src={previewUrl} alt="Upload preview" className={`${compact ? 'max-h-36' : 'max-h-48'} object-cover`} />
                    <button onClick={removeFile}
                            className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {isExpanded && (
                <div
                    className={`${previewOffsetClassName} flex items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800`}>
                    <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"
                               accept="image/*,video/*" />
                        <button onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                            <Camera className="w-4 h-4" /> <span className="hidden sm:inline">Photo</span>
                        </button>
                        <button onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                            <Video className="w-4 h-4" /> <span className="hidden sm:inline">Video</span>
                        </button>
                    </div>

                    {compact && (
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Rich composer active
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
