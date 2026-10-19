import { ImageCropperModal } from '../../../ui/ImageCropperModal';
import { Save } from "lucide-react";
import { VenueSteps, PitchPreview } from '../VenueFlow';
import { usePitchEditor, type PitchEditorProps } from './usePitchEditor';
import { PitchCollection } from './PitchCollection';
import { PitchDetailsStep } from './PitchDetailsStep';
import { PitchAvailabilityStep } from './PitchAvailabilityStep';
import '../venue-owner.css';
import '../venues.css';
import './venue-editors.css';

/** The pitch editor: the list of pitches, then three steps beside a preview of the selected pitch. Step 3 is the save summary. */
export function VenuePitchEditor(props: PitchEditorProps) {
  const editor = usePitchEditor(props);
  const { venue, step, form, go, pitch, busy, error, message, dirtyPitch, lastSavedPitch, imageEditor, uploading, editingPhoto, save } = editor;
  return (
    <div className="venue-flow">
      <PitchCollection editor={editor}/>
      <form ref={form} onSubmit={save} noValidate aria-label="Pitch editor">
        <VenueSteps labels={['Pitch details', 'Price & availability', 'Review & save']} step={step} onChange={go} disabled={busy || editingPhoto}/>
        <div className="venue-flow-grid"><fieldset disabled={busy || uploading} className="venue-panel venue-form">
        <PitchDetailsStep editor={editor}/>
        <PitchAvailabilityStep editor={editor}/>
        <div hidden={step !== 2} data-flow-step="2"><h2>{lastSavedPitch && !dirtyPitch ? 'Your pitch is saved' : 'Ready to save this pitch?'}</h2><p>{lastSavedPitch && !dirtyPitch ? 'Continue editing this pitch or add another rentable space.' : 'Check the photo, name, format, rate and availability in the preview.'}</p><p className="venue-muted">Shared sections determine which other pitch options become unavailable when this pitch is booked. Existing reservations are kept.</p>{lastSavedPitch?.active && !venue.promotionBlocked && <a className="venue-button" href={`/stadiums/${venue.id}#pitch-${lastSavedPitch.id}`}>{venue.published ? 'View saved pitch' : 'Preview saved pitch'}</a>}</div>
        </fieldset><PitchPreview pitch={pitch} currency={venue.currency} saved={!dirtyPitch && !!pitch.id} published={venue.published} sharedWith={venue.pitches.filter(p => p.id !== pitch.id && p.resourceGroup === pitch.resourceGroup && p.resourceUnits.some(u => pitch.resourceUnits.includes(u))).map(p => p.name)}/></div>
        {imageEditor.error && !imageEditor.source && <p className="venue-error" role="alert">{imageEditor.error}</p>}
        {imageEditor.source && <ImageCropperModal isOpen imageUrl={imageEditor.source.imageUrl} title="Adjust pitch photo" aspectRatio={16 / 9} onClose={imageEditor.close} onCropComplete={imageEditor.save} isProcessing={uploading} error={imageEditor.error}/>}
        {error && (
          <p role="alert" className="venue-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="venue-success">
            {message}
          </p>
        )}
        <footer className="venue-flow-actions"><p>{dirtyPitch ? 'Unsaved changes. Save pitch to keep your photo and details.' : venue.published ? 'Saved active pitches appear on your stadium page.' : 'Save pitches here, then publish your stadium page when it is ready.'}</p><div>
        {step > 0 && <button className="venue-button" type="button" disabled={busy || editingPhoto} onClick={() => go(step-1)}>Back</button>}
        <button className="venue-button venue-button--primary" disabled={busy || editingPhoto}>
          <Save size={16} />
          {busy ? "Saving…" : "Save pitch"}
        </button>
        {step < 2 && <button className="venue-button venue-button--primary" type="button" disabled={busy || editingPhoto} onClick={() => go(step+1)}>Continue</button>}
        </div></footer>
      </form>
    </div>
  );
}
