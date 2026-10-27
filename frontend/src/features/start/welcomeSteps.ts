import type { WelcomeChoice, WelcomeProgress, WelcomeStep } from '../preferences/preferencesStore';

/**
 * The welcome after a plain sign-up (F7, 26 October 2026), over Home, two screens at most: "What brings you to
 * GrassKickZ?" (`?welcome=start`), then one screen for the answer (`?welcome=child`), then the person lands. The step
 * is in the address, so Back works; where it is and the answer are kept in the person's preferences.
 */
export const WELCOME_PARAM = 'welcome';
/** A screen inside a step, so Back steps back within it: the Club step's search (`find`), Add your child (`add`). */
export const PART_PARAM = 'part';
export type Part = 'find' | 'add';
export const partFromParam = (value: string | null): Part | null => (value === 'find' || value === 'add' ? value : null);
export const CHOICES = ['me', 'child', 'club', 'work', 'business', 'follow'] as const;
export type Choice = typeof CHOICES[number];
export type Step = 'start' | Choice;

const STORED: Record<Choice, WelcomeChoice> = { me: 'ME', child: 'CHILD', club: 'CLUB', work: 'WORK', business: 'BUSINESS', follow: 'FOLLOW' };
export const storedChoice = (choice: Choice) => STORED[choice];
export const choiceFromStored = (stored?: WelcomeChoice | null): Choice | null =>
    (stored ? CHOICES.find(choice => STORED[choice] === stored) : null) ?? null;

/**
 * Under 18 a person sees only Play (for themselves) and Follow: adding a child, a club's jobs, work and pages are for
 * adults (F7, review of 26 October 2026). A missing birth date is not adult.
 */
export const choicesFor = ({ adult }: { adult: boolean }): readonly Choice[] => (adult ? CHOICES : ['me', 'follow']);

/** The step an address names; links of the earlier five-step welcome open step 1. */
export function stepFromParam(value: string | null): Step | null {
    if (!value) return null;
    if (value === 'start' || (CHOICES as readonly string[]).includes(value)) return value as Step;
    return ['roles', 'about', 'clubs', 'profile', 'page'].includes(value) ? 'start' : null;
}
/** The step kept in preferences, as an address names it: an earlier welcome left open restarts at step 1. */
export const stepFromStored = (stored?: WelcomeStep | null): Step | null =>
    stored ? choiceFromStored(stored as WelcomeChoice) ?? 'start' : null;
const storedStep = (step: Step): WelcomeStep => (step === 'start' ? 'START' : STORED[step]);

/** The welcome is up at this step. */
export const opened = (progress: WelcomeProgress | null | undefined, step: Step): WelcomeProgress =>
    ({ ...progress, state: progress?.state ?? 'OPEN', at: storedStep(step), ...(step === 'start' ? {} : { choice: STORED[step] }) });
/** The server keeps at most 10 first-week steps, each in lower case and dashes; more makes the whole save fail. */
const WEEK_LIMIT = 10;
const weekSteps = (steps: readonly string[]) => [...new Set(steps)].filter(step => /^[a-z-]+$/.test(step)).slice(-WEEK_LIMIT);
/**
 * The welcome is over with this answer (Skip counts as following football); it never opens by itself again. The same
 * answer again keeps its first week as it was; a new answer starts a new first week, so no step of the old one is
 * carried over.
 */
export const finished = (progress: WelcomeProgress | null | undefined, choice: Choice): WelcomeProgress => {
    const same = progress?.state === 'DONE' && progress.choice === STORED[choice];
    return { state: 'DONE', at: null, choice: STORED[choice], week: same ? weekSteps(progress.week ?? []) : [], cardDismissed: same ? progress.cardDismissed === true : false };
};
/** A step of "Your first week" was done. */
export const weekDone = (progress: WelcomeProgress | null | undefined, step: string): WelcomeProgress =>
    ({ ...progress, state: progress?.state ?? 'DONE', week: weekSteps([...(progress?.week ?? []), step]) });
