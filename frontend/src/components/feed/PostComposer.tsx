import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Send, Video, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
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
    const [content, setContent] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(!compact);
    const [submitError, setSubmitError] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLElement>(null);

    const expandComposer = () => {
        if (!compact || isExpanded) return;
        setIsExpanded(true);
        onExpand?.();
    };

    const collapseComposer = () => {
        if (!compact) return;
        if (content.trim() || selectedFile) return;
        setIsExpanded(false);
        setPreviewUrl(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    useEffect(() => {
        if (!compact || !isExpanded) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                collapseComposer();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [compact, isExpanded, content, selectedFile]);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            expandComposer();
            const file = event.target.files[0];
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
            const mediaIds: number[] = [];

            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                const mediaResponse = await apiClient.post('/media/upload', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                mediaIds.push(mediaResponse.data.id);
            }

            await apiClient.post('/posts', {
                content,
                clubId: clubId || null,
                isPublic: true,
                mediaIds
            });

            setContent('');
            removeFile();
            setSubmitError(false);
            onPostCreated();
            toast.success('Post published');
            if (compact) setIsExpanded(false);
        } catch (error) {
            console.error('Failed to create post', error);
            setSubmitError(true);
            toast.error('Failed to publish post. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section
            ref={containerRef}
            className="rounded-none border border-[var(--feed-card-border)] bg-[var(--feed-card)] p-3 transition-shadow"
        >
            <div className={`flex items-start gap-3 ${isExpanded || previewUrl ? 'mb-3' : ''}`}>
                {isExpanded && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--feed-layer-bg)] text-sm font-semibold text-[var(--feed-text-secondary)]">
                        {authorName.substring(0, 2).toUpperCase()}
                    </div>
                )}
                <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    onFocus={expandComposer}
                    onClick={expandComposer}
                    placeholder={clubId ? 'Publish a club update...' : "What's on your mind?"}
                    className={`flex-1 resize-none rounded-none border border-[var(--feed-card-border)] bg-[var(--feed-input-bg)] px-4 py-2.5 text-sm text-[var(--feed-text-primary)] outline-none placeholder:text-[var(--feed-text-placeholder)] focus:border-[var(--feed-accent)] transition-colors ${
                        isExpanded ? 'min-h-[88px]' : 'min-h-[40px]'
                    }`}
                    rows={isExpanded ? 3 : 1}
                />
                {isExpanded && (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!content.trim() && !selectedFile)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--feed-accent)] text-[var(--feed-accent-contrast)] transition-colors hover:bg-[var(--feed-accent-hover)] disabled:opacity-40"
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                )}
            </div>

            {previewUrl && (
                <div className="relative mb-3 ml-[52px] w-fit overflow-hidden rounded-none border border-[var(--feed-card-border)]">
                    <img src={previewUrl} alt="Upload preview" className="max-h-48 object-cover" />
                    <button type="button" onClick={removeFile} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
                        <span className="font-semibold">&times;</span>
                    </button>
                </div>
            )}

            {isExpanded && (
                <div className="ml-[52px] flex flex-wrap items-center gap-2 border-t border-[var(--feed-card-border)] pt-3">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-[var(--feed-card-border)] bg-[var(--feed-layer-bg)] px-3 py-2 text-xs font-medium text-[var(--feed-text-secondary)] transition-colors hover:border-[var(--feed-accent)] hover:text-[var(--feed-accent)]">
                        <Camera className="h-4 w-4" />
                        Photo
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-[var(--feed-card-border)] bg-[var(--feed-layer-bg)] px-3 py-2 text-xs font-medium text-[var(--feed-text-secondary)] transition-colors hover:border-[var(--feed-accent)] hover:text-[var(--feed-accent)]">
                        <Video className="h-4 w-4" />
                        Video
                    </button>
                    <button type="button" className="inline-flex items-center gap-2 rounded-full border border-[var(--feed-card-border)] bg-[var(--feed-layer-bg)] px-3 py-2 text-xs font-medium text-[var(--feed-text-secondary)] transition-colors hover:border-[var(--feed-accent)] hover:text-[var(--feed-accent)]">
                        <CalendarPlus className="h-4 w-4" />
                        Event
                    </button>
                </div>
            )}

            {submitError && (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300">
                    Failed to publish update. Please try again.
                </div>
            )}
        </section>
    );
};
