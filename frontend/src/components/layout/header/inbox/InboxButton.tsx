import { useId } from 'react';
import { useLocation } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Count } from '../../../../design/primitives';
import { useJourneyCopy } from '../../../../features/squadCommunication/journeyCopy';
import { usePopover } from '../usePopover';
import { InboxPanel } from './InboxPanel';
import { useInboxCounts } from './useInbox';

/** Requests and notifications behind one button, with one combined count. */
export function InboxButton() {
    const copy = useJourneyCopy();
    const { pathname } = useLocation();
    const counts = useInboxCounts();
    const { open, toggle, close, triggerRef, panelRef, onKeyDown } = usePopover('panel');
    const id = useId();
    const total = (counts.needsYou ?? 0) + (counts.updates ?? 0);
    const known = counts.needsYou !== null || counts.updates !== null;
    const label = known
        ? copy(`Inbox: ${counts.needsYou ?? 0} need you, ${counts.updates ?? 0} unread updates`, `შემოსულები: ${counts.needsYou ?? 0} გელოდებათ, ${counts.updates ?? 0} სიახლე`)
        : copy('Inbox', 'შემოსულები');
    const onInboxPage = pathname === '/requests' || pathname === '/notifications';

    return (
        <div className="gk-hanchor" onKeyDown={onKeyDown}>
            <button ref={triggerRef} type="button" className="gk-hbtn" aria-label={label} title={copy('Inbox', 'შემოსულები')}
                aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
                aria-current={onInboxPage ? 'page' : undefined} onClick={toggle}>
                <Inbox aria-hidden="true" />
                <Count value={total} />
            </button>
            {open && (
                <div ref={panelRef} id={id} role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1} className="gk-pop">
                    <InboxPanel counts={counts} titleId={`${id}-title`} onNavigate={() => close(false)} />
                </div>
            )}
        </div>
    );
}
