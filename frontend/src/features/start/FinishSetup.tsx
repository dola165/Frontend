import { ChevronRight, Heart, Shirt, UserRound, X, type LucideIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../design/primitives';
import { usePreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveStart } from './startApi';
import { cardSteps, WELCOME_PARAM, type Step } from './welcomeSteps';
import './welcome.css';

const ROWS: Record<Exclude<Step, 'profile' | 'page'>, { icon: LucideIcon; en: string; ka: string }> = {
    roles: { icon: Shirt, en: 'Say what you do in football', ka: 'მიუთითეთ, რას აკეთებთ ფეხბურთში' },
    about: { icon: UserRound, en: 'Add a photo and a few words about you', ka: 'დაამატეთ ფოტო და რამდენიმე სიტყვა თქვენ შესახებ' },
    clubs: { icon: Heart, en: 'Follow clubs near you', ka: 'მიჰყევით ახლომდებარე კლუბებს' },
};

/**
 * Home's "Finish setting up": the setup steps someone skipped, each opening that step of the setup again, shown until
 * dismissed. Nothing for someone who finished it or never had it.
 */
export function FinishSetup() {
    const copy = useJourneyCopy();
    const [params] = useSearchParams();
    const userId = useAuth().user?.id;
    const progress = usePreferences(userId).start?.welcome;
    const steps = cardSteps(progress).filter((step): step is keyof typeof ROWS => step in ROWS);
    if (!userId || !steps.length || params.has(WELCOME_PARAM)) return null;
    const dismiss = () => void saveStart(userId, current => ({ welcome: { ...current.welcome, state: current.welcome?.state ?? 'DONE', cardDismissed: true } as WelcomeProgress })).catch(() => undefined);
    return <section className="gk gk-welcome-card" aria-labelledby="gk-welcome-card-title">
        <header className="gk-welcome-card__head">
            <h2 id="gk-welcome-card-title">{copy('Finish setting up', 'დაასრულეთ პროფილის მომზადება')}</h2>
            <Button variant="ghost" size="sm" iconOnly aria-label={copy('Dismiss', 'დამალვა')} onClick={dismiss}><X aria-hidden="true" /></Button>
        </header>
        <ul className="gk-welcome-card__rows">{steps.map(step => {
            const row = ROWS[step];
            return <li key={step}>
                <Link className="gk-welcome-card__row" to={`/home?${WELCOME_PARAM}=${step}`}>
                    <span className="gk-welcome-card__icon"><row.icon aria-hidden="true" /></span>
                    <span className="gk-welcome-card__label">{copy(row.en, row.ka)}</span>
                    <ChevronRight aria-hidden="true" />
                </Link>
            </li>;
        })}</ul>
    </section>;
}
