import { ImagePlus } from "lucide-react";
import { MediaImage } from "../../../components/ui/MediaImage";
import { resolveMediaUrl } from "../../../utils/resolveMediaUrl";
import { CROP_IMAGE_ACCEPT } from '../../../utils/cropImageHelper';
import { formats, surfaces, type Pitch } from "../api";
import type { PitchEditor } from './usePitchEditor';

/** Step 1, "Pitch details": photo, name, format and surface. */
export function PitchDetailsStep({ editor }: { editor: PitchEditor }) {
  const { step, pitch, setPitch, busy, uploading, editingPhoto, imageEditor } = editor;
  return (
    <div hidden={step !== 0} data-flow-step="0" className="venue-form">
    <h2>{pitch.id ? "Edit pitch" : "New pitch"}</h2>
    <section className="venue-pitch-photo-editor" aria-label="Pitch photo">
      <h3>Pitch photo</h3>
      <p className="venue-muted">Show the actual pitch players will book. JPG, PNG or WebP, up to 10 MB.</p>
      {pitch.photoUrl && <div className="venue-preview-cover"><MediaImage src={resolveMediaUrl(pitch.photoUrl)} alt="Pitch photo draft"/></div>}
      <div className="venue-inline">
        <label className="venue-button"><ImagePlus size={17}/>{uploading ? 'Uploading…' : pitch.photoUrl ? 'Change pitch photo' : 'Add pitch photo'}
          <input className="sr-only" type="file" accept={CROP_IMAGE_ACCEPT} disabled={busy || editingPhoto} onChange={event => { void imageEditor.select(event.target.files?.[0], 'banner'); event.target.value = ''; }}/>
        </label>
        {pitch.photoUrl && <button type="button" className="venue-button" disabled={busy || editingPhoto} onClick={() => setPitch(current => ({ ...current, photoUrl: '' }))}>Remove pitch photo</button>}
      </div>
    </section>
    <label className="venue-field">
      <span>Pitch name</span>
      <input
        required
        maxLength={100}
        value={pitch.name}
        placeholder="Main pitch · Full size"
        onChange={(event) =>
          setPitch({ ...pitch, name: event.target.value })
        }
      />
    </label>
    <div className="venue-form-grid">
      <label className="venue-field">
        <span>Format</span>
        <select
          value={pitch.format}
          onChange={(event) =>
            setPitch({
              ...pitch,
              format: event.target.value as Pitch["format"],
            })
          }
        >
          {Object.entries(formats).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="venue-field">
        <span>Surface</span>
        <select
          value={pitch.surface}
          onChange={(event) =>
            setPitch({
              ...pitch,
              surface: event.target.value as Pitch["surface"],
            })
          }
        >
          {Object.entries(surfaces).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
    </div>
  );
}
