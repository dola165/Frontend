import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, LocateFixed, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BrandMark } from '../../components/layout/BrandMark';
import { Button, GkRoot } from '../../design/primitives';
import { Crest } from '../world/Crest';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { clearAuthFlow, getAuthFlow } from '../../utils/authRedirect';
import { applyActivity } from './applyActivity';
import { fetchClubsNear, fetchFeedPreferences, followClub, saveFeedPreferences, unfollowClub, type Activity, type Interest, type NearbyClub } from './startApi';
import { ACTIVITIES, DEFAULT_INTERESTS, INTERESTS } from './startChoices';
import { DEFAULT_TOWN, TOWNS, locateTown, townByName, type Town } from './towns';
import './start.css';
import '../pages/pages.css';

type Step = 'town' | 'see' | 'clubs' | 'do';
const STEPS: Step[] = ['town', 'see', 'clubs'];
const stepFrom = (value: string | null): Step => (value === 'see' || value === 'clubs' || value === 'do' ? value : 'town');
const NEAREST_TICKED = 3;

/**
 * A new person's first run: three skippable screens with the likely answer already chosen (where they are, what they
 * want to see, a few clubs to follow), then one optional question (what they do in football) that only sets what they
 * see first. Everything here is a preference; access to a club, a squad or a child is confirmed by someone else.
 */
export function StartPage() {
    const { user, sessionId } = useAuth();
    return <StartRun key={`${user?.id}:${sessionId}`} />;
}

function StartRun() {
    const { t } = useTranslation();
    const copy = useJourneyCopy();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const step = stepFrom(params.get('step'));
    const flow = useMemo(() => getAuthFlow(), []);
    const [town, setTown] = useState<Town>(() => townByName(flow.town) ?? DEFAULT_TOWN);
    const [topics, setTopics] = useState<Set<Interest>>(() => new Set(DEFAULT_INTERESTS));
    const [activity, setActivity] = useState<Activity | null>(null);
    const [clubs, setClubs] = useState<NearbyClub[] | null>(null);
    const [ticked, setTicked] = useState<Set<number>>(new Set());
    const [locating, setLocating] = useState<'idle' | 'locating' | 'failed'>('idle');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const loaded = useRef(false);

    // Saved preferences win over the defaults; the town given at registration wins over both.
    useEffect(() => {
        const controller = new AbortController();
        fetchFeedPreferences(controller.signal).then(saved => {
            if (controller.signal.aborted) return;
            loaded.current = true;
            if (!flow.town && saved.town) setTown(townByName(saved.town.name) ?? saved.town);
            if (saved.topics?.length) setTopics(new Set(saved.topics));
            if (saved.activity) setActivity(saved.activity);
        }).catch(() => { /* an older server has no preferences; the defaults stand */ });
        return () => controller.abort();
    }, [flow.town]);

    // The nearest clubs, with the obvious ones already ticked, as soon as the town is known.
    useEffect(() => {
        if (step !== 'clubs') return;
        const controller = new AbortController();
        setClubs(null);
        fetchClubsNear(town, 6, controller.signal).then(found => {
            if (controller.signal.aborted) return;
            setClubs(found);
            setTicked(new Set(found.filter((club, index) => club.isFollowedByMe || index < NEAREST_TICKED).map(club => club.id)));
        }).catch(() => { if (!controller.signal.aborted) setClubs([]); });
        return () => controller.abort();
    }, [step, town]);

    const go = useCallback((next: Step | null, then?: string) => {
        setNote('');
        if (next === null) {
            clearAuthFlow();
            navigate(then ?? flow.nextPath ?? '/home', { replace: true });
            return;
        }
        setParams({ step: next }, { replace: next === 'town' });
    }, [flow.nextPath, navigate, setParams]);

    const after = (current: Step): Step | null => (current === 'town' ? 'see' : current === 'see' ? 'clubs' : current === 'clubs' ? (flow.newAccount || params.get('step') === 'do' ? 'do' : null) : null);

    /** Saves what this screen chose (best effort: the start is never blocked by a save) and moves on. */
    const saveAndGo = async (changes: () => Promise<unknown>, next: Step | null, then?: string) => {
        setBusy(true);
        try { await changes(); go(next, then); }
        catch { setNote(t('start.failed')); setBusy(false); go(next, then); }
        finally { setBusy(false); }
    };

    const findMyTown = async () => {
        setLocating('locating');
        const found = await locateTown();
        if (found) { setTown(found); setLocating('idle'); } else setLocating('failed');
    };

    // Skipped: the activity stays empty, and the links someone confirms later set it (useAutomaticActivity).
    // `then`: a coach who runs a club goes on to start it (the start sheet over Home).
    const finish = (choice: Activity | null, then?: string) => saveAndGo(() => (choice && user ? applyActivity(user.id, choice, copy) : saveFeedPreferences({ activity: null })), null, then);

    const stepIndex = STEPS.indexOf(step);
    const titles: Record<Step, string> = { town: t('start.town.title'), see: t('start.see.title'), clubs: t('start.clubs.title'), do: t('start.do.title') };
    const hints: Record<Step, string> = { town: t('start.town.hint'), see: t('start.see.hint'), clubs: t('start.clubs.hint', { town: town.name }), do: t('start.do.hint') };

    return (
        <GkRoot className="gk-start" data-step={step}>
            <header className="gk-start__bar">
                <span className="gk-start__brand" aria-hidden="true"><BrandMark className="gk-start__mark" /></span>
                {stepIndex >= 0 ? (
                    <ol className="gk-start__dots" aria-label={t('start.stepOf', { current: stepIndex + 1, total: STEPS.length })}>
                        {STEPS.map((item, index) => <li key={item} className="gk-start__dot" data-on={index <= stepIndex || undefined} aria-current={item === step ? 'step' : undefined} />)}
                    </ol>
                ) : <span />}
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => go(after(step))}>{t('start.skip')}</Button>
            </header>

            <main className="gk-start__body">
                <h1 className="gk-start__title">{titles[step]}</h1>
                <p className="gk-start__hint">{hints[step]}</p>

                <div className="gk-start__content">
                    {step === 'town' && (
                        <div className="gk-start-town">
                            <div className="gk-start-town__place">
                                <span className="gk-start-town__pin" aria-hidden="true"><MapPin /></span>
                                <strong>{town.name}</strong>
                            </div>
                            <div className="gk-start-town__choices">
                                <button type="button" className="gk-chip" disabled={locating === 'locating'} onClick={() => void findMyTown()}>
                                    {locating === 'locating' ? <Loader2 className="gk-start__spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
                                    {locating === 'locating' ? t('start.town.locating') : t('start.town.useLocation')}
                                </button>
                                <label className="gk-start-town__select">
                                    <span className="gk-field__label">{t('start.town.label')}</span>
                                    <select className="gk-input" value={town.name} onChange={event => setTown(townByName(event.target.value) ?? DEFAULT_TOWN)}>
                                        {TOWNS.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
                                    </select>
                                </label>
                            </div>
                            {locating === 'failed' && <p role="status" className="gk-start__note">{t('start.town.locationUnavailable')}</p>}
                        </div>
                    )}

                    {step === 'see' && (
                        <div className="gk-start-tiles" role="group" aria-label={t('start.see.title')}>
                            {INTERESTS.map(tile => {
                                const on = topics.has(tile.id);
                                return (
                                    <button key={tile.id} type="button" className="gk-start-tile" aria-pressed={on} style={{ '--tile': tile.color, backgroundImage: `url(${tile.photo})`, backgroundPosition: tile.position } as React.CSSProperties}
                                        onClick={() => setTopics(current => { const next = new Set(current); if (next.has(tile.id)) next.delete(tile.id); else next.add(tile.id); return next; })}>
                                        <span className="gk-start-tile__icon"><tile.icon aria-hidden="true" /></span>
                                        <span className="gk-start-tile__label">{t(`start.see.${tile.id}`)}</span>
                                        <span className="gk-start-tile__tick" aria-hidden="true"><Check /></span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {step === 'clubs' && (
                        clubs === null ? <p role="status" className="gk-start__note"><Loader2 className="gk-start__spin" aria-hidden="true" /> {t('start.clubs.loading')}</p>
                        : clubs.length === 0 ? <p className="gk-start__note">{t('start.clubs.none', { town: town.name })}</p>
                        : <ul className="gk-start-clubs">
                            {clubs.map(club => {
                                const on = ticked.has(club.id);
                                return (
                                    <li key={club.id} className="gk-start-club">
                                        <Crest src={club.logoUrl} name={club.name} size={44} />
                                        <span className="gk-start-club__text">
                                            <strong>{club.name}</strong>
                                            <small>{[club.cityName, t('start.clubs.km', { km: club.km })].filter(Boolean).join(' · ')}</small>
                                        </span>
                                        <button type="button" className="gk-btn gk-btn--sm gk-start-club__follow" data-on={on || undefined} aria-pressed={on}
                                            onClick={() => setTicked(current => { const next = new Set(current); if (next.has(club.id)) next.delete(club.id); else next.add(club.id); return next; })}>
                                            {on && <Check aria-hidden="true" />}{on ? t('start.clubs.following') : t('start.clubs.follow')}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {step === 'do' && (
                        <>
                            <div className="gk-start-tiles gk-start-tiles--two" role="group" aria-label={t('start.do.title')}>
                                {ACTIVITIES.map(choice => (
                                    <button key={choice.id} type="button" className="gk-start-tile gk-start-tile--plain" aria-pressed={activity === choice.id} style={{ '--tile': choice.color } as React.CSSProperties}
                                        onClick={() => setActivity(current => (current === choice.id ? null : choice.id))}>
                                        <span className="gk-start-tile__icon"><choice.icon aria-hidden="true" /></span>
                                        <span className="gk-start-tile__label">{t(`start.do.${choice.id}`)}</span>
                                        <span className="gk-start-tile__tick" aria-hidden="true"><Check /></span>
                                    </button>
                                ))}
                            </div>
                            <p className="gk-start__note">{t('start.do.later')}</p>
                            {activity === 'COACH' && <p className="gk-start__note gk-start__offer">{t('start.do.club')} <button type="button" className="gk-start__link" disabled={busy} onClick={() => void finish('COACH', '/home?create=club&from=start')}>{t('start.do.startClub')}</button></p>}
                        </>
                    )}
                </div>

                {note && <p role="status" className="gk-start__note gk-start__note--warn">{note}</p>}
                <footer className="gk-start__foot">
                    {step !== 'town' && <Button variant="ghost" disabled={busy} onClick={() => go(step === 'see' ? 'town' : step === 'clubs' ? 'see' : 'clubs')}>{t('start.back')}</Button>}
                    {step === 'town' && <Button variant="primary" disabled={busy} onClick={() => void saveAndGo(() => saveFeedPreferences({ town }), 'see')}>{t('start.next')}</Button>}
                    {step === 'see' && <Button variant="primary" disabled={busy} onClick={() => void saveAndGo(() => saveFeedPreferences({ topics: [...topics] }), 'clubs')}>{t('start.next')}</Button>}
                    {step === 'clubs' && <Button variant="primary" disabled={busy || clubs === null} onClick={() => void saveAndGo(async () => {
                        await Promise.all((clubs ?? []).map(club => (ticked.has(club.id) && !club.isFollowedByMe ? followClub(club.id) : !ticked.has(club.id) && club.isFollowedByMe ? unfollowClub(club.id) : Promise.resolve())));
                    }, after('clubs'))}>{after('clubs') ? t('start.next') : t('start.done')}</Button>}
                    {step === 'do' && <Button variant="primary" disabled={busy} onClick={() => void finish(activity)}>{busy ? <><Loader2 className="gk-start__spin" aria-hidden="true" /> {t('start.finishing')}</> : t('start.done')}</Button>}
                </footer>
            </main>
        </GkRoot>
    );
}
