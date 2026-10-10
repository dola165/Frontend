// Synthetic data for profiles and opt-out attendance: professions people describe in their
// own words, and which squad events ask families to confirm. Fictional, in memory.
import * as W from './world.mjs';

// ---------------------------------------------------------------- attendance (opt-out)
/** eventId -> true when the coach asked players to confirm; absent means the default for its type. */
export const confirmation = new Map();
/** Matches and trips ask for confirmation by default; training assumes everyone is coming. */
export const confirmationRequested = event => confirmation.get(event.id) ?? event.type !== 'TRAINING';
/** `${eventId}:${playerId}` -> the optional reason given with "can't come". Visible to the squad's coaches. */
export const replyReasons = new Map();
const REASONS = ['School trip', 'Resting a sore ankle', null, 'Family event'];
/** A plausible note for a synthetic "can't come"; some families give none. */
export const defaultReason = (eventId, playerId) => REASONS[(eventId + playerId) % REASONS.length];

// ---------------------------------------------------------------- professions
/** What admins (and later Dola) map free text to, so people can be found and matched. */
const LABELS = {
  'sports psychologist': 'Sports psychology', 'sports psychiatrist': 'Sports psychology', psychologist: 'Sports psychology',
  physiotherapist: 'Physiotherapy', 'video analyst': 'Performance analysis', 'performance analyst': 'Performance analysis',
  'football photographer': 'Photography', photographer: 'Photography', 'sports nutritionist': 'Nutrition', nutritionist: 'Nutrition',
  'strength & conditioning coach': 'Strength and conditioning', 'strength and conditioning coach': 'Strength and conditioning', 'fitness coach': 'Strength and conditioning',
  'sports doctor': 'Medicine', 'first aider': 'Medicine', videographer: 'Photography and video', 'marketing and social media': 'Media and communications',
  'event organizer': 'Events', groundskeeper: 'Facilities', 'kit manager': 'Equipment', translator: 'Languages',
  'sports lawyer': 'Legal', lawyer: 'Legal', 'team doctor': 'Medicine', doctor: 'Medicine',
  'physical education teacher': 'Teaching', teacher: 'Teaching', accountant: 'Finance', 'minibus driver': 'Transport', driver: 'Transport',
};
export const labelFor = title => LABELS[String(title).trim().toLowerCase()] ?? null;

let nextId = 9100;
const entry = (fields) => ({ id: nextId++, label: labelFor(fields.title), detail: null, since: null, published: true, verification: 'SELF_REPORTED', verifiedBy: null, ...fields });

/** userId -> professions. Luka teaches PE part-time; independent specialists list their own work. */
export const professions = new Map([
  [W.ME_ID, [entry({ title: 'Physical education teacher', detail: 'Part-time PE teacher at Tbilisi Public School 51. Runs the school football club after lessons.', since: '2012' })]],
]);
for (const p of W.people.filter(person => person.profession)) {
  professions.set(p.id, [entry({ title: p.profession, detail: `${p.profession} working with youth and amateur players in ${p.city}.`, since: String(2008 + (p.id % 12)) })]);
}
// One specialist works with the academy: the club confirms that part of their profile.
{
  const psychologist = W.people.find(person => person.profession === 'Sports psychologist');
  if (psychologist) professions.set(psychologist.id, [entry({ title: 'Sports psychologist', detail: 'Mental skills sessions for the U16 and U18 squads; one-to-one support for players returning from injury.', since: '2015', verification: 'CLUB_CONFIRMED', verifiedBy: 'FC Dinamo Tbilisi Academy' })]);
}
export const newProfessionId = () => nextId++;
