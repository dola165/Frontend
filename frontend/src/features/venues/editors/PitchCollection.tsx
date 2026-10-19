import { Plus } from "lucide-react";
import { MediaImage } from "../../../components/ui/MediaImage";
import { resolveMediaUrl } from "../../../utils/resolveMediaUrl";
import { formats, surfaces } from "../api";
import { money } from "../utils";
import { blankPitch, type PitchEditor } from './usePitchEditor';

/** The venue's rentable pitches, each with its rate and an edit button, and the question when unsaved changes would be lost. */
export function PitchCollection({ editor }: { editor: PitchEditor }) {
  const { venue, pitch, busy, editingPhoto, selectPitch, selection, setSelection, openPitch } = editor;
  return (
    <>
      <section className="venue-pitch-collection">
        <div className="venue-section-heading">
          <div>
            <h2>Your rentable pitches</h2>
            <p>
              Separate spaces, one stadium. Set a rate for each pitch or pitch
              section.
            </p>
          </div>
          <button
            className="venue-button"
            disabled={busy || editingPhoto}
            onClick={() => {
              selectPitch(blankPitch);
            }}
          >
            <Plus size={16} />
            New pitch
          </button>
        </div>
        <div className="venue-pitch-list">
          {venue.pitches.map((value) => (
            <article
              key={value.id}
              className={`venue-panel venue-pitch-card ${pitch.id === value.id ? "is-selected" : ""}`}
            >
              {value.photoUrl && <MediaImage className="venue-pitch-card-photo" src={resolveMediaUrl(value.photoUrl)} alt={value.name}/>}
              <div>
                <h3>{value.name}</h3>
                <p>
                  {formats[value.format]} · {surfaces[value.surface]}
                  {value.covered ? " · Covered" : ""}
                </p>
                <span className="venue-tag">
                  {value.active ? venue.published ? "Available to book" : "Stadium draft" : "Inactive"}
                </span>
              </div>
              <strong>{money(value.pricePerHour, venue.currency)} / hr</strong>
              <div className="venue-inline">
                <button type="button" className="venue-button" disabled={busy || editingPhoto} onClick={() => selectPitch(value)}>Edit {value.name}</button>
                {value.active && !venue.promotionBlocked && <a className="venue-link" href={`/stadiums/${venue.id}#pitch-${value.id}`}>{venue.published ? 'View pitch' : 'Preview pitch'}</a>}
              </div>
            </article>
          ))}
          {!venue.pitches.length && (
            <div className="venue-panel venue-empty">
              <h3>Add your first pitch</h3>
              <p>Players will choose a pitch when they reserve a time.</p>
            </div>
          )}
        </div>

      </section>
      {selection && <div className="venue-notice" role="region" aria-label="Unsaved pitch changes"><p>Keep editing this pitch, or discard its unsaved changes before opening another?</p><div className="venue-inline"><button className="venue-button" onClick={() => setSelection(null)}>Keep editing</button><button className="venue-button" onClick={() => { openPitch(selection); setSelection(null); }}>Discard pitch changes</button></div></div>}
    </>
  );
}
