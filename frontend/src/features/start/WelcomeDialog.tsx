import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { createHref } from '../pages/create/entry';
import type { PageKind } from '../pages/model/kinds';
import { readPreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { useChoiceName } from './setupWords';
import { saveStart } from './startApi';
import { AboutStep } from './steps/AboutStep';
import { ClubsStep } from './steps/ClubsStep';
import { PageStep } from './steps/PageStep';
import { ProfileStep } from './steps/ProfileStep';
import { RolesStep } from './steps/RolesStep';
import { draftOf, mainRoleOf, useSetupProfile, type SetupDraft } from './useSetupProfile';
import { useWelcomeFacts } from './useWelcomeFacts';
import { closed, done, opened, skipped, STEPS, storedStep, WELCOME_PARAM, type Step } from './welcomeSteps';
import './welcome.css';

const HOME = { pathname: '/home', search: '' };

/**
 * "Set up your profile" over Home, five steps: what you do in football, about you, clubs, your profile (beside its
 * preview), and creating a page. Everything is optional: each step can be skipped, and "Skip setup" (or Escape, or the
 * close action) ends it, the rest coming back once as a card on Home. Only "Create page" leaves it.
 */
export function WelcomeDialog({ step }: { step: Step }) {
    const copy = useJourneyCopy();
    const choiceName = useChoiceName();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const userId = useAuth().user?.id ?? 0;
    const facts = useWelcomeFacts();
    const setup = useSetupProfile(userId);
    const [edited, setEdited] = useState<SetupDraft | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [other, setOther] = useState(false);
    // Step 5 first asks whether to create a page; the kinds come after "Create a page".
    const [pageView, setPageView] = useState<'ask' | 'choose'>('ask');
    const index = STEPS.indexOf(step);
    const following = STEPS[index + 1] ?? null;
    const earlier = STEPS[index - 1] ?? null;

    // What the person changed, over their profile as loaded: one draft for every step.
    const loaded = setup.loaded;
    const draft = edited ?? (loaded ? draftOf(loaded.profile, loaded.roles, setup.business, loaded.professions?.items ?? []) : null);
    const main = draft && loaded ? mainRoleOf(draft.roles, loaded.roles) : null;
    const town = facts.place?.source === 'SAVED' ? facts.place.name : null;
    const suggestion = [main ? choiceName(main) : null, town].filter(Boolean).join(' · ');

    const record = (change: (current: WelcomeProgress | null) => WelcomeProgress) =>
        void saveStart(userId, current => ({ welcome: change(current.welcome ?? null) })).catch(() => undefined);
    // The setup is up at this step: a first run starts, an open one remembers where it is; one reopened later keeps its state.
    useEffect(() => {
        const current = readPreferences(userId).start?.welcome;
        if (!current || (current.state === 'OPEN' && current.at !== storedStep(step)))
            void saveStart(userId, start => ({ welcome: opened(start.welcome, step) })).catch(() => undefined);
    }, [step, userId]);

    const address = (to: Step | null) => {
        const search = new URLSearchParams(params);
        if (to) search.set(WELCOME_PARAM, to); else search.delete(WELCOME_PARAM);
        const query = search.toString();
        return `/home${query ? `?${query}` : ''}`;
    };
    const go = (to: Step | null) => { setError(''); setOther(false); setPageView('ask'); if (to) navigate(address(to)); else navigate(address(null), { replace: true }); };
    const skipSetup = () => { record(value => closed(value, step)); go(null); };
    const finish = () => { record(value => closed(done(value, 'page'), null)); go(null); };
    const skipStep = () => { record(value => skipped(value, step)); go(following); };
    const createPage = (kind: PageKind) => {
        record(value => closed(done(value, 'page'), null));
        navigate(createHref(HOME, kind, 'start'), { replace: true });
    };
    // Each step keeps what it changed before moving on: the draft for roles, about and the profile (clubs follow at once).
    const next = async (asOther = false) => {
        if (busy || !draft) return;
        if (step === 'roles' && !asOther && !draft.roles.length && !draft.business) { setOther(true); return; }
        setOther(false);
        setBusy(true);
        const failure = copy('That couldn’t be saved. Your changes are still here.', 'ვერ შეინახა. ცვლილებები აქვეა.');
        let ok = true;
        if (step !== 'clubs') {
            // The suggested headline is kept once the person has seen it (About you onwards).
            const problem = await setup.save(draft, step === 'roles' ? '' : suggestion, failure);
            setError(problem);
            ok = !problem;
            if (ok) setEdited({ ...draft, headline: step === 'roles' ? draft.headline : draft.headline ?? (suggestion || null), history: [] });
        }
        setBusy(false);
        if (!ok) return;
        record(value => done(value, step));
        go(following);
    };

    const titles: Record<Step, [string, string]> = {
        roles: [copy('What do you do in football?', 'რას აკეთებთ ფეხბურთში?'), copy('Choose all that fit. This shapes your profile; it never gives access to anything.', 'აირჩიეთ ყველა, რაც გეხებათ. ეს თქვენს პროფილს აყალიბებს და არაფერზე წვდომას არ იძლევა.')],
        about: [copy('About you', 'თქვენ შესახებ'), copy('What people see on your profile.', 'რას ხედავენ სხვები თქვენს პროფილზე.')],
        clubs: [copy('Clubs', 'კლუბები'), copy('Follow clubs to see their news on Home.', 'გამოიწერეთ კლუბები, რომ მათი სიახლეები მთავარ გვერდზე ნახოთ.')],
        profile: [copy('Your profile', 'თქვენი პროფილი'), copy('Change anything and see it as others will. Save when it looks right.', 'შეცვალეთ ნებისმიერი რამ და ნახეთ, როგორ დაინახავენ სხვები. შეინახეთ, როცა მოგეწონებათ.')],
        page: pageView === 'ask'
            ? [copy('Do you want to create a page?', 'გსურთ გვერდის შექმნა?'), copy('Your club, fan club or business gets its own home on GrassKickZ: posts, people and how to reach you.', 'თქვენს კლუბს, გულშემატკივართა კლუბს ან ბიზნესს GrassKickZ-ზე საკუთარი სახლი ექნება: პოსტები, ადამიანები და კონტაქტი.')]
            : [copy('Create a page', 'გვერდის შექმნა'), copy('Choose what it is for. You can change everything later.', 'აირჩიეთ, რისთვისაა. ყველაფრის შეცვლა მოგვიანებითაც შეიძლება.')],
    };
    const [title, hint] = titles[step];
    const change = (value: SetupDraft) => setEdited(value);
    const body = {
        roles: <RolesStep draft={draft} onChange={change} adult={facts.adult} />,
        about: <AboutStep setup={setup} draft={draft} onChange={change} facts={facts} main={main} suggestion={suggestion} />,
        clubs: <ClubsStep facts={facts} />,
        profile: <ProfileStep setup={setup} draft={draft} onChange={change} facts={facts} main={main} suggestion={suggestion} userId={userId} />,
        page: <PageStep view={pageView} roles={draft?.roles ?? []} business={draft?.business ?? false} onPick={createPage} />,
    }[step];
    const position = index + 1;
    const spinner = <><Loader2 className="gk-setup__spin" aria-hidden="true" />{copy('Saving…', 'ინახება…')}</>;

    return <Dialog open size="lg" className={`gk-setup-dialog${step === 'profile' ? ' gk-setup-dialog--wide' : ''}`} title={title} description={hint}
        onClose={skipSetup} onEscape={other ? () => setOther(false) : skipSetup}
        eyebrow={`${copy('Set up your profile', 'პროფილის მომზადება')} · ${copy(`Step ${position} of ${STEPS.length}`, `ნაბიჯი ${position} / ${STEPS.length}`)}`}
        closeText={copy('Skip setup', 'მომზადების გამოტოვება')}
        progress={<div className="gk-setup__bar" role="progressbar" aria-label={copy('Setup progress', 'მომზადების პროგრესი')} aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={position}>
            <span style={{ width: `${(position / STEPS.length) * 100}%` }} />
        </div>}
        footer={<>
            {other && <div className="gk-setup-other" role="dialog" aria-label={copy('Continue as Other', 'გაგრძელება როგორც „სხვა“')}>
                <p>{copy('You’ll continue as Other, an everyday member. Add roles any time.', 'გააგრძელებთ როგორც „სხვა“ — ჩვეულებრივი წევრი. როლებს ნებისმიერ დროს დაამატებთ.')}</p>
                <div className="gk-setup-other__actions">
                    <Button size="sm" variant="ghost" onClick={() => setOther(false)}>{copy('Choose a role', 'როლის არჩევა')}</Button>
                    <Button size="sm" variant="primary" autoFocus onClick={() => void next(true)}>{copy('Continue', 'გაგრძელება')}</Button>
                </div>
            </div>}
            {earlier && <Button variant="ghost" className="gk-setup__back" disabled={busy} onClick={() => (step === 'page' && pageView === 'choose' ? setPageView('ask') : go(earlier))}>{copy('Back', 'უკან')}</Button>}
            {step === 'page'
                ? <>
                    <Button variant="ghost" onClick={finish}>{copy('Not now', 'ახლა არა')}</Button>
                    {pageView === 'ask' && <Button variant="primary" onClick={() => setPageView('choose')}>{copy('Create a page', 'გვერდის შექმნა')}</Button>}
                </>
                : <>
                    <Button variant="ghost" disabled={busy} onClick={skipStep}>{copy('Skip this step', 'ნაბიჯის გამოტოვება')}</Button>
                    <Button variant="primary" disabled={busy || !draft} onClick={() => void next()}>
                        {busy ? spinner : step === 'profile' ? copy('Save profile', 'პროფილის შენახვა') : copy('Next', 'შემდეგი')}
                    </Button>
                </>}
        </>}>
        <div className="gk-setup" data-step={step}>
            {body}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Dialog>;
}
