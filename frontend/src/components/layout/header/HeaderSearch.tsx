import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { GlobalSearchBar } from '../../search/GlobalSearchBar';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import { usePopover } from './usePopover';

/** The global search: a field on wide screens, an icon that opens the same search below the header elsewhere. */
export function HeaderSearch({ light }: { light: boolean }) {
    const copy = useJourneyCopy();
    const { open, toggle, close, triggerRef, panelRef, onKeyDown } = usePopover('first');
    const id = useId();
    return (
        <>
            <div className="gk-header__search"><GlobalSearchBar light={light} className="relative flex w-full min-w-0" /></div>
            <button ref={triggerRef} type="button" className="gk-hbtn gk-header__search-toggle" aria-label={copy('Search', 'ძიება')} title={copy('Search', 'ძიება')}
                aria-expanded={open} aria-controls={open ? id : undefined} onClick={toggle}>
                <Search aria-hidden="true" />
            </button>
            {open && (
                <div ref={panelRef} id={id} role="search" className="gk-header__search-bar" onKeyDown={onKeyDown}>
                    <GlobalSearchBar light={light} mobile />
                    <button type="button" className="gk-hbtn" aria-label={copy('Close search', 'ძიების დახურვა')} onClick={() => close()}><X aria-hidden="true" /></button>
                </div>
            )}
        </>
    );
}
