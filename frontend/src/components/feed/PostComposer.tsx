import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Camera, Loader2, Send, Video } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../api/axiosConfig';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface PostComposerProps {
  clubId?: number;
  authorName?: string;
  avatarUrl?: string | null;
  onPostCreated: () => void;
  contextType?: string;
  contextId?: number;
  compact?: boolean;
  onExpand?: () => void;
  onCreateEvent?: () => void;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const PostComposer = ({
  clubId,
  authorName = 'You',
  avatarUrl,
  onPostCreated,
  compact = false,
  onExpand,
  onCreateEvent
}: PostComposerProps) => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [submitError, setSubmitError] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);

  const expandComposer = () => {
    if (!compact || isExpanded) return;
    setIsExpanded(true);
    onExpand?.();
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  useEffect(() => {
    if (!compact || !isExpanded) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node) && !content.trim() && !selectedFile) {
        setIsExpanded(false);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (videoInputRef.current) videoInputRef.current.value = '';
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [compact, isExpanded, content, selectedFile]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Choose an image or video file.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('Uploads must be 25 MB or smaller.');
      event.target.value = '';
      return;
    }

    expandComposer();
    setSelectedFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setSubmitError(false);
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
      clearFile();
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

  const openAttachmentPicker = (type: 'photo' | 'video') => {
    expandComposer();
    if (type === 'photo') imageInputRef.current?.click();
    else videoInputRef.current?.click();
  };

  const openEventCreator = () => {
    expandComposer();
    if (onCreateEvent) onCreateEvent();
    else navigate('/calendar?newEvent=1');
  };

  const collapsed = compact && !isExpanded;
  const compactActionClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--feed-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--feed-accent)]';

  return (
    <section ref={containerRef} className={`rounded-2xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] shadow-[var(--feed-shadow-panel)] transition-shadow focus-within:shadow-[var(--feed-shadow-float)] ${collapsed ? 'p-3' : 'p-4'}`}>
      <input type="file" ref={imageInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
      <input type="file" ref={videoInputRef} onChange={handleFileSelect} className="hidden" accept="video/*" />

      <div className={`flex gap-2.5 ${collapsed ? 'items-center' : 'items-start'}`}>
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--feed-layer-bg)] text-sm font-bold text-[var(--feed-text-secondary)] ring-1 ring-[var(--feed-card-border)] ${collapsed ? 'h-10 w-10' : 'h-11 w-11'}`}>
          {resolvedAvatarUrl ? <img src={resolvedAvatarUrl} alt="" className="h-full w-full object-cover" /> : authorName.substring(0, 2).toUpperCase()}
        </div>
        <textarea
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setSubmitError(false);
          }}
          onFocus={expandComposer}
          onClick={expandComposer}
          placeholder={clubId ? 'Share an update from your club…' : `What do you want to share, ${authorName.split(' ')[0]}?`}
          aria-label={clubId ? 'Create a club post' : 'Create a post'}
          className={`min-w-0 flex-1 resize-none border border-[var(--feed-card-border)] bg-[var(--feed-input-bg)] px-4 text-sm leading-6 text-[var(--feed-text-primary)] outline-none placeholder:text-[var(--feed-text-placeholder)] transition-colors focus:border-[var(--feed-accent)] ${isExpanded ? 'min-h-[104px] rounded-2xl py-3' : 'h-10 min-h-10 overflow-hidden rounded-full py-2'}`}
          rows={isExpanded ? 3 : 1}
        />
        {collapsed && (
          <div className="flex shrink-0 items-center gap-0.5" aria-label="Add to your post">
            <button type="button" onClick={() => openAttachmentPicker('video')} className={compactActionClass} aria-label="Add video" title="Video">
              <Video className="h-5 w-5 text-rose-500" />
            </button>
            <button type="button" onClick={() => openAttachmentPicker('photo')} className={compactActionClass} aria-label="Add photo" title="Photo">
              <Camera className="h-5 w-5 text-emerald-500" />
            </button>
            <button type="button" onClick={openEventCreator} className={compactActionClass} aria-label="Create event" title="Event">
              <CalendarPlus className="h-5 w-5 text-amber-400" />
            </button>
          </div>
        )}
        {isExpanded && (
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || (!content.trim() && !selectedFile)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--feed-accent)] text-[var(--feed-accent-contrast)] transition-colors hover:bg-[var(--feed-accent-hover)] disabled:opacity-40" aria-label="Publish post">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        )}
      </div>

      {previewUrl && selectedFile && (
        <div className="relative mt-3 ml-14 overflow-hidden rounded-2xl border border-[var(--feed-card-border)] bg-[var(--feed-layer-bg)]">
          {selectedFile.type.startsWith('video/') ? (
            <video src={previewUrl} controls className="max-h-72 w-full object-contain" />
          ) : (
            <img src={previewUrl} alt="Upload preview" className="max-h-72 w-full object-contain" />
          )}
          <button type="button" onClick={clearFile} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90" aria-label="Remove attachment">&times;</button>
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 grid grid-cols-3 border-t border-[var(--feed-divider)] pt-3">
          <button type="button" onClick={() => openAttachmentPicker('photo')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--feed-text-secondary)] transition-colors hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-primary)]">
            <Camera className="h-4 w-4 text-emerald-500" /> Photo
          </button>
          <button type="button" onClick={() => openAttachmentPicker('video')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--feed-text-secondary)] transition-colors hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-primary)]">
            <Video className="h-4 w-4 text-rose-500" /> Video
          </button>
          <button type="button" onClick={openEventCreator} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--feed-text-secondary)] transition-colors hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-primary)]">
            <CalendarPlus className="h-4 w-4 text-amber-400" /> Event
          </button>
        </div>
      )}

      {submitError && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">Failed to publish this post. Your draft is still here—please try again.</div>}
    </section>
  );
};
