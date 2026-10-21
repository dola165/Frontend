import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Trash2, ArrowLeft } from 'lucide-react';
import { apiClient } from '../../../api/axiosConfig';
import { MediaImage } from '../../ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { SOCIAL_IMAGE_ACCEPT, validateSocialImage, socialImageUploadError } from '../../../utils/socialImageUpload';
import './editor-fields.css';

/** Uploads stay private until the owning form saves them. Removal only changes the draft. */
export function ImageUploadField({ label, images, onChange, onBusyChange, max = 12, context = 'general', disabled = false }: {
  label: string; images: string[]; onChange: (images: string[]) => void; onBusyChange: (busy: boolean) => void;
  max?: number; context?: 'general' | 'logo' | 'banner'; disabled?: boolean;
}) {
  const id = useId(), active = useRef(true), uploading = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function upload(files: File[]) {
    if (uploading.current || disabled || !files.length) return;
    setError('');
    if (files.length + (max === 1 ? 0 : images.length) > max) { setError(`Choose up to ${max} ${max === 1 ? 'image' : 'images'} in total.`); return; }
    for (const file of files) { const issue = validateSocialImage(file); if (issue) { setError(`${file.name}: ${issue}`); return; } }
    uploading.current = true; setBusy(true); onBusyChange(true);
    const next = max === 1 ? [] : [...images];
    try {
      for (const file of files) {
        const body = new FormData(); body.append('file', file);
        const response = await apiClient.post<{ url: string }>('/media/upload', body, { params: { context }, headers: { 'Content-Type': undefined } });
        if (!active.current) return;
        next.push(response.data.url); onChange([...next]);
      }
    } catch (e) { if (active.current) setError(socialImageUploadError(e)); }
    finally { uploading.current = false; if (active.current) { setBusy(false); onBusyChange(false); } }
  }
  return <section className="editor-images" aria-label={label} aria-busy={busy}>
    <div className="editor-field-heading"><h5>{label}</h5><span>{images.length} / {max}</span></div>
    <p id={`${id}-hint`}>JPEG, PNG, WebP or GIF · up to 10 MB each. {max > 1 ? 'The first photo is the cover.' : context === 'logo' ? 'Choose a clear logo.' : 'Choose a clear cover photo.'} Save the form to keep your changes.</p>
    {images.length > 0 && <div className="editor-images-grid">{images.map((url, index) => <figure key={`${url}-${index}`}><MediaImage src={resolveMediaUrl(url)} alt={`${label} ${index + 1}`}/><figcaption><span>{max === 1 ? (context === 'logo' ? 'Logo' : 'Cover photo') : index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</span><div>{index > 0 && <button type="button" disabled={disabled || busy} aria-label={`Make photo ${index + 1} the cover`} onClick={() => onChange([url, ...images.filter((_, i) => i !== index)])}><ArrowLeft size={16}/></button>}<button type="button" disabled={disabled || busy} aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} onClick={() => onChange(images.filter((_, i) => i !== index))}><Trash2 size={16}/></button></div></figcaption></figure>)}</div>}
    <label className="editor-upload-button" aria-disabled={disabled || busy} htmlFor={id}><ImagePlus size={18}/>{busy ? 'Uploading…' : max === 1 && images.length ? 'Change image' : 'Upload image' + (max > 1 ? 's' : '')}<input id={id} className="sr-only" aria-label={label} aria-describedby={`${id}-hint`} disabled={disabled || busy || max > 1 && images.length >= max} type="file" multiple={max > 1} accept={SOCIAL_IMAGE_ACCEPT} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void upload(files); }}/></label>
    {error && <p role="alert">{error}</p>}
  </section>;
}
