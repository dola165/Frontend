import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Pin } from 'lucide-react';
import { Count } from '../../../design/primitives';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import { readPageTitle, type RouteDescription } from './pins/describeRoute';
import { PinsPanel } from './pins/PinsPanel';
import type { Pin as PinItem, usePins } from './pins/usePins';
import type { PrimaryTab } from './sections';
import { usePopover } from './usePopover';

interface PhoneTabBarProps {
    tabs: PrimaryTab[];
    unreadMessages: number | null;
    pins: ReturnType<typeof usePins>;
    page: RouteDescription;
    work: PinItem[];
    onPinnedPage: boolean;
}

/** Phone navigation at thumb reach: the three places, Messages, and the person's pins. */
export function PhoneTabBar({ tabs, unreadMessages, pins, page, work, onPinnedPage }: PhoneTabBarProps) {
    const copy = useJourneyCopy();
    const { pathname } = useLocation();
    const { open: sheetOpen, toggle: sheetToggle, close: sheetClose, triggerRef: sheetTriggerRef, panelRef: sheetPanelRef, onKeyDown: sheetOnKeyDown } = usePopover();
    const [title, setTitle] = useState<string | null>(null);
    const id = useId();
    return (
        <nav className="gk gk-tabbar" aria-label={copy('Main', 'მთავარი ნავიგაცია')}>
            <ul className="gk-tabbar__list">
                {tabs.map(({ id: key, to, label, icon: Icon, current }) => (
                    <li key={key}>
                        <Link to={to} className="gk-tabbar__item" aria-current={current ? 'page' : undefined}>
                            <Icon aria-hidden="true" strokeWidth={current ? 2.1 : 1.8} /><span className="gk-tabbar__label">{label}</span>
                        </Link>
                    </li>
                ))}
                <li>
                    <Link to="/messages" className="gk-tabbar__item" aria-current={pathname === '/messages' ? 'page' : undefined}
                        aria-label={unreadMessages ? copy(`Messages, ${unreadMessages} unread conversations`, `მიმოწერა, ${unreadMessages} წაუკითხავი`) : undefined}>
                        <MessageSquare aria-hidden="true" /><span className="gk-tabbar__label">{copy('Messages', 'მიმოწერა')}</span>
                        {!!unreadMessages && <span className="gk-tabbar__count"><Count value={unreadMessages} /></span>}
                    </Link>
                </li>
                <li onKeyDown={sheetOnKeyDown}>
                    <button ref={sheetTriggerRef} type="button" className="gk-tabbar__item" aria-haspopup="dialog" aria-expanded={sheetOpen}
                        aria-controls={sheetOpen ? id : undefined} aria-current={onPinnedPage ? 'page' : undefined}
                        onClick={() => { setTitle(readPageTitle()); sheetToggle(); }}>
                        <Pin aria-hidden="true" /><span className="gk-tabbar__label">{copy('Pins', 'პინები')}</span>
                        {pins.pins.length > 0 && <span className="gk-visually-hidden">{copy(`, ${pins.pins.length} pinned`, `, ${pins.pins.length} მიმაგრებული`)}</span>}
                    </button>
                </li>
            </ul>
            {sheetOpen && (
                <>
                    <div className="gk-scrim" aria-hidden="true" />
                    <div ref={sheetPanelRef} id={id} role="dialog" aria-labelledby={`${id}-title`} className="gk-sheet" onKeyDown={sheetOnKeyDown}>
                        <PinsPanel state={pins} page={{ ...page, title }} work={work} titleId={`${id}-title`} onNavigate={() => sheetClose(false)} />
                    </div>
                </>
            )}
        </nav>
    );
}
