import { ImageCropperModal } from '../../ui/ImageCropperModal';
import { useIdentityImageEditor } from '../../hooks/useIdentityImageEditor';
import { CROP_IMAGE_ACCEPT } from '../../utils/cropImageHelper';
import { listingReadiness, validateVenueForm } from './flowValidation';
import { VenueSteps, VenueListingPreview, PitchPreview } from './VenueFlow';
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  MapPin,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { MediaImage } from "../../components/ui/MediaImage";
import { resolveMediaUrl } from "../../utils/resolveMediaUrl";
import { extractApiErrorMessage } from "../../utils/apiError";
import {
  formats,
  savePitch,
  saveVenue,
  surfaces,
  type Pitch,
  type Venue,
  type VenueDraft,
} from "./api";
import { LocationPicker } from '../../components/workspace/editor/LocationPicker';
import { money } from "./utils";

const asDraft = (venue: Venue): VenueDraft => ({
  revision: venue.revision,
  displayName: venue.displayName || "",
  description: venue.description || "",
  city: venue.city || "",
  addressText: venue.addressText || "",
  latitude: venue.latitude,
  longitude: venue.longitude,
  timezone: venue.timezone,
  currency: venue.currency,
  publicPhone: venue.publicPhone || "",
  publicEmail: venue.publicEmail || "",
  website: venue.website || "",
  bookingMode: venue.bookingMode,
  published: !!venue.published,
  cancellationHours: venue.cancellationHours,
  minBookingMinutes: venue.minBookingMinutes,
  maxBookingMinutes: venue.maxBookingMinutes,
  slotMinutes: venue.slotMinutes,
  amenities: venue.amenities || [],
  photos: venue.photos || [],
  logoUrl: venue.logoUrl || null,
  openingHours: venue.openingHours || [],
});
export function VenueListingEditor({
  venue,
  onSave,
  target,
}: {
  venue: Venue;
  onSave: (venue: Venue) => void;
  target?: { step: number; token: number };
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    // Workspace checklist links select a section without resetting the draft.
    if (target) setStep(target.step);
  }, [target]);
  const form = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState(() => JSON.stringify(asDraft(venue)));
  const [draft, setDraft] = useState(() => asDraft(venue)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const replacementIndex = useRef<number | null>(null);
  const imageEditor = useIdentityImageEditor(async (kind, url) => {
    if (kind === 'logo') setDraft(current => ({ ...current, logoUrl: url }));
    else {
      const index = replacementIndex.current;
      setDraft(current => ({ ...current, photos: index == null ? [...current.photos, { url, caption: '' }] : current.photos.map((photo, i) => i === index ? { ...photo, url } : photo) }));
    }
    setMessage('Photo added to your draft. Save stadium to publish your changes.');
  }, `venue:${venue.id}`);
  const uploading = !!imageEditor.uploading;
  const selectPhoto = (file: File | undefined, index: number | null = null, kind: 'logo' | 'banner' = 'banner') => {
    if (!file || busy || uploading) return;
    if (kind !== 'logo' && index == null && draft.photos.length >= 12) { setError('You can add up to 12 stadium photos.'); return; }
    replacementIndex.current = index;
    void imageEditor.select(file, kind);
  };
  const readiness = listingReadiness(draft, venue);
  const dirty = JSON.stringify(draft) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const go = (next: number) => {
    if (next > step && form.current && !validateVenueForm(form.current, setStep, true)) return;
    setStep(next);
  };
  const submitting = useRef(false);
  const change = <K extends keyof VenueDraft>(key: K, value: VenueDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || uploading || !form.current || !validateVenueForm(form.current, setStep)) return;
    if (draft.published && readiness.some(item => !item.ready)) { setStep(3); setError('Complete the items below before publishing, or turn off publishing to save a draft.'); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await saveVenue(venue.id, {
        ...draft,
        revision: venue.revision,
        amenities: draft.amenities.map((value) => value.trim()).filter(Boolean),
      });
      onSave(result);
      setDraft(asDraft(result));
      setSaved(JSON.stringify(asDraft(result)));
      setMessage(
        result.published
          ? "Your stadium page is live."
          : "Draft saved. Add pitches and complete the listing before publishing.",
      );
    } catch (err) {
      setError(extractApiErrorMessage(err, "Your changes could not be saved."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const movePhoto = (index: number, direction: number) => {
    const photos = [...draft.photos];
    [photos[index], photos[index + direction]] = [
      photos[index + direction],
      photos[index],
    ];
    change("photos", photos);
  };
  return <form ref={form} onSubmit={save} noValidate className="venue-flow" aria-label="Stadium page editor">
    <VenueSteps labels={['Details & photos', 'Location & contact', 'Hours & booking rules', 'Review & publish']} step={step} onChange={go} disabled={busy || uploading}/>
    <div className="venue-flow-grid"><fieldset disabled={busy} className="venue-flow-main">
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
      <div hidden={step !== 2} data-flow-step="2" className="venue-flow-main"><section className="venue-panel">
          <h2>Opening hours</h2>
          <p>
            In {draft.timezone}. Unchecked days are closed. An earlier closing
            time means the pitch stays open past midnight into the next day.
          </p>
          <div className="venue-hours-editor">
            {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => {
              const hours = draft.openingHours.find(
                (value) => value.dayOfWeek === day,
              );
              const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                day - 1
              ];
              return (
                <div key={day}>
                  <label className="venue-checkbox">
                    <input
                      type="checkbox"
                      checked={!!hours}
                      onChange={(event) =>
                        change(
                          "openingHours",
                          event.target.checked
                            ? [
                                ...draft.openingHours,
                                {
                                  dayOfWeek: day,
                                  opensAt: "08:00",
                                  closesAt: "23:00",
                                },
                              ]
                            : draft.openingHours.filter(
                                (value) => value.dayOfWeek !== day,
                              ),
                        )
                      }
                    />
                    {dayName}
                  </label>
                  {hours ? (
                    <>
                      <input
                        aria-label={`${dayName} opening time`}
                        type="time"
                        value={hours.opensAt.slice(0, 5)}
                        onChange={(event) =>
                          change(
                            "openingHours",
                            draft.openingHours.map((value) =>
                              value.dayOfWeek === day
                                ? { ...value, opensAt: event.target.value }
                                : value,
                            ),
                          )
                        }
                      />
                      <span>–</span>
                      <input
                        aria-label={`${dayName} closing time`}
                        type="time"
                        value={hours.closesAt.slice(0, 5)}
                        onChange={(event) =>
                          change(
                            "openingHours",
                            draft.openingHours.map((value) =>
                              value.dayOfWeek === day
                                ? { ...value, closesAt: event.target.value }
                                : value,
                            ),
                          )
                        }
                      />
                    </>
                  ) : (
                    <span className="venue-muted">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </section><section className="venue-panel">
          <h2>Booking rules</h2>
          <div className="venue-form">
            <label className="venue-field">
              <span>Confirmation</span><small className="editor-field-help">Choose whether each booking needs your approval or is confirmed automatically when the pitch is available.</small>
              <select
                aria-label="Confirmation"
                value={draft.bookingMode}
                onChange={(event) =>
                  change(
                    "bookingMode",
                    event.target.value as Venue["bookingMode"],
                  )
                }
              >
                <option value="REQUEST">I confirm each request</option>
                <option value="INSTANT">Instant confirmation</option>
              </select>
            </label>
            <label className="venue-field">
              <span>Currency</span>
              <select
                value={draft.currency}
                onChange={(event) => change("currency", event.target.value)}
              >
                {["GEL", "USD", "EUR", "GBP"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="venue-field">
              <span>Booking interval (minutes)</span><small className="editor-field-help">Spacing between available start times. For example, 30 minutes offers 10:00, 10:30 and 11:00.</small>
              <select
                value={draft.slotMinutes}
                onChange={(event) =>
                  change("slotMinutes", Number(event.target.value))
                }
              >
                {[15, 30, 60].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <div className="venue-form-grid">
              <label className="venue-field">
                <span>Shortest booking (minutes)</span>
                <input
                  type="number"
                  min="30"
                  max="720"
                  step={draft.slotMinutes}
                  required
                  value={draft.minBookingMinutes}
                  onChange={(event) =>
                    change("minBookingMinutes", Number(event.target.value))
                  }
                />
              </label>
              <label className="venue-field">
                <span>Longest booking (minutes)</span>
                <input
                  type="number"
                  min={draft.minBookingMinutes}
                  max="720"
                  step={draft.slotMinutes}
                  required
                  value={draft.maxBookingMinutes}
                  onChange={(event) =>
                    change("maxBookingMinutes", Number(event.target.value))
                  }
                />
              </label>
            </div>
            <label className="venue-field">
              <span>Cancellation notice (hours)</span><small className="editor-field-help">How far before the booking customers must cancel. Use 0 for no advance notice.</small>
              <input
                type="number"
                min="0"
                max="168"
                required
                value={draft.cancellationHours}
                onChange={(event) =>
                  change("cancellationHours", Number(event.target.value))
                }
              />
            </label>
          </div>
        </section></div>
      <div hidden={step !== 3} data-flow-step="3" className="venue-flow-main">
        <section className="venue-panel"><p className="venue-eyebrow">Ready for your first visitors?</p><h2>Review your stadium page</h2><p>Check the preview, then choose whether to publish.</p>
          <div className="venue-readiness">{readiness.map(item => <button key={item.label} type="button" className={item.ready ? 'is-ready' : ''} onClick={() => item.step >= 0 && setStep(item.step)}><span>{item.ready ? '✓' : '○'}</span>{item.label}{item.step === -1 && !item.ready && <small> — save a draft, then open Pitches</small>}</button>)}</div>
          <p className="venue-muted">Before accepting online requests, add your existing phone bookings, regular team slots and closures in Calendar & reservations.</p>
          <p className="venue-muted">{draft.bookingMode === 'INSTANT' ? 'Instant mode confirms available online bookings automatically. Keep your calendar current.' : 'Request mode lets you approve each online booking. Unanswered requests expire automatically.'} Payment is arranged at the venue.</p>
        </section><section className="venue-panel">
          <h2>Publishing</h2>
          <p>
            Publish after adding a photo, an active pitch, opening hours,
            address, map location and phone number.
          </p>
          <label className="venue-checkbox">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(event) => change("published", event.target.checked)}
            />
            Publish stadium page
          </label>
          <p className="venue-muted">
            Save before leaving this workspace. You can switch its tabs without losing your draft.
          </p>
        </section>
      </div>
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

const blankPitch = {
  revision: 0,
  name: "",
  photoUrl: "",
  format: "5_A_SIDE",
  surface: "ARTIFICIAL_GRASS",
  covered: false,
  pricePerHour: 0,
  active: true,
  resourceGroup: "",
  resourceUnits: [],
} satisfies Omit<Pitch, "id">;
export function VenuePitchEditor({
  venue,
  onSave,
}: {
  venue: Venue;
  onSave: (venue: Venue) => void;
}) {
  const [step, setStep] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const go = (next: number) => {
    if (next > step && form.current && !validateVenueForm(form.current, setStep, true)) return;
    setStep(next);
  };
  const [pitch, setPitch] = useState<Omit<Pitch, "id"> & { id?: number }>(
      blankPitch,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [selection, setSelection] = useState<typeof pitch | null>(null);
  const [savedPitch, setSavedPitch] = useState(JSON.stringify(blankPitch));
  const [lastSavedPitch, setLastSavedPitch] = useState<Pitch | null>(null);
  const dirtyPitch = JSON.stringify(pitch) !== savedPitch;
  const imageEditor = useIdentityImageEditor(async (_kind, url) => {
    setPitch(current => ({ ...current, photoUrl: url }));
    setMessage('Photo added to your pitch draft. Save pitch to keep this change.');
  }, `venue:${venue.id}:pitch:${pitch.id ?? 'new'}`);
  const uploading = !!imageEditor.uploading;
  const editingPhoto = uploading || !!imageEditor.source;
  useEffect(() => {
    if (!dirtyPitch) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyPitch]);
  const openPitch = (next: typeof pitch) => {
    imageEditor.close();
    setPitch(next); setSavedPitch(JSON.stringify(next)); setStep(0); setError(''); setMessage(''); setLastSavedPitch(null);
  };
  const selectPitch = (next: typeof pitch) => {
    if (busy || editingPhoto) return;
    if (dirtyPitch) { setSelection(next); return; }
    openPitch(next);
  };
  const submitting = useRef(false);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || editingPhoto || !form.current || !validateVenueForm(form.current, setStep)) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await savePitch(venue.id, {
        ...pitch,
        resourceUnits: pitch.resourceUnits
          .map((value) => value.trim())
          .filter(Boolean),
      });
      onSave(result);
      const createdMatches = result.pitches.filter(value =>
        !venue.pitches.some(previous => previous.id === value.id) && value.name === pitch.name.trim(),
      );
      const saved = pitch.id
        ? result.pitches.find(value => value.id === pitch.id)
        : createdMatches.length === 1 ? createdMatches[0] : undefined;
      setPitch(saved ?? blankPitch);
      setSavedPitch(JSON.stringify(saved ?? blankPitch));
      setLastSavedPitch(saved ?? null);
      setStep(2);
      setMessage(
        `${pitch.name} ${pitch.id ? 'updated' : 'created'}. ${!pitch.active ? 'It is inactive and hidden from booking.' : result.published ? 'Players can find it on your stadium page.' : 'It is saved in your stadium draft. Publish the stadium page when you are ready to accept bookings.'}`,
      );
    } catch (err) {
      setError(extractApiErrorMessage(err, "The pitch could not be saved."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="venue-flow">
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
      <form ref={form} onSubmit={save} noValidate aria-label="Pitch editor">
        <VenueSteps labels={['Pitch details', 'Price & availability', 'Review & save']} step={step} onChange={go} disabled={busy || editingPhoto}/>
        <div className="venue-flow-grid"><fieldset disabled={busy || uploading} className="venue-panel venue-form">
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
        </div><div hidden={step !== 1} data-flow-step="1" className="venue-form">
        <label className="venue-field">
          <span>Hourly rate ({venue.currency})</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={pitch.pricePerHour}
            onChange={(event) =>
              setPitch({ ...pitch, pricePerHour: Number(event.target.value) })
            }
          />
        </label>
        <label className="venue-checkbox">
          <input
            type="checkbox"
            checked={!!pitch.covered}
            onChange={(event) =>
              setPitch({ ...pitch, covered: event.target.checked })
            }
          />
          Covered pitch
        </label>
        <label className="venue-checkbox">
          <input
            type="checkbox"
            checked={!!pitch.active}
            onChange={(event) =>
              setPitch({ ...pitch, active: event.target.checked })
            }
          />
          Active and available to book
        </label>
        <section className="venue-shared-space"><h3>Which physical space does this use?</h3><p className="venue-muted">A full field and its halves must share availability. Separate pitches keep their own calendar.</p>
          <label className="venue-field"><span>Physical space</span><select aria-label="Physical space" value={venue.pitches.some(p => p.id !== pitch.id && p.resourceGroup === pitch.resourceGroup) ? pitch.resourceGroup : '__own'} onChange={event => {
            const other = venue.pitches.find(p => p.resourceGroup === event.target.value);
            setPitch({ ...pitch, resourceGroup: other?.resourceGroup || '', resourceUnits: other?.resourceUnits || [] });
          }}><option value="__own">Independent pitch / its own ground</option>{[...new Map(venue.pitches.filter(p => p.id !== pitch.id && p.resourceGroup).map(p => [p.resourceGroup, p])).values()].map(p => <option key={p.resourceGroup} value={p.resourceGroup}>Same ground as {p.name}</option>)}</select></label>
          {pitch.resourceGroup && venue.pitches.some(p => p.id !== pitch.id && p.resourceGroup === pitch.resourceGroup) && <fieldset className="venue-resource-fields"><legend>Sections this option occupies</legend>{[...new Set(venue.pitches.filter(p => p.resourceGroup === pitch.resourceGroup).flatMap(p => p.resourceUnits))].map(unit => <label key={unit} className="venue-checkbox"><input type="checkbox" checked={pitch.resourceUnits.includes(unit)} onChange={event => setPitch({ ...pitch, resourceUnits: event.target.checked ? [...pitch.resourceUnits, unit] : pitch.resourceUnits.filter(u => u !== unit) })}/>{unit === 'left' ? 'Left half' : unit === 'right' ? 'Right half' : unit}</label>)}<p className="venue-muted">Select every section used. A booking blocks any other option using one of these sections.</p></fieldset>}
          <button type="button" className="venue-link" onClick={() => setPitch({ ...pitch, resourceGroup: pitch.resourceGroup || `ground-${crypto.randomUUID()}`, resourceUnits: ['left', 'right'] })}>Set this up as a full field with two halves</button><p className="venue-muted">Save the full field first. Add each half as a new pitch, choose the same ground and select its half. Changing shared space may be refused while existing bookings need the current arrangement.</p>
        </section>
        <details><summary>Advanced shared-space settings</summary><fieldset className="venue-resource-fields">
          <legend>
            Shared pitch space <small>(optional)</small>
          </legend>
          <label className="venue-field">
            <span>Shared ground name</span>
            <input
              value={pitch.resourceGroup}
              maxLength={80}
              placeholder="main-field"
              pattern="[A-Za-z0-9_-]{1,80}"
              onChange={(event) =>
                setPitch({ ...pitch, resourceGroup: event.target.value })
              }
            />
          </label>
          <label className="venue-field">
            <span>
              Sections used <small>(comma separated)</small>
            </span>
            <input
              value={pitch.resourceUnits.join(", ")}
              maxLength={250}
              placeholder="left, right"
              onChange={(event) =>
                setPitch({
                  ...pitch,
                  resourceUnits: event.target.value
                    .split(",")
                    .map((value) => value.trimStart()),
                })
              }
            />
          </label>
          <p className="venue-muted">
            Use letters, numbers, hyphens or underscores for shared names and
            sections. Leave both blank for an independent pitch.
          </p>
        </fieldset></details>
        </div><div hidden={step !== 2} data-flow-step="2"><h2>{lastSavedPitch && !dirtyPitch ? 'Your pitch is saved' : 'Ready to save this pitch?'}</h2><p>{lastSavedPitch && !dirtyPitch ? 'Continue editing this pitch or add another rentable space.' : 'Check the photo, name, format, rate and availability in the preview.'}</p><p className="venue-muted">Shared sections determine which other pitch options become unavailable when this pitch is booked. Existing reservations are kept.</p>{lastSavedPitch?.active && !venue.promotionBlocked && <a className="venue-button" href={`/stadiums/${venue.id}#pitch-${lastSavedPitch.id}`}>{venue.published ? 'View saved pitch' : 'Preview saved pitch'}</a>}</div>
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
