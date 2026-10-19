import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from "lucide-react";
import { MediaImage } from "../../../components/ui/MediaImage";
import { resolveMediaUrl } from "../../../utils/resolveMediaUrl";
import { CROP_IMAGE_ACCEPT } from '../../../utils/cropImageHelper';
import type { ListingEditor } from './useListingEditor';

/** Step 1, "Details & photos": name, description, amenities, logo and stadium photos. */
export function ListingDetailsStep({ editor }: { editor: ListingEditor }) {
  const { step, draft, change, busy, uploading, selectPhoto, movePhoto } = editor;
  return (
    <div hidden={step !== 0} data-flow-step="0" className="venue-flow-main"><section className="venue-panel">
        <div className="venue-section-heading">
          <div>
            <p className="venue-eyebrow">First impressions</p>
            <h2>Your stadium page</h2>
            <p>Give players a clear picture of where they’ll play.</p>
          </div>
        </div>
        <div className="venue-form">
          <label className="venue-field">
            <span>Stadium name</span>
            <input
              required
              maxLength={120}
              value={draft.displayName}
              onChange={(event) => change("displayName", event.target.value)}
            />
          </label>
          <label className="venue-field">
            <span>About the stadium</span>
            <textarea
              aria-label="About the stadium"
              rows={5}
              maxLength={5000}
              value={draft.description}
              onChange={(event) => change("description", event.target.value)}
              placeholder="Describe the pitches and facilities, which entrance to use, where to park and who to contact if weather affects play."
            />
          </label>
          <label className="venue-field">
            <span>
              Amenities <small>(comma separated)</small>
            </span>
            <input
              value={draft.amenities.join(", ")}
              onChange={(event) =>
                change(
                  "amenities",
                  event.target.value
                    .split(",")
                    .map((value) => value.trimStart()),
                )
              }
              placeholder="Floodlights, Changing rooms, Showers, Parking"
            />
          </label>
        </div>
      </section><section className="venue-panel">
        <div className="venue-section-heading">
          <div>
            <p className="venue-eyebrow">Show your best side</p>
            <h2>Stadium photos</h2>
            <p>
              The first photo is your cover. Add up to 12 photos of the pitch
              and facilities.
            </p>
          </div>
          <label className="venue-button">
            <ImagePlus size={17} />
            {uploading ? "Uploading…" : "Add photos"}
            <input
              className="sr-only"
              type="file"
              accept={CROP_IMAGE_ACCEPT}
              disabled={uploading || busy}
              onChange={(event) => {
                selectPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="venue-inline mb-4">
          {draft.logoUrl && <MediaImage src={resolveMediaUrl(draft.logoUrl)} alt="Stadium logo preview" className="h-20 w-20 rounded-xl object-contain"/>}
          <label className="venue-button">{draft.logoUrl ? 'Change stadium logo' : 'Add stadium logo'}
            <input className="sr-only" type="file" accept={CROP_IMAGE_ACCEPT} disabled={busy || uploading} onChange={event => { selectPhoto(event.target.files?.[0], null, 'logo'); event.target.value = ''; }}/>
          </label>
          {draft.logoUrl && <button type="button" className="venue-button" onClick={() => change('logoUrl', '')}>Remove logo</button>}
        </div>
        {!draft.photos.length && (
          <div className="venue-empty">
            <ImagePlus size={30} />
            <p>Real photos help teams choose your stadium.</p>
            <small>JPG, PNG or WebP, up to 10 MB each.</small>
          </div>
        )}
        <div className="venue-photo-editor">
          {draft.photos.map((photo, index) => (
            <div key={`${photo.url}-${index}`}>
              <MediaImage
                src={resolveMediaUrl(photo.url)}
                alt={photo.caption || `Photo ${index + 1}`}
              />
              <label className="venue-field">
                <span>
                  {index === 0 ? "Cover photo" : `Photo ${index + 1}`}{" "}
                  description
                </span>
                <input
                  maxLength={200}
                  value={photo.caption}
                  placeholder="Pitch under the floodlights"
                  onChange={(event) =>
                    change(
                      "photos",
                      draft.photos.map((item, position) =>
                        position === index
                          ? { ...item, caption: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <div className="venue-inline">
                <label className="venue-button">{index === 0 ? 'Change cover photo' : 'Replace photo'}
                  <input className="sr-only" type="file" accept={CROP_IMAGE_ACCEPT} disabled={busy || uploading} onChange={event => { selectPhoto(event.target.files?.[0], index); event.target.value = ''; }}/>
                </label>
                <button
                  className="venue-button venue-icon-button"
                  type="button"
                  disabled={index === 0}
                  aria-label={`Move photo ${index + 1} earlier`}
                  onClick={() => movePhoto(index, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  className="venue-button venue-icon-button"
                  type="button"
                  disabled={index === draft.photos.length - 1}
                  aria-label={`Move photo ${index + 1} later`}
                  onClick={() => movePhoto(index, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  className="venue-button"
                  type="button"
                  onClick={() =>
                    change(
                      "photos",
                      draft.photos.filter(
                        (_, position) => position !== index,
                      ),
                    )
                  }
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section></div>
  );
}
