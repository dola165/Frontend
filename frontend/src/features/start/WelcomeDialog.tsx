import { useEffect, useRef, type ReactNode } from 'react';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Dialog } from '../../design/Dialog';
import { Button } from '../../design/primitives';
import { appLanguage } from '../../utils/formatting';
import { readPreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import type { RoleProfile } from '../roles/domain';
import { useRoleProfiles } from '../profiles/account/useRoleProfiles';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveStart, type Place } from './startApi';
import { BusinessStep } from './steps/BusinessStep';
import { ClubStep } from './steps/ClubStep';
import { FollowStep } from './steps/FollowStep';
import { ChildStep, MoveStep } from './steps/MoveSteps';
import { RolesStep } from './steps/RolesStep';
import { useWelcomeFacts, type WelcomeFacts } from './useWelcomeFacts';
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

/**
 * The welcome popup over Home, most of the screen with Home showing around it, one step at a time. It asks only what
 * it cannot know: the place and the age decide which steps exist, and every step can be skipped; Back returns.
 */
export function WelcomeDialog({ step }: { step: Step }) {
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const userId = useAuth().user?.id ?? 0;
    const roles = useRoleProfiles();
    const facts = useWelcomeFacts();
    const known = { adult: facts.adult, clubsNearby: facts.clubs === null || facts.clubs.length > 0 };
    const steps = welcomeSteps(roles.profiles.map(profile => profile.role), known);
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

    // The obvious answer for a young person is that they play: chosen for them, still theirs to change.
    const preselected = useRef(false);
    const { state: roleState, profiles, dirty, toggle } = roles;
    useEffect(() => {
        if (preselected.current || roleState !== 'ready' || !facts.minor || dirty) return;
        preselected.current = true;
        if (profiles.length === 1 && profiles[0].role === 'FAN') toggle('PLAYER');
    }, [roleState, facts.minor, dirty, profiles, toggle]);

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
        go(welcomeSteps(stored.map(profile => profile.role), known)[1] ?? null);
    };
    // An address for a step this person has nothing in (no club near them, a business for a minor) moves on.
    const settled = roles.state !== 'loading' && facts.ready;
    const irrelevant = settled && step !== 'roles' && !steps.includes(step);
    const skipTo = irrelevant ? address(following) : null;
    const ends = irrelevant && !following;
    useEffect(() => {
        if (!skipTo) return;
        if (ends) void saveStart(userId, start => ({ welcome: closed(start.welcome ?? null, [], null) })).catch(() => undefined);
        navigate(skipTo, { replace: true });
    }, [skipTo, ends, navigate, userId]);

    const props: StepProps = { next, leave };
    const body = {
        roles: <RolesStep roles={roles} adult={facts.adult} />,
        club: <ClubStep {...props} facts={facts} />,
        child: <ChildStep {...props} />,
        tournament: <MoveStep {...props} kind="tournament" />,
        venue: <MoveStep {...props} kind="venue" />,
        follow: <FollowStep facts={facts} />,
        business: <BusinessStep {...props} />,
    }[step];
    const place = <PlaceLine facts={facts} />;
    const titles: Record<Step, [string, ReactNode?]> = {
        roles: [copy('What do you do in football?', 'რას აკეთებთ ფეხბურთში?'), copy('Pick all that fit.', 'აირჩიეთ ყველა, რაც გეხებათ.')],
        club: [copy('Find your club', 'იპოვეთ თქვენი კლუბი'), place],
        child: [copy('Add your child', 'დაამატეთ შვილი')],
        tournament: [copy('Your tournament', 'თქვენი ტურნირი')],
        venue: [copy('Your venue', 'თქვენი მოედანი')],
        follow: [copy('Follow clubs near you', 'მიჰყევით ახლომდებარე კლუბებს'), place],
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

    return <Dialog open size="xl" title={title} description={hint} onClose={() => finish(step)} closeLabel={copy('Close', 'დახურვა')}
        footer={<>
            <ol className="gk-welcome__dots" aria-label={copy(`Step ${position + 1} of ${steps.length}`, `ნაბიჯი ${position + 1} / ${steps.length}`)}>
                {steps.map((item, index) => <li key={item} className="gk-welcome__dot" data-on={index <= position || undefined} aria-current={item === step ? 'step' : undefined} />)}
            </ol>
            {earlier && <Button variant="ghost" onClick={() => go(earlier)}>{copy('Back', 'უკან')}</Button>}
            {step !== 'business' && <Button variant="ghost" disabled={roles.saving} onClick={skip}>{copy('Skip', 'გამოტოვება')}</Button>}
            {primary}
        </>}>
        <div className="gk-welcome" data-step={step}>
            {/* A step this person has nothing in is never shown, not even while it moves on. */}
            {step === 'roles' || steps.includes(step) ? body : null}
        </div>
    </Dialog>;
}

/** The country in the app's language ("Armenia", "სომხეთი"), else as the server names it. */
function countryOf(place: Place) {
    try {
        if (place.countryCode) return new Intl.DisplayNames([appLanguage()], { type: 'region' }).of(place.countryCode) ?? place.countryName ?? place.name;
    } catch { /* an engine without region names keeps the server's */ }
    return place.countryName ?? place.name;
}

/**
 * Where the suggestions come from, said once and never asked: the person's town, else their country. Without a town of
 * theirs it also offers the device's location, asked for only when pressed.
 */
function PlaceLine({ facts }: { facts: WelcomeFacts }) {
    const copy = useJourneyCopy();
    const place = facts.place;
    if (!place) return null;
    const country = countryOf(place);
    const where = place.source === 'CONNECTION'
        // Georgian: "სომხეთი" → "სომხეთში"; a name in Latin letters (no Georgian region names here) → "Armenia-ში".
        ? copy(`In ${country}`, /[ა-ჿ]$/.test(country) ? `${country.replace(/ი$/, '')}ში` : `${country}-ში`)
        : copy(`Near ${place.name}`, `${place.name}-თან ახლოს`);
    return <span className="gk-welcome__place">
        <MapPin aria-hidden="true" />{where}
        {place.source !== 'SAVED' && <button type="button" className="gk-chip" disabled={facts.locating === 'locating'} onClick={() => void facts.locate()}>
            {facts.locating === 'locating' ? <Loader2 className="gk-welcome__spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
            {copy('Use my location', 'ჩემი მდებარეობით')}
        </button>}
        {facts.locating === 'failed' && <span role="status">{copy('Location not available.', 'მდებარეობა მიუწვდომელია.')}</span>}
    </span>;
}
