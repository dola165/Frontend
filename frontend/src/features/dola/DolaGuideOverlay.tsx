import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import { DIALOG_COMPANION } from '../../components/workspace/useDialogFocus';
import { Button, GkRoot } from '../../design/primitives';
import { useJourneyCopy } from '../squadCommunication/journeyCopy';
import { openAgentDola } from './agentDolaEvents';
import { goToStep, setGuideSteps, stopGuide, useGuide } from './dolaGuide';
import { PAD, placeCard } from './guidePlacement';
import { controlIn, findField, isFilled, onPage, readPageForm } from './pageForm';
import './dola-guide.css';

/** Back to its corner: the field is not on screen, or the card fits nowhere beside it. */
function dock(card: HTMLElement | null) {
    if (!card) return;
    delete card.dataset.side;
    card.style.removeProperty('transform');
    card.style.removeProperty('--dola-arrow');
}

/**
 * The guide sits directly under <body>, over everything, as a dialog's companion: a form in a drawer or dialog (World's
 * Draw room) is framed too, and its card stays usable while the dialog keeps the page behind it inert.
 */
const layer = (children: ReactNode) => createPortal(<GkRoot className="dola-guide-layer" {...{ [DIALOG_COMPANION]: '' }}>{children}</GkRoot>, document.body);

/**
 * Agent Dola's guide on screen: a frame around the field to fill now, and beside it, pointing at it, a card that says
 * which step this is, why the field matters and whether it is filled, with Back, Next and Close. It opens the guide's
 * page when the person is elsewhere, and on a page Dola could not list it reads the empty fields itself. Nothing is
 * typed or saved for them.
 */
export function DolaGuideOverlay() {
    const copy = useJourneyCopy();
    const location = useLocation();
    const navigate = useNavigate();
    const state = useGuide();
    const frame = useRef<HTMLDivElement>(null);
    const card = useRef<HTMLElement>(null);
    // What was seen for which step, so a new step never shows the last one's field.
    const [seen, setSeen] = useState<{ key: string; element: HTMLElement | null; filled: boolean }>({ key: '', element: null, filled: false });
    const [emptyGuide, setEmptyGuide] = useState<object | null>(null);
    const shownStep = useRef<string | null>(null);

    const guide = state?.guide ?? null;
    const here = !guide?.webPath || onPage(guide.webPath, location.pathname, location.search);
    const step = state && here ? state.steps[state.index] ?? null : null;
    const stepKey = step && state ? `${state.index}:${step.target}` : '';
    const found = stepKey && seen.key === stepKey ? seen.element : null;
    // Looked for and not on screen; until the first look the card stays where the last step put it.
    const missing = Boolean(stepKey) && seen.key === stepKey && !seen.element;
    const filled = Boolean(stepKey) && seen.key === stepKey && seen.filled;
    const nothingLeft = guide !== null && emptyGuide === guide;

    // Leaving the guide's page from its last step (Create or Save pressed, or the form closed there) ends the guide.
    const wasHere = useRef(here);
    useEffect(() => {
        const last = state ? state.steps.length > 0 && state.index >= state.steps.length - 1 : false;
        if (wasHere.current && !here && last) stopGuide();
        wasHere.current = here;
    }, [here, state]);
    // So does the last step's button going away just after it was pressed, on the same page: a window's Save closed
    // it (the calendar's event editor). A rejected save keeps the window, its button and the guide; going Back in the
    // form without pressing it never ends the guide.
    const lastStep = state ? state.steps.length > 0 && state.index >= state.steps.length - 1 : false;
    useEffect(() => {
        if (!lastStep || !step) return;
        let watch: ReturnType<typeof setInterval> | undefined;
        // Looked up at the press: a window that redrew its button has a new element.
        const press = (event: Event) => {
            const element = findField(step.target, step.label);
            if (!element || !(event.target instanceof Node) || !element.contains(event.target)) return;
            clearInterval(watch);
            const until = Date.now() + 15_000;
            watch = setInterval(() => {
                if (!findField(step.target, step.label)) { clearInterval(watch); stopGuide(); }
                else if (Date.now() > until) clearInterval(watch);
            }, 400);
        };
        document.addEventListener('click', press, true);
        return () => { document.removeEventListener('click', press, true); clearInterval(watch); };
    }, [lastStep, step]);

    // A page Dola only knows by name: once it is open and drawn, its empty fields become the steps.
    useEffect(() => {
        if (!state || !here || !state.guide.scan || state.steps.length) return;
        const timer = setTimeout(() => {
            const form = readPageForm();
            const empty = (form?.fields ?? []).filter(field => !field.filled);
            const ordered = [...empty.filter(field => field.required), ...empty.filter(field => !field.required)];
            if (ordered.length) setGuideSteps(ordered.slice(0, 20).map(field => ({ target: field.key, label: field.label ?? field.key, hint: null, required: field.required })));
            else setEmptyGuide(state.guide);
        }, 700);
        return () => clearTimeout(timer);
    }, [state, here]);

    // Find the step's field (pages draw their fields after their data arrives), bring it into view once, put the
    // cursor in it, and keep checking whether it is filled.
    useEffect(() => {
        if (!step || !stepKey) return;
        const look = () => {
            const element = findField(step.target, step.label);
            if (element && shownStep.current !== stepKey) {
                shownStep.current = stepKey;
                element.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
                // A folded part (the rules in detail) takes the cursor on its heading, so Enter opens it.
                const control = controlIn(element) ?? (element.matches('summary') ? element : null);
                if (control && !(control instanceof HTMLInputElement && control.type === 'file')) control.focus({ preventScroll: true });
            }
            const control = element ? controlIn(element) ?? element : null;
            const nowFilled = Boolean(control && isFilled(control));
            setSeen(previous => previous.key === stepKey && previous.element === element && previous.filled === nowFilled
                ? previous : { key: stepKey, element, filled: nowFilled });
        };
        const first = setTimeout(look, 0);
        const timer = setInterval(look, 600);
        document.addEventListener('input', look, true);
        document.addEventListener('change', look, true);
        return () => {
            clearTimeout(first); clearInterval(timer);
            document.removeEventListener('input', look, true); document.removeEventListener('change', look, true);
        };
    }, [step, stepKey]);

    // The frame and the card beside it follow the field as the page scrolls and reflows, without re-rendering React on
    // every frame. Placed before the browser paints, so a new step never shows the card in the old place first.
    useLayoutEffect(() => {
        if (missing) dock(card.current);
        if (!found) return;
        let raf = 0;
        const place = () => {
            const rect = found.getBoundingClientRect();
            // A field scrolled under the sticky header is not framed over the header.
            const header = document.querySelector('.gk-header, header')?.getBoundingClientRect().bottom ?? 0;
            const hidden = rect.top - PAD < header;
            const box = frame.current;
            if (box) {
                box.style.transform = `translate(${rect.left - PAD}px, ${rect.top - PAD}px)`;
                box.style.width = `${rect.width + PAD * 2}px`;
                box.style.height = `${rect.height + PAD * 2}px`;
                box.style.visibility = hidden ? 'hidden' : 'visible';
            }
            const aside = card.current;
            if (aside) {
                const offScreen = hidden || rect.top > window.innerHeight;
                const spot = offScreen ? null : placeCard(rect, aside.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight });
                if (spot) {
                    aside.dataset.side = spot.side;
                    aside.style.transform = `translate(${Math.round(spot.x)}px, ${Math.round(spot.y)}px)`;
                    aside.style.setProperty('--dola-arrow', `${Math.round(spot.arrow)}px`);
                } else dock(aside);
            }
            raf = requestAnimationFrame(place);
        };
        place();
        return () => cancelAnimationFrame(raf);
    }, [found, missing]);

    useEffect(() => {
        if (!state) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') stopGuide(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [state]);

    if (!state || !guide) return null;
    const total = state.steps.length;
    const last = state.index >= total - 1;
    const close = <Button size="sm" variant="ghost" iconOnly onClick={stopGuide} aria-label={copy('Close the guide', 'გზამკვლევის დახურვა')}
        title={copy('Close', 'დახურვა')}><X aria-hidden="true" /></Button>;
    const head = <header className="dola-guide__head">
        <span className="dola-guide__title"><Sparkles aria-hidden="true" />{guide.title || copy('Dola’s guide', 'დოლას გზამკვლევი')}</span>
        {close}
    </header>;

    if (!here && guide.webPath) {
        return layer(<aside className="dola-guide" role="dialog" aria-label={copy('Dola’s guide', 'დოლას გზამკვლევი')}>
            {head}
            <p>{copy('These fields are on another page.', 'ეს ველები სხვა გვერდზეა.')}</p>
            <div className="dola-guide__buttons">
                <Button size="sm" variant="primary" onClick={() => navigate(guide.webPath!)}>{copy('Open it', 'გახსნა')}<ArrowRight aria-hidden="true" /></Button>
            </div>
        </aside>);
    }
    if (!total) {
        return layer(<aside className="dola-guide" role="dialog" aria-label={copy('Dola’s guide', 'დოლას გზამკვლევი')}>
            {head}
            <p role="status">{nothingLeft ? copy('Everything on this page is filled in. Save it if you changed anything.', 'ამ გვერდზე ყველაფერი შევსებულია. თუ რამე შეცვალეთ, შეინახეთ.')
                : copy('Checking what’s still empty on this page…', 'ვამოწმებ, რა არის შეუვსებელი ამ გვერდზე…')}</p>
            {nothingLeft && <div className="dola-guide__buttons"><Button size="sm" variant="primary" onClick={stopGuide}>{copy('Done', 'მზადაა')}</Button></div>}
        </aside>);
    }
    return layer(<>
        {found && <div key={stepKey} ref={frame} className="dola-guide__frame" aria-hidden="true" />}
        <aside ref={card} className="dola-guide" role="dialog" aria-label={copy('Dola’s guide', 'დოლას გზამკვლევი')}>
            {head}
            <p className="dola-guide__step">{copy(`Step ${state.index + 1} of ${total}`, `ნაბიჯი ${state.index + 1} / ${total}`)}</p>
            <h3 className="dola-guide__field">{step?.label}{step?.required && <span className="dola-guide__required">{copy('required', 'სავალდებულო')}</span>}</h3>
            {step?.hint && <p className="dola-guide__hint">{step.hint}</p>}
            {missing && <p className="dola-guide__hint">{copy('I can’t see this field on the screen — it may be under another tab or further down.',
                'ამ ველს ეკრანზე ვერ ვხედავ — შეიძლება სხვა ჩანართზეა ან უფრო ქვემოთ.')}</p>}
            {found && filled && <p className="dola-guide__done" role="status"><Check aria-hidden="true" />{copy('Filled', 'შევსებულია')}</p>}
            <div className="dola-guide__buttons">
                <Button size="sm" disabled={state.index === 0} onClick={() => goToStep(state.index - 1)}><ArrowLeft aria-hidden="true" />{copy('Back', 'უკან')}</Button>
                {last ? <Button size="sm" variant="primary" onClick={stopGuide}><Check aria-hidden="true" />{copy('Finish', 'დასრულება')}</Button>
                    : <Button size="sm" variant={filled ? 'primary' : undefined} onClick={() => goToStep(state.index + 1)}>{copy('Next', 'შემდეგი')}<ArrowRight aria-hidden="true" /></Button>}
                <button type="button" className="dola-guide__ask" onClick={() => openAgentDola()}>{copy('Ask Dola', 'ჰკითხე დოლას')}</button>
            </div>
        </aside>
    </>);
}
