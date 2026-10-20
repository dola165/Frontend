import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { readPreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import { useRoleProfiles } from '../profiles/account/useRoleProfiles';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveStart } from './startApi';
import { AboutStep } from './steps/AboutStep';
import { ClubsStep } from './steps/ClubsStep';
import { ProfileStep } from './steps/ProfileStep';
import { RolesStep } from './steps/RolesStep';
import { useSetupProfile, rolesToKeep } from './useSetupProfile';
import { useWelcomeFacts } from './useWelcomeFacts';
import { closed, done, opened, skipped, STEPS, storedStep, WELCOME_PARAM, type Step } from './welcomeSteps';
import './welcome.css';

/**
 * "Set up your profile" over Home, four steps: what you do in football, about you, clubs near you, and the finished
 * profile with what to do next. Everything is optional: each step can be skipped, and "Skip setup" (or Escape, or the
 * close action) ends it, the rest coming back once as a card on Home. Only "What's next" leaves it.
 */
export function WelcomeDialog({ step }: { step: Step }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const userId = useAuth().user?.id ?? 0;
    const roles = useRoleProfiles();
    const facts = useWelcomeFacts();
    const setup = useSetupProfile(userId);
    const submit = useRef<(() => Promise<boolean>) | null>(null);
    const register = useCallback((save: (() => Promise<boolean>) | null) => { submit.current = save; }, []);
    const [busy, setBusy] = useState(false);
    const index = STEPS.indexOf(step);
    const following = STEPS[index + 1] ?? null;
    const earlier = STEPS[index - 1] ?? null;

    const record = (change: (current: WelcomeProgress | null) => WelcomeProgress) =>
        void saveStart(userId, current => ({ welcome: change(current.welcome ?? null) })).catch(() => undefined);
    // The setup is up at this step: a first run starts, an open one remembers where it is; one reopened later keeps its state.
    useEffect(() => {
        const current = readPreferences(userId).start?.welcome;
        if (!current || (current.state === 'OPEN' && current.at !== storedStep(step)))
            void saveStart(userId, start => ({ welcome: opened(start.welcome, step) })).catch(() => undefined);
    }, [step, userId]);

    // The obvious answer for a young person is that they play: chosen for them, still theirs to change.
    const preselected = useRef(false);
    const { state: roleState, profiles, dirty, toggle } = roles;
    useEffect(() => {
        if (preselected.current || roleState !== 'ready' || !facts.minor || dirty) return;
        preselected.current = true;
        if (profiles.length === 1 && profiles[0].role === 'FAN') toggle('PLAYER');
    }, [roleState, facts.minor, dirty, profiles, toggle]);

    // The finished profile counts the clubs followed so far.
    const { countFollowed } = setup;
    useEffect(() => { if (step === 'profile') countFollowed(); }, [step, countFollowed]);

    const address = (to: Step | null) => {
        const search = new URLSearchParams(params);
        if (to) search.set(WELCOME_PARAM, to); else search.delete(WELCOME_PARAM);
        const query = search.toString();
        return `/home${query ? `?${query}` : ''}`;
    };
    const go = (to: Step | null) => (to ? navigate(address(to)) : navigate(address(null), { replace: true }));
    const skipSetup = () => { record(value => closed(value, step)); go(null); };
    const finish = () => { record(value => closed(done(value, 'profile'), null)); go(null); };
    const skipStep = () => { record(value => skipped(value, step)); go(following); };
    const leave = (to: string) => { record(value => closed(done(value, step), null)); navigate(to, { replace: true }); };
    // What the person does in football, shown on their profile. Nothing chosen and nothing to show: nothing to save.
    const saveRoles = async () => {
        if (roles.state !== 'ready' || !roles.profiles.length) return true;
        const kept = rolesToKeep(roles.profiles);
        const same = kept.every((item, position) => item.published === roles.profiles[position].published && item.primary === roles.profiles[position].primary);
        if (!roles.dirty && same) return true;
        return (await roles.save(kept)) !== null;
    };
    const next = async () => {
        if (busy) return;
        setBusy(true);
        const saved = step === 'roles' ? await saveRoles() : submit.current ? await submit.current() : true;
        setBusy(false);
        if (!saved) return;
        record(value => done(value, step));
        go(following);
    };

    const titles: Record<Step, [string, string]> = {
        roles: [copy('What do you do in football?', 'რას აკეთებთ ფეხბურთში?'), copy('Choose all that fit. This shapes your profile; it never gives access to anything.', 'აირჩიეთ ყველა, რაც გეხებათ. ეს თქვენს პროფილს აყალიბებს და არაფერზე წვდომას არ იძლევა.')],
        about: [copy('About you', 'თქვენ შესახებ'), copy('What people see on your profile.', 'რას ხედავენ სხვები თქვენს პროფილზე.')],
        clubs: [copy('Clubs near you', 'ახლომდებარე კლუბები'), copy('Follow clubs to see their news on Home.', 'გამოიწერეთ კლუბები, რომ მათი სიახლეები მთავარ გვერდზე ნახოთ.')],
        profile: [copy('Your profile', 'თქვენი პროფილი'), copy('This is how others see you. Change anything.', 'ასე გხედავენ სხვები. შეცვალეთ ნებისმიერი რამ.')],
    };
    const [title, hint] = titles[step];
    const body = {
        roles: <RolesStep roles={roles} adult={facts.adult} />,
        about: <AboutStep setup={setup} roles={roles} facts={facts} register={register} />,
        clubs: <ClubsStep facts={facts} />,
        profile: <ProfileStep setup={setup} roles={roles} facts={facts} leave={leave} goTo={go} />,
    }[step];
    const position = index + 1;

    return <Dialog open size="lg" className="gk-setup-dialog" title={title} description={hint} onClose={skipSetup}
        eyebrow={`${copy('Set up your profile', 'პროფილის მომზადება')} · ${copy(`Step ${position} of ${STEPS.length}`, `ნაბიჯი ${position} / ${STEPS.length}`)}`}
        closeText={copy('Skip setup', 'მომზადების გამოტოვება')}
        progress={<div className="gk-setup__bar" role="progressbar" aria-label={copy('Setup progress', 'მომზადების პროგრესი')} aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={position}>
            <span style={{ width: `${(position / STEPS.length) * 100}%` }} />
        </div>}
        footer={<>
            {earlier && <Button variant="ghost" className="gk-setup__back" disabled={busy} onClick={() => go(earlier)}>{copy('Back', 'უკან')}</Button>}
            {step !== 'profile' && <Button variant="ghost" disabled={busy || roles.saving} onClick={skipStep}>{copy('Skip this step', 'ნაბიჯის გამოტოვება')}</Button>}
            {step === 'profile'
                ? <Button variant="primary" onClick={finish}>{copy('Finish', 'დასრულება')}</Button>
                : <Button variant="primary" disabled={busy || roles.state === 'loading'} onClick={() => void next()}>
                    {busy ? <><Loader2 className="gk-setup__spin" aria-hidden="true" />{copy('Saving…', 'ინახება…')}</> : copy('Next', 'შემდეგი')}
                </Button>}
        </>}>
        <div className="gk-setup" data-step={step}>{body}</div>
    </Dialog>;
}
