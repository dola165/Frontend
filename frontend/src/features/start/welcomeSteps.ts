import type { WelcomeProgress, WelcomeStep } from '../preferences/preferencesStore';

/**
 * "Set up your profile" after sign-up, over Home, four steps: what you do in football, about you, clubs near you, and
 * your finished profile (with what to do next). Every step can be skipped; the step is in the address
 * (`?welcome=about`), so Back works; the progress is kept in the person's preferences.
 */
export const WELCOME_PARAM = 'welcome';
export const STEPS = ['roles', 'about', 'clubs', 'profile'] as const;
export type Step = typeof STEPS[number];

const STORED: Record<Step, WelcomeStep> = { roles: 'ROLES', about: 'ABOUT', clubs: 'FOLLOW', profile: 'PROFILE' };
/** Steps of the earlier welcome, as old links and progress saved then still name them. */
const EARLIER: Record<string, Step> = { follow: 'clubs', club: 'clubs', child: 'profile', tournament: 'profile', venue: 'profile', business: 'profile' };

export const stepFromParam = (value: string | null): Step | null =>
    (STEPS as readonly string[]).includes(value ?? '') ? value as Step : EARLIER[value ?? ''] ?? null;
export const storedStep = (step: Step) => STORED[step];
export const stepFromStored = (stored?: WelcomeStep | null): Step | null =>
    stored ? STEPS.find(step => STORED[step] === stored) ?? EARLIER[stored.toLowerCase()] ?? null : null;

/** Roles that need an adult account (the server refuses them under 18), so a minor never sees them. */
export const ADULT_ROLES = ['PARENT', 'ORGANIZER', 'AGENT', 'VENUE_MANAGER'] as const;

/** Looking at the finished profile is not a task: skipping it never brings it back. */
const remembered = (step: Step) => step !== 'profile';
const inOrder = (steps: Iterable<Step>) => STEPS.filter(step => [...steps].includes(step));
const stepsOf = (stored?: WelcomeStep[]) => (stored ?? []).map(stepFromStored).filter((step): step is Step => step !== null);
const storedList = (steps: Iterable<Step>) => inOrder(steps).map(storedStep);

/** The setup is up, at this step. */
export const opened = (progress: WelcomeProgress | null | undefined, step: Step): WelcomeProgress =>
    ({ ...progress, state: progress?.state ?? 'OPEN', at: storedStep(step) });
/** This step was skipped: it comes back once on Home. */
export function skipped(progress: WelcomeProgress | null | undefined, step: Step): WelcomeProgress {
    const set = new Set(stepsOf(progress?.skipped));
    if (remembered(step)) set.add(step);
    return { ...progress, state: progress?.state ?? 'OPEN', skipped: storedList(set) };
}
/** This step was done (here, or from the card): it never comes back. */
export const done = (progress: WelcomeProgress | null | undefined, step: Step): WelcomeProgress =>
    ({ ...progress, state: progress?.state ?? 'OPEN', skipped: storedList(stepsOf(progress?.skipped).filter(item => item !== step)) });
/**
 * The setup ends at `step`: skipped from there, or left to do something; null when finished. The steps from there on
 * come back once on Home, and the setup never opens by itself again.
 */
export function closed(progress: WelcomeProgress | null | undefined, step: Step | null): WelcomeProgress {
    const set = new Set(stepsOf(progress?.skipped));
    if (step) STEPS.slice(STEPS.indexOf(step)).filter(remembered).forEach(item => set.add(item));
    return { ...progress, state: 'DONE', at: null, skipped: storedList(set) };
}

/** What the "Finish setting up" card on Home lists: skipped steps, until it is dismissed. */
export const cardSteps = (progress: WelcomeProgress | null | undefined): Step[] =>
    progress?.state === 'DONE' && !progress.cardDismissed ? inOrder(stepsOf(progress.skipped)).filter(remembered) : [];
