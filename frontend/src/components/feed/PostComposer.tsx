import { MediaImage } from '../ui/MediaImage';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Camera, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../api/axiosConfig';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { SOCIAL_IMAGE_ACCEPT, socialImageUploadError, validateSocialImage } from '../../utils/socialImageUpload';

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
  const [uploadedMediaId, setUploadedMediaId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const submissionPending = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);

  const expandComposer = () => {
    if (!compact || isExpanded) return;
    setIsExpanded(true);
    onExpand?.();
  };

  const resetFile = () => {
    setFileError(null);
    setSelectedFile(null);
    setUploadedMediaId(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const clearFile = () => {
    if (submissionPending.current) return;
    resetFile();
  };

  useEffect(() => {
    if (!compact || !isExpanded) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!submissionPending.current && containerRef.current && !containerRef.current.contains(event.target as Node) && !content.trim() && !selectedFile) {
        setIsExpanded(false);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [compact, isExpanded, content, selectedFile]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (submissionPending.current) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateSocialImage(file);
    if (validationError) {
      setFileError(validationError);
      toast.error(validationError);
      event.target.value = '';
      return;
    }
    setFileError(null);

    expandComposer();
    setSelectedFile(file);
    setUploadedMediaId(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    // The ref closes the same-tick gap before React disables the controls.
    if (submissionPending.current || (!content.trim() && !selectedFile)) return;
    submissionPending.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    let uploading = false;
    try {
      const mediaIds: number[] = [];
      let mediaId = uploadedMediaId;
      if (selectedFile && mediaId == null) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        uploading = true;
        const mediaResponse = await apiClient.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploading = false;
        mediaId = mediaResponse.data.id;
        setUploadedMediaId(mediaId);
      }
      if (mediaId != null) mediaIds.push(mediaId);

      await apiClient.post('/posts', {
        content,
        clubId: clubId || null,
        isPublic: true,
        mediaIds
      });

      setContent('');
      resetFile();
      setSubmitError(null);
      onPostCreated();
      toast.success('Post published');
      if (compact) setIsExpanded(false);
    } catch (error) {
      console.error('Failed to create post', error);
      const message = uploading ? socialImageUploadError(error) : 'Failed to publish this post. Your draft is still here—please try again.';
      setSubmitError(message);
      toast.error(message);
    } finally {
      submissionPending.current = false;
      setIsSubmitting(false);
    }
  };

  const openAttachmentPicker = () => {
    if (submissionPending.current) return;
    expandComposer();
    imageInputRef.current?.click();
  };

  const openEventCreator = () => {
    if (submissionPending.current) return;
    expandComposer();
    if (onCreateEvent) onCreateEvent();
    else navigate('/calendar?newEvent=1');
  };

  const collapsed = compact && !isExpanded;
  const compactActionClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--feed-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--feed-accent)]';

  return (
    <section ref={containerRef} aria-busy={isSubmitting} className={`rounded-2xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] shadow-[var(--feed-shadow-panel)] transition-shadow focus-within:shadow-[var(--feed-shadow-float)] ${collapsed ? 'p-3' : 'p-4'}`}>
      <fieldset disabled={isSubmitting} className="min-w-0">
      <input type="file" ref={imageInputRef} onChange={handleFileSelect} className="hidden" aria-label="Choose photo" accept={SOCIAL_IMAGE_ACCEPT} />

      <div className={`flex gap-2.5 ${collapsed ? 'items-center' : 'items-start'}`}>
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--feed-layer-bg)] text-sm font-bold text-[var(--feed-text-secondary)] ring-1 ring-[var(--feed-card-border)] ${collapsed ? 'h-10 w-10' : 'h-11 w-11'}`}>
          {resolvedAvatarUrl ? <MediaImage src={resolvedAvatarUrl} alt="" className="h-full w-full object-cover" /> : authorName.substring(0, 2).toUpperCase()}
        </div>
        <textarea
          value={content}
          onChange={(event) => {
            if (submissionPending.current) return;
            setContent(event.target.value);
            setSubmitError(null);
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
            <button type="button" onClick={openAttachmentPicker} className={compactActionClass} aria-label="Add photo" title="Photo">
              <Camera className="h-5 w-5 text-[var(--social-primary)]" />
            </button>
            <button type="button" onClick={openEventCreator} className={compactActionClass} aria-label="Create event" title="Event">
              <CalendarPlus className="h-5 w-5 text-[var(--social-schedule)]" />
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
          <MediaImage src={previewUrl} alt="Upload preview" className="max-h-72 w-full object-contain" />
          <button type="button" onClick={clearFile} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90" aria-label="Remove attachment">&times;</button>
        </div>
      )}

      {isExpanded && (
        <div className="mt-3 grid grid-cols-2 border-t border-[var(--feed-divider)] pt-3">
          <button type="button" onClick={openAttachmentPicker} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--feed-text-secondary)] transition-colors hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-primary)]">
            <Camera className="h-4 w-4 text-[var(--social-primary)]" /> Photo
          </button>
          <button type="button" onClick={openEventCreator} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--feed-text-secondary)] transition-colors hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-primary)]">
            <CalendarPlus className="h-4 w-4 text-[var(--social-schedule)]" /> Event
          </button>
        </div>
      )}

      </fieldset>
      {isExpanded && <p className="mt-2 text-xs text-[var(--feed-text-secondary)]">JPEG, PNG, GIF or WebP · Max 10 MB. Videos are not supported.</p>}
      {fileError && <p role="alert" className="mt-2 text-sm text-rose-400">{fileError}</p>}
      {isSubmitting && <p role="status" className="mt-3 text-xs text-[var(--feed-text-secondary)]">Publishing your post… Editing will be available when it finishes.</p>}

      {submitError && <div role="alert" className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">{submitError}</div>}
    </section>
  );
};
