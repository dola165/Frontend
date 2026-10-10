import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { useJourneyCopy } from '../../../../features/squadCommunication/journeyCopy';
import { HeaderTab } from '../HeaderTab';
import { moveMenuFocus, openMenuFromKey, usePopover } from '../usePopover';
import { readPageTitle, type RouteDescription } from './describeRoute';
import { pinIcons } from './pinIcons';
import { PinGlyph, PinsPanel } from './PinsPanel';
import { fitPins } from './fitPins';
import type { Pin, usePins } from './usePins';

interface PinsBarProps {
    state: ReturnType<typeof usePins>;
    page: RouteDescription;
    work: Pin[];
    activePath: string | null;
    /** Pins would not all fit beside the search field, so the header shows search as an icon instead. */
    crowded: boolean;
    onCrowdedChange: (crowded: boolean) => void;
}

/** Up to five pins as tabs, as many as fit; the rest stay one click away in "more". */
export function PinsBar({ state, page, work, activePath, crowded, onCrowdedChange }: PinsBarProps) {
    const copy = useJourneyCopy();
    const { pins } = state;
    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLUListElement>(null);
    const moreMeasureRef = useRef<HTMLSpanElement>(null);
    const crowdedRef = useRef(crowded);
    useLayoutEffect(() => { crowdedRef.current = crowded; }, [crowded]);
    const [fit, setFit] = useState(0);
    const [title, setTitle] = useState<string | null>(null);
    // A popover opens rightwards from its button, unless that would run past the window; then it opens leftwards.
    const [alignEnd, setAlignEnd] = useState({ panel: false, overflow: false });
    const opensLeft = (trigger: HTMLElement | null, width: number) => Boolean(trigger && trigger.getBoundingClientRect().left + width + 16 > window.innerWidth);
    const { open: panelOpen, toggle: panelToggle, close: panelClose, triggerRef: panelTriggerRef, panelRef: panelPanelRef, onKeyDown: panelOnKeyDown } = usePopover();
    const { open: overflowOpen, toggle: overflowToggle, show: overflowShow, triggerRef: overflowTriggerRef, panelRef: overflowPanelRef, onKeyDown: overflowOnKeyDown } = usePopover();
    const panelId = useId();
    const overflowId = useId();

    useLayoutEffect(() => {
        const container = containerRef.current, measure = measureRef.current;
        if (!container || !measure || typeof ResizeObserver === 'undefined') return;
        // The observer reports the initial size too, so the count is never set during render.
        const observer = new ResizeObserver(() => {
            const style = getComputedStyle(container);
            const divider = container.querySelector<HTMLElement>('.gk-header__divider');
            const dividerSpace = divider ? divider.offsetWidth + (parseFloat(getComputedStyle(divider).marginLeft) || 0) * 2 : 0;
            // The nav is centred between two equal outer columns, so it may use the row's width less twice the
            // wider of them, less the main tabs. Pins that don't fit wait in "more"; the search field never gives way.
            const nav = container.parentElement, row = nav?.parentElement;
            const tabsWidth = nav?.querySelector<HTMLElement>('.gk-header__tabs')?.offsetWidth ?? 0;
            let available = container.clientWidth;
            if (nav && row) {
                const rowStyle = getComputedStyle(row);
                const inner = row.clientWidth - (parseFloat(rowStyle.paddingLeft) || 0) - (parseFloat(rowStyle.paddingRight) || 0);
                const side = Math.max(0, ...Array.from(row.children, child => child === nav ? 0 : (child as HTMLElement).offsetWidth));
                available = inner - 2 * (side + (parseFloat(rowStyle.columnGap) || 0)) - tabsWidth;
            }
            const result = fitPins({
                available: available - dividerSpace,
                pins: Array.from(measure.children, child => (child as HTMLElement).offsetWidth),
                more: moreMeasureRef.current?.offsetWidth ?? 0,
                plus: (panelTriggerRef.current?.offsetWidth ?? 44) + 4,
                gap: 4,
                searchField: 0,
            }, crowdedRef.current);
            setFit(result.fit);
            onCrowdedChange(result.crowded);
        });
        const row = container.parentElement?.parentElement;
        for (const element of row ? Array.from(row.children) : [container]) observer.observe(element);
        if (row) observer.observe(row);
        observer.observe(measure);
        return () => observer.disconnect();
    }, [pins, onCrowdedChange, panelTriggerRef]);

    const visible = pins.slice(0, fit);
    const hidden = pins.slice(fit);
    const hiddenActive = hidden.some(pin => pin.path === activePath);
    const moreLabel = (count: number) => visible.length || count < pins.length
        ? copy(`${count} more`, `კიდევ ${count}`)
        : copy(`${count} ${count === 1 ? 'pin' : 'pins'}`, `${count} პინი`);

    return (
        <div ref={containerRef} className="gk-header__pins">
            <span className="gk-header__divider" aria-hidden="true" />
            <div className="gk-pins--measure" aria-hidden="true">
                <ul ref={measureRef} className="gk-pins">
                    {pins.map(pin => <li key={pin.path} className="gk-htab gk-htab--pin"><span className="gk-htab__body"><PinGlyph icon={pin.icon} /><span className="gk-htab__label">{pin.label}</span></span></li>)}
                </ul>
                <span ref={moreMeasureRef} className="gk-hbtn gk-hbtn--text">{moreLabel(pins.length)}<ChevronDown /></span>
            </div>
            {visible.length > 0 && (
                <ul className="gk-pins" aria-label={copy('Your pins', 'თქვენი პინები')}>
                    {visible.map(pin => <li key={pin.path}><HeaderTab pin to={pin.path} label={pin.label} icon={pinIcons[pin.icon]} current={pin.path === activePath} /></li>)}
                </ul>
            )}
            <div className="gk-header__pin-tools">
                {hidden.length > 0 && (
                    <div className="gk-hanchor" onKeyDown={overflowOnKeyDown}>
                        <button ref={overflowTriggerRef} type="button" className="gk-hbtn gk-hbtn--text" aria-haspopup="menu" aria-expanded={overflowOpen}
                            aria-controls={overflowOpen ? overflowId : undefined} aria-current={hiddenActive ? 'page' : undefined}
                            onClick={event => { setAlignEnd(current => ({ ...current, overflow: opensLeft(event.currentTarget, 300) })); overflowToggle(); }}
                            onKeyDown={event => { if (event.key.startsWith('Arrow')) setAlignEnd(current => ({ ...current, overflow: opensLeft(event.currentTarget, 300) })); openMenuFromKey(event, overflowShow); }}>
                            {moreLabel(hidden.length)}<ChevronDown aria-hidden="true" />
                        </button>
                        {overflowOpen && (
                            <div ref={overflowPanelRef} id={overflowId} role="menu" tabIndex={-1} aria-label={visible.length ? copy('More pins', 'სხვა პინები') : copy('Your pins', 'თქვენი პინები')} className={`gk-pop gk-pop--menu${alignEnd.overflow ? '' : ' gk-pop--start'}`} onKeyDown={moveMenuFocus}>
                                {hidden.map(pin => (
                                    <Link key={pin.path} role="menuitem" to={pin.path} className="gk-menu__item" aria-current={pin.path === activePath ? 'page' : undefined}>
                                        <PinGlyph icon={pin.icon} /><span className="gk-prow__title">{pin.label}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <div className="gk-hanchor" onKeyDown={panelOnKeyDown}>
                    {/* With nothing pinned the button reads "Pin"; once there are pins it is an icon named "Manage pins". */}
                    <button ref={panelTriggerRef} type="button" className={pins.length ? 'gk-hbtn' : 'gk-hbtn gk-hbtn--text'} aria-haspopup="dialog" aria-expanded={panelOpen}
                        aria-controls={panelOpen ? panelId : undefined} aria-label={pins.length ? copy('Manage pins', 'პინების მართვა') : undefined}
                        title={copy('Pin a page as your own tab', 'გვერდის ჩანართად მიმაგრება')}
                        onClick={event => { setTitle(readPageTitle()); setAlignEnd(current => ({ ...current, panel: opensLeft(event.currentTarget, 400) })); panelToggle(); }}>
                        <Plus aria-hidden="true" />{pins.length === 0 && <span>{copy('Pin', 'მიმაგრება')}</span>}
                    </button>
                    {panelOpen && (
                        <div ref={panelPanelRef} id={panelId} role="dialog" tabIndex={-1} aria-labelledby={`${panelId}-title`} className={alignEnd.panel ? 'gk-pop' : 'gk-pop gk-pop--start'}>
                            <PinsPanel state={state} page={{ ...page, title }} work={work} titleId={`${panelId}-title`} onNavigate={() => panelClose(false)} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
