import { useRef, useState } from 'react';
import { Camera, Loader2, Send, Video, X } from 'lucide-react';
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const expandComposer = () => {
        if (!compact || isExpanded) return;
        setIsExpanded(true);
        onExpand?.();
    };

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
            onPostCreated();
            if (compact) setIsExpanded(false);
        } catch (error) {
            console.error('Failed to create post', error);
            alert('Failed to publish update.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const wrapperClassName = compact
        ? 'rounded-[18px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] px-3.5 py-3.5 shadow-[0_16px_28px_rgba(2,6,12,0.2)]'
        : 'rounded-[22px] border border-[color:var(--club-theme-border-subtle)] bg-[rgba(12,18,27,0.96)] px-4 py-4 shadow-[0_18px_32px_rgba(2,6,12,0.22)]';

    return (
        <section className={wrapperClassName}>
            <div className={`flex items-start gap-3 ${isExpanded || previewUrl ? 'mb-3' : ''}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center border border-white/8 bg-white/[0.04] text-sm font-black uppercase text-[color:var(--club-theme-text-primary)] ${compact ? 'rounded-[10px] text-[10px]' : 'rounded-full'}`}>
                    {authorName.substring(0, 2).toUpperCase()}
                </div>
                <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    onFocus={expandComposer}
                    onClick={expandComposer}
                    placeholder={clubId ? 'Publish a club update...' : 'Share an operational update...'}
                    className={`flex-1 resize-none rounded-[16px] border border-white/8 bg-white/[0.03] px-3.5 py-2.5 text-[13px] text-[color:var(--club-theme-text-primary)] outline-none placeholder:text-[color:var(--club-theme-text-muted)] focus:border-[color:var(--club-tone-green-border)] ${isExpanded ? 'min-h-[82px]' : 'min-h-[42px]'}`}
                    rows={compact ? (isExpanded ? 3 : 1) : (content.split('\n').length > 2 ? 3 : 1)}
                />
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || (!content.trim() && !selectedFile)}
                    className={`inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--club-tone-green-border)] bg-[color:var(--club-tone-green)] text-[#031108] disabled:opacity-50 ${compact ? 'h-10 w-10' : 'px-4 py-2.5'}`}
                >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {!compact && 'Post'}
                </button>
            </div>

            {previewUrl && (
                <div className="relative mb-3 ml-[44px] w-fit overflow-hidden rounded-[16px] border border-white/8">
                    <img src={previewUrl} alt="Upload preview" className={`${compact ? 'max-h-36' : 'max-h-48'} object-cover`} />
                    <button type="button" onClick={removeFile} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {isExpanded && (
                <div className="ml-[44px] flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
                    <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-primary)]">
                            <Camera className="h-4 w-4 text-[color:var(--club-tone-green)]" />
                            Photo
                        </button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-primary)]">
                            <Video className="h-4 w-4 text-[color:var(--club-tone-blue)]" />
                            Video
                        </button>
                    </div>

                    {compact && <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--club-theme-text-secondary)]">Composer Expanded</p>}
                </div>
            )}
        </section>
    );
};
