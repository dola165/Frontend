import { MapPin } from "lucide-react";
import { LocationPicker } from '../../../components/workspace/editor/LocationPicker';
import type { ListingEditor } from './useListingEditor';

/** Step 2, "Location & contact": address, public contact, timezone and the visitor entrance on the map. */
export function ListingLocationStep({ editor }: { editor: ListingEditor }) {
  const { step, draft, change, setDraft } = editor;
  return (
    <div hidden={step !== 1} data-flow-step="1"><section className="venue-panel">
        <div className="venue-section-heading">
          <div>
            <p className="venue-eyebrow">Get teams to the right place</p>
            <h2>Location & contact</h2>
          </div>
          <MapPin size={24} />
        </div>
        <div className="venue-form-grid">
          <label className="venue-field">
            <span>City</span>
            <input
              maxLength={100}
              value={draft.city}
              onChange={(event) => change("city", event.target.value)}
            />
          </label>
          <label className="venue-field">
            <span>Street address</span>
            <input
              maxLength={500}
              value={draft.addressText}
              onChange={(event) => change("addressText", event.target.value)}
            />
          </label>
          <label className="venue-field">
            <span>Public phone</span>
            <input
              type="tel"
              maxLength={40}
              value={draft.publicPhone}
              onChange={(event) => change("publicPhone", event.target.value)}
            />
          </label>
          <label className="venue-field">
            <span>Public email</span>
            <input
              type="email"
              maxLength={200}
              value={draft.publicEmail}
              onChange={(event) => change("publicEmail", event.target.value)}
            />
          </label>
          <label className="venue-field">
            <span>Website</span>
            <input
              type="url"
              value={draft.website}
              onChange={(event) => change("website", event.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="venue-field">
            <span>Venue timezone</span><small id="venue-timezone-help" className="editor-field-help">Opening hours and bookings use this timezone, even when visitors are abroad.</small>
            <input
              aria-label="Venue timezone"
              aria-describedby="venue-timezone-help"
              required
              value={draft.timezone}
              onChange={(event) => change("timezone", event.target.value)}
              placeholder="Asia/Tbilisi"
            />
          </label>
        </div>
        <section className="editor-field-group"><header><h5>Visitor entrance</h5><p>Set the entrance teams should use when arriving at the venue.</p></header>
          {step === 1 && <LocationPicker latitude={draft.latitude == null ? '' : String(draft.latitude)} longitude={draft.longitude == null ? '' : String(draft.longitude)} onChange={(latitude,longitude)=>setDraft(current=>({...current,latitude:latitude===''?null:Number(latitude),longitude:longitude===''?null:Number(longitude)}))}/>}
        </section>
      </section></div>
  );
}
