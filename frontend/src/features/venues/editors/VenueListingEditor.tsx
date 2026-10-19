import { ImageCropperModal } from '../../../ui/ImageCropperModal';
import { Save } from "lucide-react";
import { VenueSteps, VenueListingPreview } from '../VenueFlow';
import { useListingEditor, type ListingEditorProps } from './useListingEditor';
import { ListingDetailsStep } from './ListingDetailsStep';
import { ListingLocationStep } from './ListingLocationStep';
import { ListingHoursStep } from './ListingHoursStep';
import { ListingReviewStep } from './ListingReviewStep';
// The steps' styles load here, after the steps' own imports, in the order the venue workspace has always used:
// venue-owner.css (pitch cards) before the shared venue styles, then the editors' own.
import '../venue-owner.css';
import '../venues.css';
import './venue-editors.css';

/** The stadium page editor: four steps beside a live preview of the public page. */
export function VenueListingEditor(props: ListingEditorProps) {
  const editor = useListingEditor(props);
  const { venue, step, form, draft, busy, error, message, imageEditor, uploading, dirty, go, save } = editor;
  return <form ref={form} onSubmit={save} noValidate className="venue-flow" aria-label="Stadium page editor">
    <VenueSteps labels={['Details & photos', 'Location & contact', 'Hours & booking rules', 'Review & publish']} step={step} onChange={go} disabled={busy || uploading}/>
    <div className="venue-flow-grid"><fieldset disabled={busy} className="venue-flow-main">
      <ListingDetailsStep editor={editor}/>
      <ListingLocationStep editor={editor}/>
      <ListingHoursStep editor={editor}/>
      <ListingReviewStep editor={editor}/>
    </fieldset><VenueListingPreview draft={draft} venue={venue}/></div>
    {error && <p className="venue-error" role="alert">{error}</p>}
    {imageEditor.error && !imageEditor.source && <p className="venue-error" role="alert">{imageEditor.error}</p>}
    {imageEditor.source && <ImageCropperModal isOpen imageUrl={imageEditor.source.imageUrl} title={imageEditor.source.type === 'logo' ? 'Adjust stadium logo' : 'Adjust stadium photo'} aspectRatio={imageEditor.source.type === 'logo' ? 1 : 3} onClose={imageEditor.close} onCropComplete={imageEditor.save} isProcessing={uploading} error={imageEditor.error}/>}
    {message && <p className="venue-success" role="status">{message}</p>}
    <footer className="venue-flow-actions"><p>{dirty ? 'Unsaved changes. The preview updates as you type.' : 'Work through the steps, then save your changes.'}</p><div>
      {step > 0 && <button type="button" className="venue-button" disabled={busy || uploading} onClick={() => go(step - 1)}>Back</button>}
      <button type="submit" className="venue-button" disabled={busy || uploading}><Save size={16}/>{busy ? 'Saving…' : 'Save stadium'}</button>
      {step < 3 && <button type="button" className="venue-button venue-button--primary" disabled={busy || uploading} onClick={() => go(step + 1)}>Continue</button>}
    </div></footer>
  </form>;
}
