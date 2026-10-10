import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { useJourneyCopy } from '../../../../features/squadCommunication/journeyCopy';
import { HeaderTab } from '../HeaderTab';
import { moveMenuFocus, usePopover } from '../usePopover';
import { readPageTitle, type RouteDescription } from './describeRoute';
import { pinIcons } from './pinIcons';
import { PinGlyph, PinsPanel } from './PinsPanel';
import { VISIBLE_PINS, type Pin, type usePins } from './usePins';

const OVERFLOW_BUTTON = 104;
const PIN_TOOLS = 64;

interface PinsBarProps { state: ReturnType<typeof usePins>; page: RouteDescription; work: Pin[]; activePath: string | null }

/** Up to five pins as tabs, as many as fit; the rest stay one click away in "More". */
export function PinsBar({ state, page, work, activePath }: PinsBarProps) {
    const copy = useJourneyCopy();
    const { pins } = state;
    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLUListElement>(null);
    const [fit, setFit] = useState(0);
    const [title, setTitle] = useState<string | null>(null);
    const { open: panelOpen, toggle: panelToggle, close: panelClose, triggerRef: panelTriggerRef, panelRef: panelPanelRef, onKeyDown: panelOnKeyDown } = usePopover();
    const { open: overflowOpen, toggle: overflowToggle, triggerRef: overflowTriggerRef, panelRef: overflowPanelRef, onKeyDown: overflowOnKeyDown } = usePopover();
    const panelId = useId();
    const overflowId = useId();

    useLayoutEffect(() => {
        const container = containerRef.current, measure = measureRef.current;
        if (!container || !measure || typeof ResizeObserver === 'undefined') return;
        // The observer reports the initial size too, so the count is never set during render.
        const observer = new ResizeObserver(() => {
            const available = container.clientWidth - PIN_TOOLS;
            const widths = Array.from(measure.children, child => (child as HTMLElement).offsetWidth + 4);
            let used = 0, count = 0;
            for (const [index, width] of widths.entries()) {
                if (index >= VISIBLE_PINS) break;
                const reserve = index < widths.length - 1 ? OVERFLOW_BUTTON : 0;
                if (used + width + reserve > available) break;
                used += width;
                count += 1;
            }
            setFit(count);
        });
        observer.observe(container);
        observer.observe(measure);
        return () => observer.disconnect();
    }, [pins]);

    const visible = pins.slice(0, fit);
    const hidden = pins.slice(fit);
    const hiddenActive = hidden.some(pin => pin.path === activePath);

    return (
        <div ref={containerRef} className="gk-header__pins">
            <span className="gk-header__divider" aria-hidden="true" />
            <ul ref={measureRef} className="gk-pins gk-pins--measure" aria-hidden="true">
                {pins.map(pin => <li key={pin.path} className="gk-htab gk-htab--pin"><span className="gk-htab__body"><PinGlyph icon={pin.icon} /><span className="gk-htab__label">{pin.label}</span></span></li>)}
            </ul>
            {visible.length > 0 && (
                <ul className="gk-pins" aria-label={copy('Your pins', 'თქვენი პინები')}>
                    {visible.map(pin => <li key={pin.path}><HeaderTab pin to={pin.path} label={pin.label} icon={pinIcons[pin.icon]} current={pin.path === activePath} /></li>)}
                </ul>
            )}
            <div className="gk-header__pin-tools">
                {hidden.length > 0 && (
                    <div className="gk-hanchor" onKeyDown={overflowOnKeyDown}>
                        <button ref={overflowTriggerRef} type="button" className="gk-hbtn gk-hbtn--text" aria-haspopup="menu" aria-expanded={overflowOpen}
                            aria-controls={overflowOpen ? overflowId : undefined} aria-current={hiddenActive ? 'page' : undefined} onClick={overflowToggle}>
                            {visible.length
                                ? copy(`${hidden.length} more`, `კიდევ ${hidden.length}`)
                                : copy(`${hidden.length} ${hidden.length === 1 ? 'pin' : 'pins'}`, `${hidden.length} პინი`)}<ChevronDown aria-hidden="true" />
                        </button>
                        {overflowOpen && (
                            <div ref={overflowPanelRef} id={overflowId} role="menu" aria-label={visible.length ? copy('More pins', 'სხვა პინები') : copy('Your pins', 'თქვენი პინები')} className="gk-pop gk-pop--menu gk-pop--start" onKeyDown={moveMenuFocus}>
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
                    <button ref={panelTriggerRef} type="button" className={pins.length ? 'gk-hbtn' : 'gk-hbtn gk-hbtn--text'} aria-haspopup="dialog" aria-expanded={panelOpen}
                        aria-controls={panelOpen ? panelId : undefined} aria-label={copy('Pins: add or manage your tabs', 'პინები: ჩანართების დამატება')} title={copy('Pins', 'პინები')}
                        onClick={() => { setTitle(readPageTitle()); panelToggle(); }}>
                        <Plus aria-hidden="true" />{pins.length === 0 && <span>{copy('Pin', 'მიმაგრება')}</span>}
                    </button>
                    {panelOpen && (
                        <div ref={panelPanelRef} id={panelId} role="dialog" aria-labelledby={`${panelId}-title`} className="gk-pop gk-pop--start">
                            <PinsPanel state={state} page={{ ...page, title }} work={work} titleId={`${panelId}-title`} onNavigate={() => panelClose(false)} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
