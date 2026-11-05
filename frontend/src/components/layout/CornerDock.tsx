import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DO_PARAM } from '../../features/actions/registry';
import { CREATE_PARAM } from '../../features/pages/create/entry';
import { WELCOME_PARAM } from '../../features/start/welcomeSteps';
import './corner-dock.css';

/** Address keys that open something over the page: the welcome, an action's flow, the start sheet. */
const OVER_PAGE = [WELCOME_PARAM, DO_PARAM, CREATE_PARAM];
/** How far in from the dock's corner it looks for something else, across the chip's width. */
const PROBES = [16, 90, 180];

const fixedHere = (element: Element) => {
    for (let node: Element | null = element; node && node !== document.body; node = node.parentElement)
        if (getComputedStyle(node).position === 'fixed') return true;
    return false;
};

/**
 * Whether something else fixed already sits in the dock's corner (Team work's "Ask Dola", an open side panel, a
 * toast), looked up where the dock stands whenever the page changes, so no page has to be listed to win the corner.
 */
function useCornerTaken(dock: HTMLElement | null) {
    const [taken, setTaken] = useState(false);
    useEffect(() => {
        if (!dock || typeof document.elementsFromPoint !== 'function') return;
        let frame = 0;
        const check = () => {
            frame = 0;
            const style = getComputedStyle(dock);
            const right = parseFloat(style.right) || 0, y = window.innerHeight - (parseFloat(style.bottom) || 0) - 24;
            setTaken(PROBES.some(inset => document.elementsFromPoint(window.innerWidth - right - inset, y)
                .some(element => !dock.contains(element) && fixedHere(element))));
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
        schedule();
        const observer = new MutationObserver(schedule);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open'] });
        window.addEventListener('resize', schedule);
        return () => { observer.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
    }, [dock]);
    return taken;
}

/**
 * The app frame's one floating corner: bottom right on a wide screen, above the tab bar on a phone. One thing lives
 * here at a time: today "Your first week", later the Dola guide. It stays empty while something is open over the page
 * (the welcome, an action's flow, the start sheet, any dialog), while the page-creation fox is out (`corner-dock.css`),
 * and whenever anything else fixed stands in the same corner.
 */
export function CornerDock({ children }: { children: ReactNode }) {
    const params = new URLSearchParams(useLocation().search);
    const [dock, setDock] = useState<HTMLDivElement | null>(null);
    const taken = useCornerTaken(dock);
    if (OVER_PAGE.some(key => params.has(key))) return null;
    return <div ref={setDock} className="gk gk-corner" data-yield={taken || undefined}>{children}</div>;
}
