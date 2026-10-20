import { ChevronRight, Heart, MapPin, Shield, Shirt, Trophy, Users, X, type LucideIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../design/primitives';
import { usePreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import { createHref } from '../pages/create/entry';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveStart } from './startApi';
import { cardSteps, done, WELCOME_PARAM, type Step } from './welcomeSteps';
import './welcome.css';

const ROWS: Record<Exclude<Step, 'business'>, { icon: LucideIcon; to: string; en: string; ka: string }> = {
    roles: { icon: Shirt, to: '/account/roles#roles', en: 'Say what you do in football', ka: 'მიუთითეთ, რას აკეთებთ ფეხბურთში' },
    club: { icon: Shield, to: '/world/clubs', en: 'Find your club', ka: 'იპოვეთ თქვენი კლუბი' },
    child: { icon: Users, to: '/parent?tab=children', en: 'Add your child', ka: 'დაამატეთ შვილი' },
    tournament: { icon: Trophy, to: '/tournaments/setup', en: 'Create a tournament', ka: 'შექმენით ტურნირი' },
    venue: { icon: MapPin, to: createHref({ pathname: '/home', search: '' }, 'PAGE', 'home'), en: 'Add your venue', ka: 'დაამატეთ თქვენი მოედანი' },
    follow: { icon: Heart, to: '/world/clubs', en: 'Follow clubs near you', ka: 'მიჰყევით ახლომდებარე კლუბებს' },
};

/**
 * Home's "Finish setting up": the welcome steps someone skipped, each one tap into its flow, shown until dismissed.
 * Never the popup again, and nothing for someone who finished it or never had it.
 */
export function FinishSetup() {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const userId = useAuth().user?.id;
    const progress = usePreferences(userId).start?.welcome;
    const steps = cardSteps(progress).filter((step): step is keyof typeof ROWS => step !== 'business');
    if (!userId || !steps.length || params.has(WELCOME_PARAM)) return null;
    const save = (change: (value: WelcomeProgress | null | undefined) => WelcomeProgress) =>
        void saveStart(userId, current => ({ welcome: change(current.welcome) })).catch(() => undefined);
    return <section className="gk gk-welcome-card" aria-labelledby="gk-welcome-card-title">
        <header className="gk-welcome-card__head">
            <h2 id="gk-welcome-card-title">{copy('Finish setting up', 'დაასრულეთ დაყენება')}</h2>
            <Button variant="ghost" size="sm" iconOnly aria-label={copy('Dismiss', 'დამალვა')} onClick={() => save(value => ({ ...value, state: value?.state ?? 'DONE', cardDismissed: true }))}><X aria-hidden="true" /></Button>
        </header>
        <ul className="gk-welcome-card__rows">{steps.map(step => {
            const row = ROWS[step];
            return <li key={step}>
                <Link className="gk-welcome-card__row" to={row.to} onClick={() => save(value => done(value, step))}>
                    <span className="gk-welcome-card__icon"><row.icon aria-hidden="true" /></span>
                    <span className="gk-welcome-card__label">{copy(row.en, row.ka)}</span>
                    <ChevronRight aria-hidden="true" />
                </Link>
            </li>;
        })}</ul>
    </section>;
}
