import { MediaImage } from '../ui/MediaImage';
import { useAndroidUnsavedChanges } from '../../android/useAndroidUnsavedChanges';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarPlus, Camera, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';
import { SOCIAL_IMAGE_ACCEPT, socialImageUploadError, validateSocialImage } from '../../utils/socialImageUpload';
import { getAuthSessionId, isCurrentAuthSession, subscribeAuthSession, type AuthSessionId } from '../../utils/authStorage';

const MAX_PHOTOS = 10;
const MAX_CAPTION = 2000;
type DraftPhoto = { key: number; file: File; previewUrl: string; mediaId: number | null };

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

export const PostComposer = (props: PostComposerProps) => {
  const sessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
  return <PostComposerEditor key={`${sessionId ?? 'guest'}:${props.clubId ?? 'personal'}`} {...props} sessionId={sessionId} />;
};

const PostComposerEditor = ({
  clubId,
  authorName = 'You',
  avatarUrl,
  onPostCreated,
  compact = false,
  onExpand,
  onCreateEvent,
  sessionId,
}: PostComposerProps & { sessionId: AuthSessionId }) => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const photosRef = useRef<DraftPhoto[]>([]);
  const photoSequence = useRef(0);
  const mounted = useRef(true);
  const requestController = useRef<AbortController | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [publishedPostId, setPublishedPostId] = useState<number | null>(null);
  const submissionPending = useRef(false);
  useAndroidUnsavedChanges(Boolean(content.trim() || photos.length || isSubmitting));
  const imageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const resolvedAvatarUrl = resolveMediaUrl(avatarUrl);
  const current = () => mounted.current && isCurrentAuthSession(sessionId);
  const updatePhotos = (next: DraftPhoto[]) => { photosRef.current = next; setPhotos(next); };

  const expandComposer = () => {
    if (!compact || isExpanded) return;
    setIsExpanded(true);
    onExpand?.();
  };

  const resetFile = () => {
    setFileError(null);
    photosRef.current.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    updatePhotos([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removePhoto = (key: number) => {
    if (!current() || submissionPending.current) return;
    const removed = photosRef.current.find(photo => photo.key === key);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    updatePhotos(photosRef.current.filter(photo => photo.key !== key));
    setFileError(null); setSubmitError(null);
  };
  const movePhoto = (key: number, direction: -1 | 1) => {
    if (!current() || submissionPending.current) return;
    const next = [...photosRef.current];
    const index = next.findIndex(photo => photo.key === key);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    updatePhotos(next); setSubmitError(null);
  };

  useEffect(() => {
    if (!compact || !isExpanded) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!submissionPending.current && containerRef.current && !containerRef.current.contains(event.target as Node) && !content.trim() && !photos.length) {
        setIsExpanded(false);
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [compact, isExpanded, content, photos.length]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestController.current?.abort();
      photosRef.current.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
      photosRef.current = [];
    };
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!current() || submissionPending.current) return;
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!selected.length) return;
    const invalid = selected.find(file => validateSocialImage(file));
    const validationError = photosRef.current.length + selected.length > MAX_PHOTOS
      ? 'A post can include up to 10 photos. Remove a photo before adding more.'
      : invalid ? `${invalid.name}: ${validateSocialImage(invalid)}` : null;
    if (validationError) {
      setFileError(validationError);
      toast.error(validationError);
      return;
    }
    setFileError(null);

    expandComposer();
    updatePhotos([...photosRef.current, ...selected.map(file => ({ key: ++photoSequence.current, file, previewUrl: URL.createObjectURL(file), mediaId: null }))]);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    // The ref closes the same-tick gap before React disables the controls.
    if (!current() || submissionPending.current) return;
    if (!content.trim() || content.length > MAX_CAPTION) {
      setSubmitError(!content.trim() ? 'Add a caption before publishing your photos.' : 'Keep your post to 2,000 characters or fewer.');
      return;
    }
    submissionPending.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    const controller = new AbortController();
    requestController.current = controller;
    const config: AuthSessionRequestConfig = { _authSessionId: sessionId, signal: controller.signal };
    const submittedPhotos = [...photosRef.current];

    let uploading = false;
    try {
      const mediaIds: number[] = [];
      for (let index = 0; index < submittedPhotos.length; index++) {
        const photo = submittedPhotos[index];
        let mediaId = photo.mediaId;
        if (!current()) return;
        if (mediaId == null) {
          const formData = new FormData();
          formData.append('file', photo.file, photo.file.name);
          uploading = true; setUploadProgress(index + 1);
          const mediaResponse = await apiClient.post<{ id: number }>('/media/upload', formData, {
            ...config, headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (!current()) return;
          if (!Number.isSafeInteger(mediaResponse.data.id) || mediaResponse.data.id <= 0) throw new Error('Upload was not confirmed.');
          mediaId = mediaResponse.data.id;
          updatePhotos(photosRef.current.map(item => item.key === photo.key ? { ...item, mediaId } : item));
          uploading = false;
        }
        mediaIds.push(mediaId);
      }
      if (!current()) return;
      setUploadProgress(null);
      const published = await apiClient.post<{ postId?: number }>('/posts', {
        content: content.trim(),
        clubId: clubId || null,
        isPublic: true,
        mediaIds
      }, config);
      if (!current()) return;
      const postId = published.data?.postId;
      setPublishedPostId(typeof postId === 'number' && Number.isSafeInteger(postId) && postId > 0 ? postId : null);
      setContent('');
      resetFile();
      setSubmitError(null);
      onPostCreated();
      toast.success('Post published');
      if (compact) setIsExpanded(false);
    } catch (error) {
      if (!current() || controller.signal.aborted) return;
      console.error('Failed to create post', error);
      const message = uploading ? socialImageUploadError(error) : 'Failed to publish this post. Your draft is still here—please try again.';
      setSubmitError(message);
      toast.error(message);
    } finally {
      if (current()) {
        requestController.current = null;
        submissionPending.current = false;
        setIsSubmitting(false);
        setUploadProgress(null);
      }
    }
  };

  const openAttachmentPicker = () => {
    if (!current() || submissionPending.current || photosRef.current.length >= MAX_PHOTOS) return;
    expandComposer();
    imageInputRef.current?.click();
  };

  const openEventCreator = () => {
    if (!current() || submissionPending.current) return;
    expandComposer();
    if (onCreateEvent) onCreateEvent();
    else navigate('/calendar?newEvent=1');
  };

  const collapsed = compact && !isExpanded;
  const compactActionClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--feed-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--feed-accent)]';

  return (
    <section ref={containerRef} aria-busy={isSubmitting} className={`rounded-2xl border border-[var(--feed-card-border)] bg-[var(--feed-card)] shadow-[var(--feed-shadow-panel)] transition-shadow focus-within:shadow-[var(--feed-shadow-float)] ${collapsed ? 'p-3' : 'p-4'}`}>
      <fieldset disabled={isSubmitting} className="min-w-0">
      <input type="file" multiple ref={imageInputRef} onChange={handleFileSelect} className="hidden" aria-label="Choose photo" accept={SOCIAL_IMAGE_ACCEPT} />

      <div className={`flex gap-2.5 ${collapsed ? 'items-center' : 'items-start'}`}>
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--feed-layer-bg)] text-sm font-bold text-[var(--feed-text-secondary)] ring-1 ring-[var(--feed-card-border)] ${collapsed ? 'h-10 w-10' : 'h-11 w-11'}`}>
          {resolvedAvatarUrl ? <MediaImage src={resolvedAvatarUrl} alt="" className="h-full w-full object-cover" /> : authorName.substring(0, 2).toUpperCase()}
        </div>
        <textarea
          value={content}
          onChange={(event) => {
            if (!current() || submissionPending.current) return;
            setContent(event.target.value);
            setSubmitError(null);
          }}
          onFocus={expandComposer}
          onClick={expandComposer}
          placeholder={collapsed ? 'Share an update…' : clubId ? 'Share an update from your club…' : `What do you want to share, ${authorName.split(' ')[0]}?`}
          aria-label={clubId ? 'Create a club post' : 'Create a post'}
          className={`min-w-0 flex-1 resize-none border border-[var(--feed-card-border)] bg-[var(--feed-input-bg)] px-4 text-sm leading-6 text-[var(--feed-text-primary)] outline-none placeholder:text-[var(--feed-text-placeholder)] transition-colors focus:border-[var(--feed-accent)] ${isExpanded ? 'min-h-[104px] rounded-2xl py-3' : 'h-10 min-h-10 overflow-hidden whitespace-nowrap rounded-full py-1.5'}`}
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
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || !content.trim() || content.length > MAX_CAPTION} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--feed-accent)] text-[var(--feed-accent-contrast)] transition-colors hover:bg-[var(--feed-accent-hover)] disabled:opacity-40" aria-label="Publish post">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        )}
      </div>

      {photos.length > 0 && <div className="mt-3 space-y-2">
        <p className="text-xs text-[var(--feed-text-secondary)]">{photos.length} / 10 photos · Arrange them in the order they should appear.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, index) => <div key={photo.key} className="overflow-hidden rounded-xl border border-[var(--feed-card-border)] bg-[var(--feed-layer-bg)]">
            <MediaImage src={photo.previewUrl} alt={photos.length === 1 ? 'Upload preview' : `Upload preview ${index + 1}: ${photo.file.name}`} className="aspect-square w-full object-contain" />
            <div className="space-y-1 p-2">
              <p className="truncate text-xs text-[var(--feed-text-secondary)]">{index + 1}. {photo.file.name}</p>
              {photo.mediaId != null && <p className="text-xs text-[var(--feed-text-secondary)]">Uploaded · Ready to publish</p>}
              <div className="flex justify-between gap-1">
                <button type="button" onClick={() => movePhoto(photo.key, -1)} disabled={index === 0} aria-label={`Move photo ${index + 1} earlier`} className="rounded p-2 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => movePhoto(photo.key, 1)} disabled={index === photos.length - 1} aria-label={`Move photo ${index + 1} later`} className="rounded p-2 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => removePhoto(photo.key)} className="rounded px-2 py-1 text-xs text-rose-400" aria-label={photos.length === 1 ? 'Remove attachment' : `Remove photo ${index + 1}`}>Remove</button>
              </div>
            </div>
          </div>)}
        </div>
      </div>}

      {isExpanded && (
        <div className="mt-3 grid grid-cols-2 border-t border-[var(--feed-divider)] pt-3">
          <button type="button" onClick={openAttachmentPicker} disabled={photos.length >= MAX_PHOTOS} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--feed-text-secondary)] transition-colors hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-primary)] disabled:opacity-40">
            <Camera className="h-4 w-4 text-[var(--social-primary)]" /> Photo
          </button>
          <button type="button" onClick={openEventCreator} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--feed-text-secondary)] transition-colors hover:bg-[var(--feed-hover-bg)] hover:text-[var(--feed-text-primary)]">
            <CalendarPlus className="h-4 w-4 text-[var(--social-schedule)]" /> Event
          </button>
        </div>
      )}

      </fieldset>
      {publishedPostId != null && !isSubmitting && <p role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--feed-text-secondary)]">
        Post published.
        <Link to={`/posts/${publishedPostId}`} className="font-semibold text-[var(--feed-accent)] underline underline-offset-4">View your post</Link>
      </p>}
      {isExpanded && <p className="mt-2 text-xs text-[var(--feed-text-secondary)]">A caption is required · Up to 10 photos · JPEG, PNG, GIF or WebP · Max 10 MB each. Videos are not supported.</p>}
      {isExpanded && content.length > 1800 && <p className={`mt-2 text-xs ${content.length > MAX_CAPTION ? 'text-rose-400' : 'text-[var(--feed-text-secondary)]'}`}>{content.length} / 2,000 characters</p>}
      {fileError && <p role="alert" className="mt-2 text-sm text-rose-400">{fileError}</p>}
      {isSubmitting && <p role="status" className="mt-3 text-xs text-[var(--feed-text-secondary)]">{uploadProgress ? `Uploading photo ${uploadProgress} of ${photos.length}…` : 'Publishing your post…'} Editing will be available when it finishes.</p>}

      {submitError && <div role="alert" className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">{submitError}</div>}
    </section>
  );
};
