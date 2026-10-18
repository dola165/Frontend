import { lazy, Suspense, useRef, type ChangeEvent, type CSSProperties } from 'react';
import { Camera } from 'lucide-react';
import { Button, Skeleton } from '../../../../design/primitives';
import { useIdentityImageEditor } from '../../../../hooks/useIdentityImageEditor';
import { CROP_IMAGE_ACCEPT } from '../../../../utils/cropImageHelper';
import { usePagesCopy } from '../../copy';
import { COVER_PHOTO_KEYS, COVER_PHOTOS, type CoverPhoto } from '../../model/photos';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const ImageCropperModal = lazy(() => import('../../../../ui/ImageCropperModal').then(module => ({ default: module.ImageCropperModal })));
const WORDS: Record<CoverPhoto, string> = { 'ball-field': 'Ball on grass', touchline: 'Touchline', 'pitch-aerial': 'From above', 'pitch-day': 'Daylight pitch', 'pitch-sun': 'Evening sun', 'pitch-indoor': 'Indoor hall' };

/** The cover: one of the app's football photos with a tap, or a photo of your own, cropped. */
export function CoverPanel() {
  const t = usePagesCopy();
  const { page, saveIdentity, closePanel } = usePageEdit();
  const input = useRef<HTMLInputElement>(null);
  const editor = useIdentityImageEditor(async (_kind, url) => { if (!await saveIdentity({ cover: { kind: 'image', url } }, { label: t('Cover saved') })) throw new Error(t('Not saved. Check your connection and try again.')); closePanel(); }, `cover:${page?.ref.type}:${page?.ref.id}`);
  if (!page) return null;
  const chosen = page.identity.cover?.kind === 'photo' ? page.identity.cover.photo : null;
  const choose = async (photo: CoverPhoto) => { if (await saveIdentity({ cover: { kind: 'photo', photo } }, { label: t('Cover saved') })) closePanel(); };
  const pick = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; void editor.select(file, 'banner'); };
  return (
    <SplitPanel title={t('Your cover')} onClose={closePanel}
      footer={<>
        <input ref={input} type="file" hidden accept={CROP_IMAGE_ACCEPT} onChange={pick} />
        <Button variant="ghost" disabled={Boolean(editor.uploading)} onClick={() => input.current?.click()}><Camera aria-hidden="true" />{t('Upload a photo')}</Button>
        {page.identity.cover && <Button variant="ghost" onClick={() => void saveIdentity({ cover: null }, { label: t('Cover removed') }).then(ok => { if (ok) closePanel(); })}>{t('No cover')}</Button>}
      </>}>
      <div className="gk-covers" role="group" aria-label={t('Football photos')}>
        {COVER_PHOTO_KEYS.map(photo => <button key={photo} type="button" className="gk-cover" style={{ '--cover': `url(${COVER_PHOTOS[photo]})` } as CSSProperties} aria-pressed={chosen === photo} aria-label={t(WORDS[photo])} title={t(WORDS[photo])} onClick={() => void choose(photo)} />)}
      </div>
      {editor.error && !editor.source && <p className="gk-notice gk-notice--warning" role="alert">{editor.error}</p>}
      {editor.source && <Suspense fallback={<Skeleton height={200} />}><ImageCropperModal isOpen imageUrl={editor.source.imageUrl} title={t('Adjust your cover')} aspectRatio={3} onClose={editor.close} onCropComplete={editor.save} isProcessing={Boolean(editor.uploading)} error={editor.error} /></Suspense>}
    </SplitPanel>
  );
}
