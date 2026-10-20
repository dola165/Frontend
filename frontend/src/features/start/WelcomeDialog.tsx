import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { readPreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import type { RoleProfile } from '../roles/domain';
import { useRoleProfiles } from '../profiles/account/useRoleProfiles';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveStart } from './startApi';
import { BusinessStep } from './steps/BusinessStep';
import { ClubStep } from './steps/ClubStep';
import { FollowStep } from './steps/FollowStep';
import { ChildStep, MoveStep } from './steps/MoveSteps';
import { RolesStep } from './steps/RolesStep';
import { closed, done, opened, skipped, STEPS, storedStep, WELCOME_PARAM, welcomeSteps, type Step } from './welcomeSteps';
import './welcome.css';

/** What a step can do besides showing itself. */
export interface StepProps {
    /** Done here: on to the next step. */
    next: () => void;
    /** Done somewhere else: the popup closes, and the steps not reached come back once on Home. */
    leave: (to: string) => void;
}

/** Someone who picks real roles over the account's starting Fan role leads with the first of them. */
const withMainRole = (profiles: RoleProfile[]) => {
    const lead = profiles.find(profile => profile.role !== 'FAN');
    return profiles.some(profile => profile.primary && profile.role === 'FAN') && lead
        ? profiles.map(profile => ({ ...profile, primary: profile === lead }))
        : profiles;
};

/** The welcome popup over Home, one step at a time; every step can be skipped and Back returns to the one before. */
export function WelcomeDialog({ step }: { step: Step }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const userId = useAuth().user?.id ?? 0;
    const roles = useRoleProfiles();
    const steps = welcomeSteps(roles.profiles.map(profile => profile.role));
    const order = (item: Step) => STEPS.indexOf(item);
    const following = steps.find(item => order(item) > order(step)) ?? null;
    const earlier = steps.filter(item => order(item) < order(step)).at(-1) ?? null;

    const record = (change: (current: WelcomeProgress | null) => WelcomeProgress) =>
        void saveStart(userId, current => ({ welcome: change(current.welcome ?? null) })).catch(() => undefined);
    // The popup is up at this step: a first run starts, an open one remembers where it is; one reopened later keeps its state.
    useEffect(() => {
        const current = readPreferences(userId).start?.welcome;
        if (!current || (current.state === 'OPEN' && current.at !== storedStep(step)))
            void saveStart(userId, start => ({ welcome: opened(start.welcome, step) })).catch(() => undefined);
    }, [step, userId]);

    const address = (next: Step | null) => {
        const search = new URLSearchParams(params);
        if (next) search.set(WELCOME_PARAM, next); else search.delete(WELCOME_PARAM);
        const query = search.toString();
        return `/home${query ? `?${query}` : ''}`;
    };
    const go = (next: Step | null) => (next ? navigate(address(next)) : navigate(address(null), { replace: true }));
    const finish = (from: Step | null) => { record(value => closed(value, steps, from)); go(null); };
    const next = () => { record(value => done(value, step)); if (following) go(following); else finish(null); };
    const skip = () => { record(value => skipped(value, step)); if (following) go(following); else finish(null); };
    const leave = (to: string) => { record(value => closed(done(value, step), steps, following)); navigate(to, { replace: true }); };
    // What the person does in football decides the steps that follow. Nothing chosen: nothing to save.
    const saveRoles = async () => {
        if (!roles.dirty || !roles.profiles.length) { next(); return; }
        const stored = await roles.save(withMainRole(roles.profiles));
        if (!stored) return;
        record(value => done(value, step));
        go(welcomeSteps(stored.map(profile => profile.role))[1] ?? null);
    };

    const props: StepProps = { next, leave };
    const body = {
        roles: <RolesStep roles={roles} />,
        club: <ClubStep {...props} />,
        child: <ChildStep {...props} />,
        tournament: <MoveStep {...props} kind="tournament" />,
        venue: <MoveStep {...props} kind="venue" />,
        follow: <FollowStep />,
        business: <BusinessStep {...props} />,
    }[step];
    const titles: Record<Step, [string, string?]> = {
        roles: [copy('What do you do in football?', 'რას აკეთებთ ფეხბურთში?'), copy('Pick all that fit.', 'აირჩიეთ ყველა, რაც გეხებათ.')],
        club: [copy('Find your club', 'იპოვეთ თქვენი კლუბი'), copy('It may already be here.', 'შესაძლოა, უკვე აქ არის.')],
        child: [copy('Add your child', 'დაამატეთ შვილი')],
        tournament: [copy('Your tournament', 'თქვენი ტურნირი')],
        venue: [copy('Your venue', 'თქვენი მოედანი')],
        follow: [copy('Clubs near you', 'კლუბები თქვენთან ახლოს'), copy('Their news comes to your Home.', 'მათი სიახლეები მთავარზე გამოჩნდება.')],
        business: [copy('Here as a business?', 'ბიზნესი ხართ?'), copy('Optional. Pick one to start its page.', 'არასავალდებულო. აირჩიეთ და შექმენით გვერდი.')],
    };
    const [title, hint] = titles[step];
    const position = Math.max(0, steps.indexOf(step));
    const loading = roles.state === 'loading';
    const primary = step === 'roles'
        ? <Button variant="primary" disabled={loading || roles.saving} onClick={() => void saveRoles()}>{roles.saving ? <><Loader2 className="gk-welcome__spin" aria-hidden="true" />{copy('Saving…', 'ინახება…')}</> : copy('Next', 'შემდეგი')}</Button>
        : step === 'follow' ? <Button variant="primary" onClick={next}>{following ? copy('Next', 'შემდეგი') : copy('Done', 'დასრულება')}</Button>
        : step === 'business' ? <Button variant="primary" onClick={() => finish(null)}>{copy('Done', 'დასრულება')}</Button>
        : null;

    return <Dialog open size="lg" title={title} description={hint} onClose={() => finish(step)} closeLabel={copy('Close', 'დახურვა')}
        footer={<>
            <ol className="gk-welcome__dots" aria-label={copy(`Step ${position + 1} of ${steps.length}`, `ნაბიჯი ${position + 1} / ${steps.length}`)}>
                {steps.map((item, index) => <li key={item} className="gk-welcome__dot" data-on={index <= position || undefined} aria-current={item === step ? 'step' : undefined} />)}
            </ol>
            {earlier && <Button variant="ghost" onClick={() => go(earlier)}>{copy('Back', 'უკან')}</Button>}
            {step !== 'business' && <Button variant="ghost" disabled={roles.saving} onClick={skip}>{copy('Skip', 'გამოტოვება')}</Button>}
            {primary}
        </>}>
        <div className="gk-welcome" data-step={step}>
            {body}
        </div>
    </Dialog>;
}
