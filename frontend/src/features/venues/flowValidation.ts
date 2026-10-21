import type { Venue, VenueDraft } from './api';

/** Reveal the invalid field's step before focusing it, including a hidden required input. */
export function validateVenueForm(form: HTMLFormElement, setStep: (step: number) => void, currentOnly = false) {
  const invalid = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'))
    .find(input => (!currentOnly || !input.closest('[hidden]')) && !input.disabled && !input.checkValidity());
  if (!invalid) return true;
  const step = invalid.closest<HTMLElement>('[data-flow-step]')?.dataset.flowStep;
  if (step !== undefined) setStep(Number(step));
  requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); });
  return false;
}

export function listingReadiness(draft: VenueDraft, venue: Venue) {
  return [
    { label: 'Name and cover photo', ready: !!draft.displayName.trim() && draft.photos.length > 0, step: 0 },
    { label: 'City, address, entrance pin and phone', ready: !!draft.city.trim() && !!draft.addressText.trim() && draft.latitude != null && draft.longitude != null && !!draft.publicPhone.trim(), step: 1 },
    { label: 'Opening hours and booking rules', ready: draft.openingHours.length > 0, step: 2 },
    { label: 'At least one active pitch', ready: venue.pitches.some(p => p.active), step: -1 },
  ];
}

