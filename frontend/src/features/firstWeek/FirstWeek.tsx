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
import { choiceFromStored, choicesFor, weekDone } from '../start/welcomeSteps';
import { saveMyPhoto } from './api';
import { ClubsNearYou } from './ClubsNearYou';
import { isUnfolded, stepsFor, withUnfolded, type WeekStep } from './steps';
import './first-week.css';

/** How much of the week is done, as a small ring. */
function WeekRing({ done, total }: { done: number; total: number }) {
    const radius = 8, length = 2 * Math.PI * radius;
    return <svg className="gk-week-ring" viewBox="0 0 20 20" aria-hidden="true">
        <circle className="gk-week-ring__track" cx="10" cy="10" r={radius} />
        <circle className="gk-week-ring__fill" cx="10" cy="10" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - done / total)} transform="rotate(-90 10 10)" />
    </svg>;
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
        onSave: async (_field, url) => { await saveMyPhoto(url); record(current => weekDone(current, 'photo')); void bootstrapSession().catch(() => undefined); },
    });
    const addChild = useAction('add_child');
    const open = isUnfolded(progress);
    // Folding or unfolding swaps the chip for the panel: focus follows to the one now shown.
    const chip = useRef<HTMLButtonElement>(null), panel = useRef<HTMLElement>(null), toggled = useRef(false);
    useEffect(() => {
        if (!toggled.current) return;
        toggled.current = false;
        (open ? panel.current?.querySelector<HTMLElement>('[aria-expanded]') : chip.current)?.focus();
    }, [open]);

    // An answer this person is not offered (a minor's stored adult answer) shows the follower's week.
    const stored = choiceFromStored(progress?.choice);
    const choice = stored && !choicesFor({ adult: isAdult(user?.dob) }).includes(stored) ? 'follow' : stored;
    if (!userId || !choice || progress?.state !== 'DONE' || progress.cardDismissed) return null;
    const steps = stepsFor(choice, start?.childAge);
    const done = new Set(progress.week ?? []);
    const count = steps.filter(step => done.has(step.id)).length;
    if (count === steps.length) return null;
    const setOpen = (value: boolean) => { toggled.current = true; record(current => withUnfolded(current, value)); };
    const title = copy('Your first week', 'თქვენი პირველი კვირა');
    const tally = copy(`${count} of ${steps.length}`, `${count} / ${steps.length}`);

    const row = (step: WeekStep) => {
        const ticked = done.has(step.id);
        const body = <>
            <span className="gk-week__icon">{ticked ? <Check aria-hidden="true" /> : <step.icon aria-hidden="true" />}</span>
            <span className="gk-week__label">{copy(step.en, step.ka)}{ticked && <span className="gk-week__sr">{copy(' (done)', ' (შესრულებულია)')}</span>}</span>
            <ChevronRight aria-hidden="true" />
        </>;
        const shared = { className: 'gk-week__row', 'data-done': ticked || undefined };
        const button = (onClick: () => void) => <button type="button" {...shared} onClick={onClick}>{body}</button>;
        const { open: how } = step;
        // Steps that open over this page leave the list unfolded; a step on another page folds it out of the way.
        if (how.kind === 'follow') return button(() => setClubsOpen(true));
        if (how.kind === 'photo') return button(images.pickImage);
        if (how.kind === 'action' && addChild.href) return <Link {...shared} to={addChild.href} state={OPENED_HERE} onClick={() => record(current => weekDone(current, step.id))}>{body}</Link>;
        const to = how.kind === 'action' ? how.fallback : how.to;
        return <Link {...shared} to={to} onClick={() => record(current => withUnfolded(weekDone(current, step.id), false))}>{body}</Link>;
    };

    return <>
        {open ? <section ref={panel} className="gk-week" aria-labelledby={titleId}>
            <header className="gk-week__head">
                <WeekRing done={count} total={steps.length} />
                <h2 id={titleId}>{title}</h2>
                <span className="gk-week__count">{tally}</span>
                <Button variant="ghost" size="sm" iconOnly aria-expanded="true" aria-label={copy('Fold', 'ჩაკეცვა')} onClick={() => setOpen(false)}><ChevronDown aria-hidden="true" /></Button>
                <Button variant="ghost" size="sm" iconOnly aria-label={copy('Close for good', 'სამუდამოდ დახურვა')} onClick={() => record(current => ({ ...current, state: 'DONE', cardDismissed: true }))}><X aria-hidden="true" /></Button>
            </header>
            <ol className="gk-week__rows">{steps.map(step => <li key={step.id}>{row(step)}</li>)}</ol>
        </section>
            : <button ref={chip} type="button" className="gk-week-chip" aria-expanded="false" aria-label={`${title} · ${tally}`} onClick={() => setOpen(true)}>
                <WeekRing done={count} total={steps.length} />
                <span><strong>{title}</strong><span> · </span><span className="gk-week-chip__count">{tally}</span></span>
            </button>}
        <span hidden>{images.imageAction}</span>
        {images.dialogs}
        {clubsOpen && <ClubsNearYou onClose={() => setClubsOpen(false)} onFollowed={() => record(current => weekDone(current, 'follow'))} />}
    </>;
}
