import { useId } from 'react';
import { useLocation } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Count } from '../../../../design/primitives';
import { useJourneyCopy } from '../../../../features/squadCommunication/journeyCopy';
import { usePopover } from '../usePopover';
import { InboxPanel } from './InboxPanel';
import { inboxBadge, inboxLabel, useInboxCounts } from './useInbox';

/** Requests and notifications behind one button. The badge counts decisions only; unread updates show as a dot. */
export function InboxButton() {
    const copy = useJourneyCopy();
    const { pathname } = useLocation();
    const counts = useInboxCounts();
    const { open, toggle, close, triggerRef, panelRef, onKeyDown } = usePopover({ initialFocus: 'panel' });
    const id = useId();
    const badge = inboxBadge(counts);
    const known = counts.needsYou !== null || counts.updates !== null;
    const onInboxPage = pathname === '/requests' || pathname === '/notifications';

    return (
        <div className="gk-hanchor" onKeyDown={onKeyDown}>
            <button ref={triggerRef} type="button" className="gk-hbtn gk-header__inbox" aria-label={known ? inboxLabel(counts, copy) : copy('Inbox', 'შემოსულები')} title={copy('Inbox', 'შემოსულები')}
                aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
                aria-current={onInboxPage ? 'page' : undefined} onClick={toggle}>
                <Inbox aria-hidden="true" />
                {badge === 'dot' ? <span className="gk-hdot" aria-hidden="true" /> : badge && <Count value={badge.count} atLeast={badge.atLeast} />}
            </button>
            {open && (
                <div ref={panelRef} id={id} role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1} className="gk-pop">
                    <InboxPanel counts={counts} titleId={`${id}-title`} onNavigate={() => close(false)} />
                </div>
            )}
        </div>
    );
}
