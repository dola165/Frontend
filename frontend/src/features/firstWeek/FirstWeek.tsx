import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../design/primitives';
import { isAdult } from '../../utils/age';
import { OPENED_HERE } from '../actions/registry';
import { useAction } from '../actions/useAction';
import { usePreferences, type WelcomeProgress } from '../preferences/preferencesStore';
import { useProfileImageControls } from '../profiles/useProfileImageControls';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { saveStart } from '../start/startApi';
import { choiceFromStored, choicesFor } from '../start/welcomeSteps';
import { saveMyImage } from '../profiles/api';
import { ClubsNearYou } from './ClubsNearYou';
import { WORLD_BRAND } from '../../components/brand/worldBrand';
import { WorldMark } from '../../components/brand/WorldMark';
import { doneSteps, isUnfolded, markDone, stepsFor, withUnfolded, type WeekStep } from './steps';
import './first-week.css';

/** How much of the week is done, as a small ring. */
function WeekRing({ done, total }: { done: number; total: number }) {
    const radius = 8, length = 2 * Math.PI * radius;
    return <svg className="gk-week-ring" viewBox="0 0 20 20" aria-hidden="true">
        <circle className="gk-week-ring__track" cx="10" cy="10" r={radius} />
        <circle className="gk-week-ring__fill" cx="10" cy="10" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - done / total)} transform="rotate(-90 10 10)" />
    </svg>;
}

const ENTERED_KEY = 'gk-first-week-entered';
const enteredThisVisit = () => { try { return window.sessionStorage.getItem(ENTERED_KEY) === '1'; } catch { return false; } };
const markEntered = () => { try { window.sessionStorage.setItem(ENTERED_KEY, '1'); } catch { /* It rises in again next time. */ } };

/** Focus the page's main content (made focusable for this), so focus never falls back to nothing. */
function focusPage() {
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return;
    if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
    main.focus({ preventScroll: true });
}

/**
 * "Your first week" after the welcome, in the app frame's corner on every page: a chip with its progress ring that
 * unfolds into the three steps matching the answer. Each step opens over the page where it can (adding a child, the
 * clubs near you to follow, the photo picker), otherwise on its own page; it is ticked once done. X hides it for
 * good; folding is kept, both in the person's preferences. It goes once all three are done, and never shows for
 * someone who never had the new welcome.
 */
export function FirstWeek() {
    const copy = useJourneyCopy();
    const { user, bootstrapSession } = useAuth();
    const userId = user?.id;
    const start = usePreferences(userId).start;
    const progress = start?.welcome;
    const [clubsOpen, setClubsOpen] = useState(false);
    const titleId = useId();
    const record = (change: (current: WelcomeProgress | null | undefined) => WelcomeProgress) => {
        if (userId) void saveStart(userId, current => ({ welcome: change(current.welcome) })).catch(() => undefined);
    };
    const images = useProfileImageControls({
        enabled: Boolean(userId), scope: `user:${userId}`, imageKind: 'avatar', hasCover: false,
        onSave: async (_field, url) => { await saveMyImage('avatar', url); record(current => markDone(current, 'photo')); void bootstrapSession().catch(() => undefined); },
    });
    const addChild = useAction('add_child');
    const open = isUnfolded(progress);
    // Hiding for good asks once, in the panel: a missed tap must never lose the checklist.
    const [confirming, setConfirming] = useState(false);
    // The chip rises in once per visit, the first time it shows.
    const [entering, setEntering] = useState(() => !enteredThisVisit());
    // Folding or unfolding swaps the chip for the panel: focus follows to the one now shown.
    const chip = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null), toggled = useRef(false);
    useEffect(() => {
        if (!toggled.current) return;
        toggled.current = false;
        (open ? panel.current?.querySelector<HTMLElement>('[aria-expanded]') : chip.current)?.focus();
    }, [open]);
    useEffect(() => { if (confirming) panel.current?.querySelector<HTMLElement>('[data-keep]')?.focus(); }, [confirming]);

    // An answer this person is not offered (a minor's stored adult answer) shows the follower's week.
    const stored = choiceFromStored(progress?.choice);
    const choice = stored && !choicesFor({ adult: isAdult(user?.dob) }).includes(stored) ? 'follow' : stored;
    if (!userId || !choice || progress?.state !== 'DONE' || progress.cardDismissed) return null;
    const steps = stepsFor(choice);
    const done = doneSteps(progress);
    const count = steps.filter(step => done.has(step.id)).length;
    if (count === steps.length) return null;
    const setOpen = (value: boolean) => { toggled.current = true; setConfirming(false); record(current => withUnfolded(current, value)); };
    const hide = () => {
        record(current => ({ ...current, state: 'DONE', cardDismissed: true }));
        // The checklist is gone: focus goes to the page rather than nowhere.
        requestAnimationFrame(focusPage);
    };
    const keep = () => { setConfirming(false); requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[data-hide]')?.focus()); };
    const title = copy('Your first week', 'თქვენი პირველი კვირა');
    const tally = copy(`${count} of ${steps.length}`, `${count} / ${steps.length}`);

    const row = (step: WeekStep) => {
        const ticked = done.has(step.id);
        // World introduces itself by name until it has been opened: its mark, its promise and "Open World".
        const meet = step.world && !ticked;
        const body = meet ? <>
            <WorldMark size={30} />
            <span className="gk-week__label">
                {copy(step.en, step.ka)}<small className="gk-week__line">{copy(...WORLD_BRAND.tagline)}</small>
                <span className="gk-week__go" aria-hidden="true">{copy(...WORLD_BRAND.open)}</span>
            </span>
        </> : <>
            <span className="gk-week__icon">{ticked ? <Check aria-hidden="true" /> : <step.icon aria-hidden="true" />}</span>
            <span className="gk-week__label">{copy(step.en, step.ka)}{ticked && <span className="gk-week__sr">{copy(' (done)', ' (შესრულებულია)')}</span>}</span>
            <ChevronRight aria-hidden="true" />
        </>;
        const shared = { className: `gk-week__row${meet ? ' gk-week__row--world' : ''}`, 'data-done': ticked || undefined };
        const button = (onClick: () => void) => <button type="button" {...shared} onClick={onClick}>{body}</button>;
        const { open: how } = step;
        // Steps that open over this page leave the list unfolded; a step on another page folds it out of the way.
        if (how.kind === 'follow') return button(() => setClubsOpen(true));
        if (how.kind === 'photo') return button(images.pickImage);
        if (how.kind === 'action' && addChild.href) return <Link {...shared} to={addChild.href} state={OPENED_HERE} onClick={() => record(current => markDone(current, step.id))}>{body}</Link>;
        const to = how.kind === 'action' ? how.fallback : how.to;
        return <Link {...shared} to={to} onClick={() => record(current => withUnfolded(markDone(current, step.id), false))}>{body}</Link>;
    };

    return <>
        {open ? <section ref={panel} className="gk-week" aria-labelledby={titleId} onKeyDown={event => {
            // Escape steps back: out of the question first, then folds the list.
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            if (confirming) keep(); else setOpen(false);
        }}>
            <header className="gk-week__head">
                <WeekRing done={count} total={steps.length} />
                <h2 id={titleId}>{title}</h2>
                <span className="gk-week__count">{tally}</span>
                <span className="gk-week__tools">
                    <Button className="gk-week__tool" variant="ghost" iconOnly aria-expanded="true" aria-label={copy('Fold', 'ჩაკეცვა')} onClick={() => setOpen(false)}><ChevronDown aria-hidden="true" /></Button>
                    {!confirming && <Button data-hide className="gk-week__tool" variant="ghost" iconOnly aria-label={copy('Hide your first week', 'პირველი კვირის დამალვა')} onClick={() => setConfirming(true)}><X aria-hidden="true" /></Button>}
                </span>
            </header>
            {confirming ? <div className="gk-week__confirm" role="group" aria-labelledby={`${titleId}-hide`}>
                <p id={`${titleId}-hide`}>{copy('Hide your first week?', 'დავმალოთ პირველი კვირა?')}</p>
                <span className="gk-week__confirm-actions">
                    <Button data-keep variant="secondary" onClick={keep}>{copy('Keep', 'დატოვება')}</Button>
                    <Button variant="primary" onClick={hide}>{copy('Hide', 'დამალვა')}</Button>
                </span>
            </div>
                : <ol className="gk-week__rows">{steps.map(step => <li key={step.id}>{row(step)}</li>)}</ol>}
        </section>
            : <button ref={chip} type="button" className="gk-week-chip" data-enter={entering || undefined} aria-expanded="false" aria-label={`${title} · ${tally}`}
                onClick={() => { markEntered(); setEntering(false); setOpen(true); }} onAnimationEnd={() => { markEntered(); setEntering(false); }}>
                <WeekRing done={count} total={steps.length} />
                <span><strong>{title}</strong><span> · </span><span className="gk-week-chip__count">{tally}</span></span>
            </button>}
        <span hidden>{images.imageAction}</span>
        {images.dialogs}
        {clubsOpen && <ClubsNearYou onClose={() => setClubsOpen(false)} onFollowed={() => { if (!done.has('follow')) record(current => markDone(current, 'follow')); }} />}
    </>;
}
