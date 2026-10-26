import type { BadgeTone } from '../../design/primitives';
import type { ScoreParty, ScoreStatus } from './api';

/** Every status a score can show: the record's own, plus the listings' historical, organiser-recorded and bye rows. */
export type AnyScoreStatus = ScoreStatus | 'LEGACY' | 'RECORDED' | 'BYE';
type Words = readonly [en: string, ka: string];
export type Copy = (en: string, ka: string) => string;

/** A record nobody can still change: confirmed, settled, final, or a tournament score entered by its organiser. */
export const isOfficial = (status: AnyScoreStatus | null | undefined) => status === 'CONFIRMED' || status === 'SETTLED' || status === 'FINAL' || status === 'RECORDED';
/** A score is reported or disputed and waits for someone. */
export const isOpen = (status: AnyScoreStatus | null | undefined) => status === 'REPORTED' || status === 'DISPUTED';

const words: Record<AnyScoreStatus, Words> = {
  NONE: ['No score yet', 'ანგარიში ჯერ არ არის'],
  REPORTED: ['Reported', 'შეტანილი'],
  CONFIRMED: ['Confirmed', 'დადასტურებული'],
  DISPUTED: ['Disputed', 'სადავო'],
  SETTLED: ['Settled', 'გადაწყვეტილი'],
  FINAL: ['Final', 'საბოლოო'],
  // An organiser's tournament score counts at once: it reads as final like any other.
  RECORDED: ['Final', 'საბოლოო'],
  LEGACY: ['Previously recorded', 'ადრე დაფიქსირებული'],
  BYE: ['Bye', 'გამოტოვება'],
};

/** The status in words and the colour of its dot: amber waits on a decision, red is disputed, green is official. */
export function scoreState(status: AnyScoreStatus | null | undefined, { legacy = false, ended = true, cancelled = false } = {}): { words: Words; tone: BadgeTone } {
  if (cancelled) return { words: ['Cancelled', 'გაუქმებული'], tone: 'neutral' };
  if (legacy && (status == null || status === 'NONE' || status === 'CONFIRMED')) return { words: words.LEGACY, tone: 'neutral' };
  // A status this screen does not know yet (an older or newer server) reads as no score, never as a crash.
  const value: AnyScoreStatus = status && status in words ? status : 'NONE';
  if (value === 'NONE' && !ended) return { words: ['Upcoming', 'მომავალი'], tone: 'neutral' };
  const tone: BadgeTone = value === 'DISPUTED' ? 'danger' : value === 'REPORTED' || value === 'NONE' ? 'warning' : isOfficial(value) ? 'accent' : 'neutral';
  return { words: words[value], tone };
}

/** Who acted, by the club's name where it is a club: "Dinamo", "the referee", "the organiser". */
export function partyName(side: ScoreParty | null | undefined, home: string, away: string, copy: Copy) {
  return side === 'HOME' ? home : side === 'AWAY' ? away : side === 'REFEREE' ? copy('the referee', 'მსაჯი') : side === 'ORGANISER' ? copy('the organiser', 'ორგანიზატორი') : copy('a match participant', 'მატჩის მონაწილე');
}

/** The time left in a window as "31 h" (minutes in the last hour), or null once it has closed. */
function timeLeft(until: string | null | undefined, now: number) {
  const left = until ? Date.parse(until) - now : Number.NaN;
  if (!(left > 0)) return null;
  return left < 3_600_000 ? { value: Math.max(1, Math.round(left / 60_000)), en: 'min', ka: 'წთ' } : { value: Math.floor(left / 3_600_000), en: 'h', ka: 'სთ' };
}
/** "Can be disputed for 31 h", or null once the window has closed. */
export function disputeWindow(until: string | null | undefined, now: number, copy: Copy) {
  const left = timeLeft(until, now);
  return left && copy(`Can be disputed for ${left.value} ${left.en}`, `გასაჩივრება შესაძლებელია ${left.value} ${left.ka}`);
}
/** "Can be corrected for 31 h" (a one-sided calendar score), or null once the window has closed. */
export function correctWindow(until: string | null | undefined, now: number, copy: Copy) {
  const left = timeLeft(until, now);
  return left && copy(`Can be corrected for ${left.value} ${left.en}`, `შესწორება შესაძლებელია ${left.value} ${left.ka}`);
}

export const goals = (home: number | null | undefined, away: number | null | undefined) => home == null || away == null ? null : `${home}–${away}`;
