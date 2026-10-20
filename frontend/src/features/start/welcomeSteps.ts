import type { WelcomeProgress, WelcomeStep } from '../preferences/preferencesStore';

/**
 * The welcome after sign-up, over Home: what you do in football, then the one move each choice leads to (your club,
 * your child, a tournament, your venue), then clubs near you, then the optional "Here as a business?". The step is in
 * the address (`?welcome=club`), so Back works; the progress is kept in the person's preferences.
 */
export const WELCOME_PARAM = 'welcome';
export const STEPS = ['roles', 'club', 'child', 'tournament', 'venue', 'follow', 'business'] as const;
export type Step = typeof STEPS[number];

export const stepFromParam = (value: string | null): Step | null => (STEPS as readonly string[]).includes(value ?? '') ? value as Step : null;
export const storedStep = (step: Step) => step.toUpperCase() as WelcomeStep;
export const stepFromStored = (stored?: WelcomeStep | null): Step | null => stepFromParam(stored ? stored.toLowerCase() : null);

/** Roles that need an adult account (the server refuses them under 18), so a minor never sees them. */
export const ADULT_ROLES = ['PARENT', 'ORGANIZER', 'AGENT', 'VENUE_MANAGER'] as const;

/** What decides which steps make sense: the person's age, and whether any club near them is known. */
export interface StepFacts { adult: boolean; clubsNearby: boolean }

/**
 * The steps for these football roles, in order. A step with nothing for this person is left out: nothing relevant
 * chosen goes straight to clubs near them; no known club near them skips that; pages and businesses are for adults.
 */
export function welcomeSteps(roles: readonly string[], facts: StepFacts = { adult: true, clubsNearby: true }): Step[] {
    const next: Step[] = [];
    if (roles.includes('COACH') || roles.includes('CLUB_STAFF')) next.push('club');
    if (facts.adult && roles.includes('PARENT')) next.push('child');
    if (facts.adult && roles.includes('ORGANIZER')) next.push('tournament');
    if (facts.adult && roles.includes('VENUE_MANAGER')) next.push('venue');
    if (facts.clubsNearby) next.push('follow');
    if (facts.adult) next.push('business');
    return ['roles', ...next];
}

/** "Here as a business?" is a question, not a task: a skip never brings it back. */
const remembered = (step: Step) => step !== 'business';
const listed = (steps: Iterable<WelcomeStep>) => STEPS.map(storedStep).filter(step => [...steps].includes(step));

/** The popup is up, at this step. */
export const opened = (progress: WelcomeProgress | null | undefined, step: Step): WelcomeProgress =>
    ({ ...progress, state: progress?.state ?? 'OPEN', at: storedStep(step) });
/** This step was skipped: it comes back once on Home. */
export function skipped(progress: WelcomeProgress | null | undefined, step: Step): WelcomeProgress {
    const set = new Set(progress?.skipped ?? []);
    if (remembered(step)) set.add(storedStep(step));
    return { ...progress, state: progress?.state ?? 'OPEN', skipped: listed(set) };
}
/** This step was done (here, or from the card): it never comes back. */
export const done = (progress: WelcomeProgress | null | undefined, step: Step): WelcomeProgress =>
    ({ ...progress, state: progress?.state ?? 'OPEN', skipped: (progress?.skipped ?? []).filter(item => item !== storedStep(step)) });
/**
 * The popup ends at `step`: finished, closed, or left to do something. The steps from there on that were not done come
 * back once on Home, and the popup never opens by itself again.
 */
export function closed(progress: WelcomeProgress | null | undefined, steps: readonly Step[], step: Step | null): WelcomeProgress {
    const set = new Set(progress?.skipped ?? []);
    if (step) steps.slice(Math.max(0, steps.indexOf(step))).filter(remembered).forEach(item => set.add(storedStep(item)));
    return { ...progress, state: 'DONE', at: null, skipped: listed(set) };
}

/** What the "finish setting up" card on Home lists: skipped steps, until it is dismissed. */
export const cardSteps = (progress: WelcomeProgress | null | undefined): Step[] =>
    progress?.state === 'DONE' && !progress.cardDismissed ? (progress.skipped ?? []).map(stepFromStored).filter((step): step is Step => step !== null) : [];
