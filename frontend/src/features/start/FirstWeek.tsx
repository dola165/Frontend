import { Briefcase, Camera, Check, ChevronRight, Dumbbell, Heart, MapPin, Search, Shield, Trophy, UserPlus, Users, X, type LucideIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../design/primitives';
import { usePreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveStart } from './startApi';
import { isAdult } from '../../utils/age';
import { choiceFromStored, choicesFor, WELCOME_PARAM, weekDone, type Choice } from './welcomeSteps';
import './welcome.css';

interface WeekStep { id: string; icon: LucideIcon; en: string; ka: string; to: string }

/** Three steps for each answer to the welcome, each one tap to where it is done. */
function stepsFor(choice: Choice, childAge: number | null | undefined): WeekStep[] {
    const follow: WeekStep = { id: 'follow', icon: Heart, en: 'Follow clubs near you', ka: 'გამოიწერეთ ახლომდებარე კლუბები', to: '/world/clubs' };
    const photo: WeekStep = { id: 'photo', icon: Camera, en: 'Add your photo', ka: 'დაამატეთ ფოტო', to: '/profile/me' };
    switch (choice) {
        case 'me': return [
            { id: 'trials', icon: Search, en: 'Find a trial that fits you', ka: 'იპოვეთ თქვენთვის შესაფერისი გასინჯვა', to: '/world/opportunities?tab=trials&forMe=true' }, follow, photo];
        case 'child': return [
            { id: 'groups', icon: Dumbbell, en: 'Find a place to train', ka: 'იპოვეთ სავარჯიშო ადგილი', to: `/world/clubs${childAge != null ? `?age=${childAge}` : ''}` },
            { id: 'child', icon: UserPlus, en: 'Add your child', ka: 'დაამატეთ თქვენი შვილი', to: '/parent' }, follow];
        case 'club': return [
            { id: 'club', icon: Shield, en: 'Open your club', ka: 'გახსენით თქვენი კლუბი', to: '/my-club' },
            { id: 'squads', icon: Users, en: 'Plan a training session', ka: 'დაგეგმეთ ვარჯიში', to: '/my-squads' }, photo];
        case 'work': return [
            { id: 'jobs', icon: Briefcase, en: 'Look at jobs near you', ka: 'ნახეთ ახლომდებარე სამსახურები', to: '/jobs/all' },
            { id: 'profile', icon: Camera, en: 'Add your photo and experience', ka: 'დაამატეთ ფოტო და გამოცდილება', to: '/profile/me' }, follow];
        case 'business': return [
            { id: 'page', icon: Shield, en: 'Finish your page', ka: 'დაასრულეთ თქვენი გვერდი', to: '/my-organizations' },
            { id: 'clubs', icon: MapPin, en: 'Find clubs near you', ka: 'იპოვეთ ახლომდებარე კლუბები', to: '/world/clubs' },
            { id: 'tournaments', icon: Trophy, en: 'See tournaments', ka: 'ნახეთ ტურნირები', to: '/world/tournaments' }];
        case 'follow': return [
            follow, { id: 'matches', icon: Trophy, en: 'See matches near you', ka: 'ნახეთ ახლომდებარე მატჩები', to: '/world/matches' }, photo];
    }
}

/**
 * Home's small "Your first week" card after the welcome: three steps that match the answer, each ticked once opened.
 * It goes away when all three are done or it is dismissed; nothing for someone who never had the new welcome.
 */
export function FirstWeek() {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const user = useAuth().user;
    const userId = user?.id;
    const start = usePreferences(userId).start;
    const progress = start?.welcome;
    // An answer this person is not offered (a minor's stored adult answer) shows the follower's week.
    const stored = choiceFromStored(progress?.choice);
    const choice = stored && !choicesFor({ adult: isAdult(user?.dob) }).includes(stored) ? 'follow' : stored;
    if (!userId || !choice || progress?.state !== 'DONE' || progress.cardDismissed || params.has(WELCOME_PARAM)) return null;
    const steps = stepsFor(choice, start?.childAge);
    const done = new Set(progress.week ?? []);
    const count = steps.filter(step => done.has(step.id)).length;
    if (count === steps.length) return null;
    const record = (change: (current: WelcomeProgress | null | undefined) => WelcomeProgress) =>
        void saveStart(userId, current => ({ welcome: change(current.welcome) })).catch(() => undefined);
    return <section className="gk gk-week" aria-labelledby="gk-week-title">
        <header className="gk-week__head">
            <h2 id="gk-week-title">{copy('Your first week', 'თქვენი პირველი კვირა')}</h2>
            <span className="gk-week__count">{copy(`${count} of ${steps.length}`, `${count} / ${steps.length}`)}</span>
            <Button variant="ghost" size="sm" iconOnly aria-label={copy('Dismiss', 'დამალვა')} onClick={() => record(current => ({ ...current, state: 'DONE', cardDismissed: true }))}><X aria-hidden="true" /></Button>
        </header>
        <ol className="gk-week__rows">{steps.map(step => {
            const ticked = done.has(step.id);
            return <li key={step.id}>
                <Link className="gk-week__row" data-done={ticked || undefined} to={step.to} onClick={() => record(current => weekDone(current, step.id))}>
                    <span className="gk-week__icon">{ticked ? <Check aria-hidden="true" /> : <step.icon aria-hidden="true" />}</span>
                    <span className="gk-week__label">{copy(step.en, step.ka)}{ticked && <span className="gk-week__sr">{copy(' (done)', ' (შესრულებულია)')}</span>}</span>
                    <ChevronRight aria-hidden="true" />
                </Link>
            </li>;
        })}</ol>
    </section>;
}
