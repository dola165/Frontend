import { Briefcase, Camera, Dumbbell, Hammer, Heart, MapPin, Search, Shield, Trophy, UserPlus, Users, type LucideIcon } from 'lucide-react';
import type { WelcomeProgress } from '../preferences/preferencesStore';
import type { Choice } from '../start/welcomeSteps';

/**
 * How a step opens: over the current page where it can (an F5 action, the clubs near you to follow, the photo
 * picker), otherwise the page where it is done.
 */
export type StepOpen = { kind: 'link'; to: string } | { kind: 'action'; action: 'add_child'; fallback: string } | { kind: 'follow' } | { kind: 'photo' };
export interface WeekStep { id: string; icon: LucideIcon; en: string; ka: string; open: StepOpen }

const link = (to: string): StepOpen => ({ kind: 'link', to });

/** Three steps for each answer to the welcome. */
export function stepsFor(choice: Choice, childAge: number | null | undefined): WeekStep[] {
    const follow: WeekStep = { id: 'follow', icon: Heart, en: 'Follow clubs near you', ka: 'გამოიწერეთ ახლომდებარე კლუბები', open: { kind: 'follow' } };
    const photo: WeekStep = { id: 'photo', icon: Camera, en: 'Add your photo', ka: 'დაამატეთ ფოტო', open: { kind: 'photo' } };
    switch (choice) {
        case 'me': return [
            { id: 'trials', icon: Search, en: 'Find a trial that fits you', ka: 'იპოვეთ თქვენთვის შესაფერისი გასინჯვა', open: link('/world/opportunities?tab=trials&forMe=true') }, follow, photo];
        case 'child': return [
            { id: 'groups', icon: Dumbbell, en: 'Find a place to train', ka: 'იპოვეთ სავარჯიშო ადგილი', open: link(`/world/clubs${childAge != null ? `?age=${childAge}` : ''}`) },
            { id: 'child', icon: UserPlus, en: 'Add your child', ka: 'დაამატეთ თქვენი შვილი', open: { kind: 'action', action: 'add_child', fallback: '/parent' } }, follow];
        case 'club': return [
            { id: 'club', icon: Shield, en: 'Open your club', ka: 'გახსენით თქვენი კლუბი', open: link('/my-club') },
            { id: 'squads', icon: Users, en: 'Plan a training session', ka: 'დაგეგმეთ ვარჯიში', open: link('/my-squads') }, photo];
        case 'work': return [
            { id: 'jobs', icon: Briefcase, en: 'Look at jobs near you', ka: 'ნახეთ ახლომდებარე სამუშაოები', open: link('/jobs/all') },
            { id: 'work', icon: Hammer, en: 'Say what you do', ka: 'მიუთითეთ, რას აკეთებთ', open: link('/profile/me?edit=work') }, photo];
        case 'business': return [
            { id: 'page', icon: Shield, en: 'Finish your page', ka: 'დაასრულეთ თქვენი გვერდი', open: link('/my-organizations') },
            { id: 'clubs', icon: MapPin, en: 'Find clubs near you', ka: 'იპოვეთ ახლომდებარე კლუბები', open: link('/world/clubs') },
            { id: 'tournaments', icon: Trophy, en: 'See tournaments', ka: 'ნახეთ ტურნირები', open: link('/world/tournaments') }];
        case 'follow': return [
            follow, { id: 'matches', icon: Trophy, en: 'See matches near you', ka: 'ნახეთ ახლომდებარე მატჩები', open: link('/world/matches') }, photo];
    }
}

/**
 * Whether the checklist is unfolded, kept with the welcome's progress so it follows the person to every device. The
 * server keeps only the steps done (`week`), so the unfolded state rides there as a name no step uses.
 */
const OPEN_MARK = 'open';
export const isUnfolded = (progress: WelcomeProgress | null | undefined) => Boolean(progress?.week?.includes(OPEN_MARK));
export const withUnfolded = (progress: WelcomeProgress | null | undefined, open: boolean): WelcomeProgress => {
    const week = (progress?.week ?? []).filter(step => step !== OPEN_MARK);
    return { ...progress, state: progress?.state ?? 'DONE', week: open ? [...week, OPEN_MARK] : week };
};
