import { Briefcase, Camera, Earth, Hammer, Heart, Shield, Trophy, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { WORLD_BRAND } from '../../components/brand/worldBrand';
import type { WelcomeProgress } from '../preferences/preferencesStore';
import type { Choice } from '../start/welcomeSteps';

/**
 * How a step opens: over the current page where it can (an F5 action, the clubs near you to follow, the photo
 * picker), otherwise the page where it is done.
 */
export type StepOpen = { kind: 'link'; to: string } | { kind: 'action'; action: 'add_child'; fallback: string } | { kind: 'follow' } | { kind: 'photo' };
/** `world`: the step that introduces GrassKickZ World by name, with its mark and promise. */
export interface WeekStep { id: string; icon: LucideIcon; en: string; ka: string; open: StepOpen; world?: boolean }

const link = (to: string): StepOpen => ({ kind: 'link', to });

/**
 * Three steps for each answer to the welcome. Every week meets GrassKickZ World (owner, 27 October 2026); it took the
 * place of the step that only sent people into World anyway (a trial, a place to train, clubs, matches).
 */
export function stepsFor(choice: Choice): WeekStep[] {
    const world: WeekStep = { id: 'world', icon: Earth, en: WORLD_BRAND.meet[0], ka: WORLD_BRAND.meet[1], open: link('/world'), world: true };
    const follow: WeekStep = { id: 'follow', icon: Heart, en: 'Follow clubs near you', ka: 'გამოიწერეთ ახლომდებარე კლუბები', open: { kind: 'follow' } };
    const photo: WeekStep = { id: 'photo', icon: Camera, en: 'Add your photo', ka: 'დაამატეთ ფოტო', open: { kind: 'photo' } };
    switch (choice) {
        case 'me': return [world, follow, photo];
        case 'child': return [
            { id: 'child', icon: UserPlus, en: 'Add your child', ka: 'დაამატეთ თქვენი შვილი', open: { kind: 'action', action: 'add_child', fallback: '/parent' } }, world, follow];
        case 'club': return [
            { id: 'club', icon: Shield, en: 'Open your club', ka: 'გახსენით თქვენი კლუბი', open: link('/my-club') },
            { id: 'squads', icon: Users, en: 'Plan a training session', ka: 'დაგეგმეთ ვარჯიში', open: link('/my-squads') }, world];
        case 'work': return [
            { id: 'jobs', icon: Briefcase, en: 'Look at jobs near you', ka: 'ნახეთ ახლომდებარე სამუშაოები', open: link('/jobs/all') },
            { id: 'work', icon: Hammer, en: 'Say what you do', ka: 'მიუთითეთ, რას აკეთებთ', open: link('/profile/me?edit=work') }, world];
        case 'business': return [
            { id: 'page', icon: Shield, en: 'Finish your page', ka: 'დაასრულეთ თქვენი გვერდი', open: link('/my-organizations') }, world,
            { id: 'tournaments', icon: Trophy, en: 'See tournaments', ka: 'ნახეთ ტურნირები', open: link('/world/tournaments') }];
        case 'follow': return [follow, world, photo];
    }
}

/**
 * The server keeps at most ten names in `week`, each `[a-z-]{1,30}`, and refuses the whole first-run section
 * otherwise: every write here keeps it unique, valid and within that, dropping the oldest names first.
 */
const WEEK_LIMIT = 10;
const WEEK_NAME = /^[a-z-]{1,30}$/;
const fitted = (week: string[]) => [...new Set(week.filter(name => WEEK_NAME.test(name)))].slice(-WEEK_LIMIT);
const withWeek = (progress: WelcomeProgress | null | undefined, week: string[]): WelcomeProgress =>
    ({ ...progress, state: progress?.state ?? 'DONE', week: fitted(week) });

/** A step of the week was done. */
export const markDone = (progress: WelcomeProgress | null | undefined, step: string): WelcomeProgress =>
    withWeek(progress, [...(progress?.week ?? []), step]);

/**
 * Whether the checklist is unfolded, kept with the welcome's progress so it follows the person to every device. The
 * server keeps only the steps done (`week`), so the unfolded state rides there as a name no step uses.
 */
const OPEN_MARK = 'open';
export const isUnfolded = (progress: WelcomeProgress | null | undefined) => Boolean(progress?.week?.includes(OPEN_MARK));
export const withUnfolded = (progress: WelcomeProgress | null | undefined, open: boolean): WelcomeProgress => {
    const week = (progress?.week ?? []).filter(step => step !== OPEN_MARK);
    return withWeek(progress, open ? [...week, OPEN_MARK] : week);
};

/** Steps done, by name; "See matches near you" (until 27 October 2026) counts as having opened World. */
export const doneSteps = (progress: WelcomeProgress | null | undefined) => {
    const done = new Set(progress?.week ?? []);
    if (done.has('matches')) done.add('world');
    return done;
};
