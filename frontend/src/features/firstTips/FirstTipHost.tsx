import './first-tips.css';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Lightbulb, Sparkles, X } from 'lucide-react';
import { DIALOG_COMPANION } from '../../components/workspace/useDialogFocus';
import { useAuth } from '../../context/AuthContext';
import { hasNavigationCapability } from '../../context/navigationCapabilities';
import { Button, GkRoot } from '../../design/primitives';
import { AGENT_DOLA_OPEN, openAgentDola } from '../dola/agentDolaEvents';
import { useDolaEntry } from '../dola/dolaEntry';
import { useGuide } from '../dola/dolaGuide';
import { loadPreferences, readPreferences, usePreferences } from '../preferences/preferencesStore';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { WELCOME_PARAM } from '../start/welcomeSteps';
import { FIRST_TIP_EVENT, markTipSeen, requestFirstTip, seenTips, tipForPage, tipScore, tipsOff, turnTipsOff, type FirstTip } from './firstTips';
import { FIRST_TIPS } from './tipCatalog';
import { placeTip, type TipPlacement } from './tipPlacement';

/** Long enough for the page to draw and a redirect to finish, so a tip never flashes for a page passed through. */
const PAGE_DELAY = 700;
/** The window that was asked for opens first; the tip then joins it. */
const ACTION_DELAY = 250;
/** Marks the header button the card points at, so it glows while the card is open. */
const ANCHOR_ATTR = 'data-first-tip-anchor';
/** What the card points at, in order: Agent Dola's button, else the inbox, else the header's own buttons. */
const ANCHORS = ['.gk-header .gk-hbtn--dola', '.gk-header .gk-header__inbox', '.gk-header .gk-header__actions'];
/** While the card is open the drawer or page under it can change (a drawer slides over the header): look again. */
const RECHECK_MS = 600;

interface Shown { tip: FirstTip; from: 'page' | 'action'; pathname: string }

/**
 * First-time tips for the whole signed-in app (mounted once, beside Agent Dola). The first visit to a page with a tip
 * (`places`), or the first click on an element marked `data-first-tip="<id>"`, pops the card out beside Agent Dola's
 * button. One card at a time, once per account; never over the welcome after sign-up or a guide Dola is running.
 */
export function FirstTipHost() {
    const { status, user } = useAuth();
    if (status !== 'authenticated' || !user) return null;
    return <FirstTips key={user.id} userId={user.id} />;
}

function FirstTips({ userId }: { userId: number }) {
    const { pathname, search } = useLocation();
    const preferences = usePreferences(userId);
    const guiding = useGuide();
    const dola = useDolaEntry(userId) === 'agent-dola';
    // A role-specific "Help me" (arrange a match, message my players) only for those whose own Dola does it.
    const { user } = useAuth();
    const staff = hasNavigationCapability(user?.navigationCapabilities, 'club.workspace');
    const [loaded, setLoaded] = useState(false);
    const [shown, setShown] = useState<Shown | null>(null);

    // Until the server's copy is in, a tip seen on another device could show again: wait for it, and stay quiet if it fails.
    useEffect(() => {
        let live = true;
        loadPreferences(userId).then(() => { if (live) setLoaded(true); }, () => undefined);
        return () => { live = false; };
    }, [userId]);

    const quiet = !loaded || tipsOff(preferences) || new URLSearchParams(search).has(WELCOME_PARAM) || guiding !== null;
    const here = useRef(pathname);
    const showing = useRef(false);
    const silent = useRef(quiet);
    const ready = useRef(loaded);
    /** A click that came before the person's settings were in: asked again once they are, on the same page. */
    const waiting = useRef<{ id: string; pathname: string } | null>(null);
    useLayoutEffect(() => { here.current = pathname; showing.current = shown !== null; silent.current = quiet; ready.current = loaded; });

    const show = useCallback((tip: FirstTip, from: Shown['from']) => {
        // Seen once it shows: leaving the page without closing it does not bring it back.
        markTipSeen(userId, tip.id);
        setShown({ tip, from, pathname: here.current });
    }, [userId]);

    // Moving on closes a page's tip once the address no longer fits it, and an action's tip once the page changes.
    const address = pathname + search;
    const [lastAddress, setLastAddress] = useState(address);
    if (lastAddress !== address) {
        setLastAddress(address);
        if (shown && (shown.from === 'action' ? shown.pathname !== pathname : tipScore(shown.tip, pathname, new URLSearchParams(search)) === null)) setShown(null);
    }

    // A page seen for the first time: its own tip, else its section's.
    useEffect(() => {
        if (quiet) return;
        const timer = window.setTimeout(() => {
            if (showing.current) return;
            const tip = tipForPage(FIRST_TIPS, pathname, search, seenTips(readPreferences(userId)));
            if (tip) show(tip, 'page');
        }, PAGE_DELAY);
        return () => window.clearTimeout(timer);
    }, [quiet, pathname, search, userId, show]);

    // Something asked for for the first time: a click on `data-first-tip`, or `requestFirstTip(id)` from code.
    useEffect(() => {
        let timer = 0;
        const request = (id: string | null | undefined) => {
            if (!id) return;
            if (!ready.current) { waiting.current = { id, pathname: here.current }; return; }
            if (silent.current) return;
            const tip = FIRST_TIPS.find(item => item.id === id);
            if (!tip || seenTips(readPreferences(userId)).has(id)) return;
            window.clearTimeout(timer);
            timer = window.setTimeout(() => { if (!silent.current) show(tip, 'action'); }, ACTION_DELAY);
        };
        const onClick = (event: MouseEvent) => {
            const marked = event.target instanceof Element ? event.target.closest('[data-first-tip]') : null;
            request(marked?.getAttribute('data-first-tip'));
        };
        const onRequest = (event: Event) => request((event as CustomEvent<string>).detail);
        document.addEventListener('click', onClick, true);
        window.addEventListener(FIRST_TIP_EVENT, onRequest);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('click', onClick, true);
            window.removeEventListener(FIRST_TIP_EVENT, onRequest);
        };
    }, [userId, show]);

    // Opening Agent Dola (the header button, or another tip's "Help me") puts the tip away: the panel takes over.
    useEffect(() => {
        const away = () => setShown(null);
        window.addEventListener(AGENT_DOLA_OPEN, away);
        return () => window.removeEventListener(AGENT_DOLA_OPEN, away);
    }, []);

    useEffect(() => {
        const asked = waiting.current;
        if (!loaded || !asked) return;
        waiting.current = null;
        if (asked.pathname === here.current) requestFirstTip(asked.id);
    }, [loaded]);

    if (!shown || quiet) return null;
    const close = () => setShown(null);
    return createPortal(<TipCard key={shown.tip.id} tip={shown.tip} dola={dola} askable={shown.tip.askFor !== 'staff' || staff} onClose={close}
        onHelp={ask => { close(); openAgentDola(ask); }}
        onTurnOff={() => { close(); turnTipsOff(userId); }} />, document.body);
}

/** On screen and not covered (World's drawers cover the header): a pointer at a hidden button would point at nothing. */
function reachable(element: HTMLElement) {
    if (element.getClientRects().length === 0) return false;
    if (typeof document.elementFromPoint !== 'function') return true;
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit === null || element.contains(hit);
}
function findAnchor(): HTMLElement | null {
    for (const selector of ANCHORS) {
        const element = document.querySelector<HTMLElement>(selector);
        if (element && reachable(element)) return element;
    }
    return null;
}
/** The phone tab bar along the bottom, when it is showing. */
const bottomBar = () => document.querySelector('.gk-tabbar')?.getBoundingClientRect().height ?? 0;

function TipCard({ tip, dola, askable, onClose, onHelp, onTurnOff }: {
    tip: FirstTip; dola: boolean; askable: boolean; onClose: () => void; onHelp: (ask: string) => void; onTurnOff: () => void;
}) {
    const copy = useJourneyCopy();
    const id = useId();
    const card = useRef<HTMLElement>(null);
    const [placement, setPlacement] = useState<TipPlacement | null>(null);

    useLayoutEffect(() => {
        let frame = 0;
        let anchor: HTMLElement | null = null;
        const place = () => {
            frame = 0;
            const element = card.current;
            if (!element) return;
            const next = findAnchor();
            if (next !== anchor) { anchor?.removeAttribute(ANCHOR_ATTR); next?.setAttribute(ANCHOR_ATTR, ''); anchor = next; }
            setPlacement(placeTip(next?.getBoundingClientRect() ?? null, { width: element.offsetWidth, height: element.offsetHeight },
                { width: window.innerWidth, height: window.innerHeight }, bottomBar()));
        };
        const schedule = () => { if (!frame) frame = window.requestAnimationFrame(place); };
        place();
        window.addEventListener('resize', schedule);
        window.addEventListener('scroll', schedule, true);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
        if (card.current) observer?.observe(card.current);
        const recheck = window.setInterval(schedule, RECHECK_MS);
        return () => {
            window.clearInterval(recheck);
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('scroll', schedule, true);
            observer?.disconnect();
            anchor?.removeAttribute(ANCHOR_ATTR);
        };
    }, []);

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        // Escape closes the card only, not a drawer or dialog behind it.
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    };
    const ask = dola && askable && tip.ask ? copy(tip.ask.en, tip.ask.ka) : null;
    const style = { top: placement?.top ?? 0, left: placement?.left ?? 0, '--first-tip-pointer': `${placement?.pointer ?? 0}px` } as CSSProperties;

    // Never read as the page's form when Dola is asked about the page (`data-dola-ignore`).
    return <GkRoot className="first-tip-layer" data-dola-ignore="" {...{ [DIALOG_COMPANION]: '' }}>
        <section ref={card} className="first-tip" role="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`}
            data-side={placement?.side ?? 'corner'} data-placed={placement ? '' : undefined} style={style} onKeyDown={onKeyDown}>
            <header className="first-tip__head">
                <span className="first-tip__from">
                    {dola ? <><Sparkles aria-hidden="true" />Agent Dola</> : <><Lightbulb aria-hidden="true" />{copy('Quick tip', 'მინიშნება')}</>}
                    <span className="first-tip__new">{copy('New here', 'პირველად აქ')}</span>
                </span>
                <Button size="sm" variant="ghost" iconOnly onClick={onClose} aria-label={copy('Close tip', 'მინიშნების დახურვა')} title={copy('Close', 'დახურვა')}>
                    <X aria-hidden="true" />
                </Button>
            </header>
            <h2 id={`${id}-title`} className="first-tip__title">{copy(tip.title.en, tip.title.ka)}</h2>
            <p id={`${id}-body`} className="first-tip__body">{copy(tip.body.en, tip.body.ka)}</p>
            {ask && <p className="first-tip__offer">{copy('Want a hand? I can do it with you:', 'დახმარება გჭირდებათ? ერთად გავაკეთოთ:')}</p>}
            <div className="first-tip__buttons">
                {ask && <Button size="sm" variant="primary" className="first-tip__help" onClick={() => onHelp(ask)}>
                    <Sparkles aria-hidden="true" /><span>{ask}</span>
                </Button>}
                <Button size="sm" variant={ask ? 'ghost' : 'primary'} onClick={onClose}>{copy('Got it', 'გასაგებია')}</Button>
            </div>
            <button type="button" className="first-tip__off" onClick={onTurnOff}>{copy('Don’t show tips like this', 'ასეთი მინიშნებები აღარ მაჩვენო')}</button>
            {/* Screen readers hear the card arrive without it taking the focus from the page. */}
            <p className="gk-visually-hidden" role="status">{copy(`Tip: ${tip.title.en}`, `მინიშნება: ${tip.title.ka}`)}</p>
        </section>
    </GkRoot>;
}
