import { lazy, Suspense, useId, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button, Skeleton } from '../../../../design/primitives';
import { useIdentityImageEditor } from '../../../../hooks/useIdentityImageEditor';
import { CROP_IMAGE_ACCEPT } from '../../../../utils/cropImageHelper';
import { usePagesCopy } from '../../copy';
import { cleanInitials, CREST_COLOURS, CREST_SHAPES, crestDataUrl, defaultCrest, paint, type CrestColour, type CrestDesign, type CrestShape } from '../../model/crest';
import { useGuideTask } from '../../guide/bridge';
import { usePageEdit } from '../context';
import { SplitPanel } from '../SplitPanel';

const ImageCropperModal = lazy(() => import('../../../../ui/ImageCropperModal').then(module => ({ default: module.ImageCropperModal })));
const COLOUR_WORDS: Record<CrestColour, string> = { red: 'Red', maroon: 'Maroon', orange: 'Orange', gold: 'Gold', yellow: 'Yellow', green: 'Green', forest: 'Forest green', sky: 'Sky blue', blue: 'Blue', navy: 'Navy', purple: 'Purple', black: 'Black', white: 'White' };
const SHAPE_WORDS: Record<CrestShape, string> = { shield: 'Shield', round: 'Round', square: 'Square', hexagon: 'Hexagon' };

/**
 * The crest designer: two colours and a shape on the left, the page's header with the crest on the right, live.
 * The generated crest is kept with one tap, so the page looks real at once; a photo can be uploaded and cropped instead.
 */
export function CrestPanel() {
  const t = usePagesCopy();
  const { page, saveIdentity, closePanel } = usePageEdit();
  const current = page?.identity.crest;
  const [design, setDesign] = useState<CrestDesign>(() => (current?.kind === 'generated' ? current.design : defaultCrest(page?.identity.name ?? '')));
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const editor = useIdentityImageEditor(async (_kind, url) => { if (!await saveIdentity({ crest: { kind: 'image', url } }, { label: t('Crest saved') })) throw new Error(t('Not saved. Check your connection and try again.')); closePanel(); }, `crest:${page?.ref.type}:${page?.ref.id}`);
  const keep = async () => { if (busy) return false; setBusy(true); try { const ok = await saveIdentity({ crest: { kind: 'generated', design, kept: true } }, { label: t('Crest saved') }); if (ok) closePanel(); return ok; } finally { setBusy(false); } };
  useGuideTask('crest', { disabled: !page || busy || Boolean(editor.uploading), nextLabel: t('Keep this crest'), next: async () => ({ status: await keep() ? 'complete' : 'stay' }) });
  if (!page) return null;
  const pick = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; void editor.select(file, 'logo'); };
  const swatches = (field: 'primary' | 'secondary', label: string) => (
    <div>
      <p className="gk-field__label" id={`${id}-${field}`}>{label}</p>
      <div className="gk-swatches" role="group" aria-labelledby={`${id}-${field}`}>
        {CREST_COLOURS.map(colour => <button key={colour} type="button" className="gk-swatch" style={{ '--swatch': paint(colour) } as CSSProperties} aria-pressed={design[field] === colour} aria-label={t(COLOUR_WORDS[colour])} title={t(COLOUR_WORDS[colour])} onClick={() => setDesign({ ...design, [field]: colour })} />)}
      </div>
    </div>
  );
  return (
    <SplitPanel title={t('Your crest')} onClose={closePanel}
      footer={<>
        <input ref={input} type="file" hidden accept={CROP_IMAGE_ACCEPT} onChange={pick} />
        <Button variant="ghost" disabled={busy || Boolean(editor.uploading)} onClick={() => input.current?.click()}><Camera aria-hidden="true" />{t('Upload a photo instead')}</Button>
        <Button variant="primary" disabled={busy || Boolean(editor.uploading)} onClick={() => void keep()}>{busy ? <Loader2 className="gk-spin" aria-hidden="true" /> : null}{t('Keep this crest')}</Button>
      </>}
      preview={<div className="gk-crest-preview" aria-live="polite">
        <img src={crestDataUrl(design)} alt={t('Crest preview')} width={112} height={112} />
        <span className="gk-crest-preview__name">{page.identity.name}</span>
        <span className="gk-muted">{page.identity.town.name}</span>
      </div>}>
      <div className="gk-boxedit">
        {swatches('primary', t('Main colour'))}
        {swatches('secondary', t('Second colour'))}
        <div>
          <p className="gk-field__label" id={`${id}-shape`}>{t('Shape')}</p>
          <div className="gk-shapes" role="group" aria-labelledby={`${id}-shape`}>
            {CREST_SHAPES.map(shape => <button key={shape} type="button" className="gk-shape" aria-pressed={design.shape === shape} aria-label={t(SHAPE_WORDS[shape])} title={t(SHAPE_WORDS[shape])} onClick={() => setDesign({ ...design, shape })}><img src={crestDataUrl({ ...design, shape })} alt="" /></button>)}
          </div>
        </div>
        <div>
          <label className="gk-field__label" htmlFor={`${id}-initials`}>{t('Letters')}</label>
          <input id={`${id}-initials`} className="gk-input" value={design.initials} maxLength={3} style={{ maxWidth: 96 }} onChange={event => setDesign({ ...design, initials: cleanInitials(event.target.value) || design.initials })} />
        </div>
        {editor.error && !editor.source && <p className="gk-notice gk-notice--warning" role="alert">{editor.error}</p>}
      </div>
      {editor.source && <Suspense fallback={<Skeleton height={200} />}><ImageCropperModal isOpen imageUrl={editor.source.imageUrl} title={t('Adjust your crest')} aspectRatio={1} onClose={editor.close} onCropComplete={editor.save} isProcessing={Boolean(editor.uploading)} error={editor.error} /></Suspense>}
    </SplitPanel>
  );
}
