import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Avatar } from '../../../design/primitives';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { AccountItems, AccountSettingsLink, type AccountProps } from './AccountMenu';
import { personName, useInOwnPlace } from './account';
import { readPageTitle, type RouteDescription } from './pins/describeRoute';
import { PinsPanel } from './pins/PinsPanel';
import type { Pin, usePins } from './pins/usePins';
import { usePopover } from './usePopover';

interface YouSheetProps extends AccountProps {
    pins: ReturnType<typeof usePins>;
    page: RouteDescription;
    work: Pin[];
    /** No club yet: My Club is not a tab, so finding or starting one lives here. */
    hasClub: boolean;
    onPinnedPage: boolean;
}

/**
 * Phones: the profile picture in the top bar opens "You" (owner, 16 October): the profile, finding a club when
 * there is none, the pins (this page, yours, suggestions) and everything the account menu holds.
 */
export function YouSheet({ pins, page, work, hasClub, onPinnedPage, ...account }: YouSheetProps) {
    const copy = useJourneyCopy();
    const { open, toggle, close, triggerRef, panelRef, onKeyDown } = usePopover({ modal: true, initialFocus: 'panel' });
    const [title, setTitle] = useState<string | null>(null);
    const id = useId();
    const name = personName(account.user, copy);
    const inOwnPlace = useInOwnPlace(account.user.id);
    const represented = new Set([...pins.pins, ...pins.suggestions, ...work].map(place => place.path));
    const extraWorkspaces = account.workspaces.filter(place => !represented.has(place.path));
    return (
        <div className="gk-header__you" onKeyDown={onKeyDown}>
            <button ref={triggerRef} type="button" className="gk-hbtn gk-hbtn--avatar" data-current={inOwnPlace || onPinnedPage || undefined} aria-haspopup="dialog"
                aria-expanded={open} aria-controls={open ? id : undefined} aria-label={copy(`You: ${name}`, `თქვენ: ${name}`)} title={name}
                onClick={() => { setTitle(readPageTitle()); toggle(); }}>
                <Avatar src={resolveMediaUrl(account.user.avatarUrl)} name={name} size={34} />
            </button>
            {open && (
                <>
                    <div className="gk-scrim" aria-hidden="true" />
                    <div ref={panelRef} id={id} role="dialog" aria-modal="true" tabIndex={-1} aria-label={copy('You', 'თქვენ')} className="gk-sheet gk-sheet--you" onKeyDown={onKeyDown}>
                        <div className="gk-you__account">
                            <Link to={`/profile/${account.user.id}`} className="gk-menu__item gk-menu__profile">
                                <Avatar src={resolveMediaUrl(account.user.avatarUrl)} name={name} size={40} />
                                <span className="gk-menu__profile-text"><strong>{name}</strong><span>{copy('View your profile', 'პროფილის ნახვა')}</span></span>
                            </Link>
                            <AccountSettingsLink />
                            {!hasClub && <Link to="/my-club" className="gk-menu__item gk-menu__item--accent"><Shield aria-hidden="true" />{copy('Find or start your club', 'იპოვეთ ან შექმენით კლუბი')}</Link>}
                        </div>
                        <PinsPanel state={pins} page={{ ...page, title }} work={work} titleId={`${id}-pins`} hint={copy('Pages you open often, one tap away.', 'ხშირად გამოყენებული გვერდები, ერთი შეხებით.')} onNavigate={() => close(false)} />
                        <div className="gk-you__account gk-you__account--settings">
                            <AccountItems {...account} workspaces={extraWorkspaces} close={close} menu={false} profile={false} createPage={false} accountSettings={false} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
