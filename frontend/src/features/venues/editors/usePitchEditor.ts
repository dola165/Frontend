import { useEffect, useRef, useState, type FormEvent } from "react";
import { useIdentityImageEditor } from '../../../hooks/useIdentityImageEditor';
import { extractApiErrorMessage } from "../../../utils/apiError";
import { validateVenueForm } from '../flowValidation';
import { savePitch, type Pitch, type Venue } from "../api";

export const blankPitch = {
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

export type PitchEditorProps = {
  venue: Venue;
  onSave: (venue: Venue) => void;
};

/** The pitch editor's selected pitch, its draft and photo, the steps and saving. */
export function usePitchEditor({ venue, onSave }: PitchEditorProps) {
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
  return { venue, step, setStep, form, go, pitch, setPitch, busy, error, message, selection, setSelection, dirtyPitch, lastSavedPitch, imageEditor, uploading, editingPhoto, openPitch, selectPitch, save };
}

export type PitchEditor = ReturnType<typeof usePitchEditor>;
