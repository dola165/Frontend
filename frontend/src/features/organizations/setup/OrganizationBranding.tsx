import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { MediaImage } from '../../../components/ui/MediaImage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { SOCIAL_IMAGE_ACCEPT, validateSocialImage, socialImageUploadError } from '../../../utils/socialImageUpload';
interface Branding { revision: number; logoUrl: string | null; bannerUrl: string | null }
export function OrganizationBranding({ id, editable = false }: { id: number; editable?: boolean }) {
  const [data, setData] = useState<Branding | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const active = useRef(true), submitting = useRef(false);
  useEffect(() => { active.current = true; const controller = new AbortController(); void apiClient.get<Branding>(`/organizations/${id}/branding`, { signal: controller.signal }).then(r => { if (!controller.signal.aborted) setData(r.data); }).catch(e => { if (!controller.signal.aborted) setError(extractApiErrorMessage(e, 'Could not load profile images.')); }); return () => { controller.abort(); active.current = false; }; }, [id, attempt]);
  async function change(field: 'logoUrl' | 'bannerUrl', file: File | null) {
    if (!data || submitting.current) return;
    if (file) { const issue = validateSocialImage(file); if (issue) { setError(issue); return; } }
    submitting.current = true; setBusy(true); setError(''); let uploading = Boolean(file);
    try {
      let url: string | null = null;
      if (file) { const body = new FormData(); body.append('file', file); const response = await apiClient.post<{ url: string }>('/media/upload', body, { headers: { 'Content-Type': undefined }, params: { context: field === 'bannerUrl' ? 'banner' : 'profile' } }); url = response.data.url; }
      uploading = false;
      if (!active.current) return;
      const response = await apiClient.put<Branding>(`/organizations/${id}/branding`, { ...data, [field]: url });
      if (active.current) setData(response.data);
    } catch (err) { if (active.current) setError(uploading ? socialImageUploadError(err) : extractApiErrorMessage(err, 'Could not save profile images. Reload before trying again.')); }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  }
  if (!editable && !data?.logoUrl && !data?.bannerUrl) return null;
  return <section className={editable ? 'org-setup-card' : 'org-profile-branding'} aria-label="Organization images">
    {editable && <><h2>Profile images</h2><p>Add a logo and cover image. Draft profile images are visible only to eligible organization members.</p></>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>Reload images</button></p>}
    {data?.bannerUrl && <MediaImage src={data.bannerUrl} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 14 }} />}
    {data?.logoUrl && <MediaImage src={data.logoUrl} alt="Organization logo" style={{ width: 88, height: 88, objectFit: 'contain', borderRadius: 14, margin: '16px 0' }} />}
    {editable && data && <fieldset disabled={busy} className="org-setup-fields">{(['logoUrl', 'bannerUrl'] as const).map(field => <div key={field}><label>{field === 'logoUrl' ? 'Logo' : 'Cover image'}<input type="file" accept={SOCIAL_IMAGE_ACCEPT} onChange={e => { const file = e.target.files?.[0]; if (file) void change(field, file); e.target.value = ''; }} /></label>{data[field] && <button type="button" onClick={() => void change(field, null)}>Remove {field === 'logoUrl' ? 'logo' : 'cover image'}</button>}</div>)}</fieldset>}{busy && <p role="status">Saving image…</p>}
  </section>;
}
