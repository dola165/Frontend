import { useEffect, useRef, useState, type FormEvent } from "react";
import { useIdentityImageEditor } from '../../../hooks/useIdentityImageEditor';
import { promptEmailConfirmation } from '../../../components/auth/emailConfirmationPrompt';
import { extractApiErrorMessage } from "../../../utils/apiError";
import { listingReadiness, validateVenueForm } from '../flowValidation';
import { saveVenue, type Venue, type VenueDraft } from "../api";

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

export type ListingEditorProps = {
  venue: Venue;
  onSave: (venue: Venue) => void;
  target?: { step: number; token: number };
};

/** The stadium page editor's draft, photos, steps and saving. */
export function useListingEditor({ venue, onSave, target }: ListingEditorProps) {
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
      if (!promptEmailConfirmation(err)) setError(extractApiErrorMessage(err, "Your changes could not be saved."));
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
  return { venue, step, setStep, form, draft, setDraft, busy, error, message, imageEditor, uploading, selectPhoto, readiness, dirty, go, change, save, movePhoto };
}

export type ListingEditor = ReturnType<typeof useListingEditor>;
