import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Compass, UserPlus } from 'lucide-react';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import { exploreDestinations } from './pins/pinCatalog';
import { PinGlyph } from './pins/PinsPanel';
import { moveMenuFocus, openMenuFromKey, usePopover } from './usePopover';

const phoneLayout = () => typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 899px)').matches;

/**
 * Everything public in one menu for people who are not signed in: World's directories, then the places that
 * support clubs. On phones it also holds the language and "Create account", which have no room in the header.
 */
export function ExploreMenu() {
    const copy = useJourneyCopy();
    const { i18n } = useTranslation();
    const { pathname, search } = useLocation();
    const { open, toggle, show, close, triggerRef, panelRef, onKeyDown } = usePopover();
    const id = useId();
    const destinations = exploreDestinations(copy).filter(item => !item.signedIn && item.group !== 'more');
    const here = `${pathname}${search}`;
    const phone = open && phoneLayout();
    const georgian = (i18n.resolvedLanguage ?? i18n.language ?? 'en').startsWith('ka');
    const group = (key: 'world' | 'support', title: string) => (
        <div role="group" aria-labelledby={`${id}-${key}`}>
            <p className="gk-menu__label" id={`${id}-${key}`}>{title}</p>
            {destinations.filter(item => item.group === key).map(item => (
                <Link key={item.path} role="menuitem" to={item.path} className="gk-menu__item" aria-current={here === item.path || pathname === item.path ? 'page' : undefined}>
                    <PinGlyph icon={item.icon} />{item.label}
                </Link>
            ))}
        </div>
    );

    return (
        <div className="gk-hanchor" onKeyDown={onKeyDown}>
            <button ref={triggerRef} type="button" className="gk-hbtn gk-hbtn--text gk-header__explore" aria-haspopup="menu" aria-expanded={open}
                aria-controls={open ? id : undefined} aria-label={copy('Explore', 'აღმოაჩინეთ')} onClick={toggle} onKeyDown={event => openMenuFromKey(event, show)}>
                <Compass aria-hidden="true" /><span className="gk-hbtn__label">{copy('Explore', 'აღმოაჩინეთ')}</span><ChevronDown aria-hidden="true" className="gk-hbtn__chevron" />
            </button>
            {open && (
                <div ref={panelRef} id={id} role="menu" tabIndex={-1} aria-label={copy('Explore GrassKickZ', 'GrassKickZ-ის აღმოჩენა')} className="gk-pop gk-pop--menu gk-pop--start" onKeyDown={moveMenuFocus}>
                    {group('world', copy('GrassKickZ World', 'GrassKickZ მსოფლიო'))}
                    <div className="gk-menu__sep" role="separator" />
                    {group('support', copy('Support clubs', 'კლუბების მხარდაჭერა'))}
                    {phone && (
                        <>
                            <div className="gk-menu__sep" role="separator" />
                            <p className="gk-menu__label" id={`${id}-language`}>{copy('Language', 'ენა')}</p>
                            <div className="gk-segment" role="group" aria-labelledby={`${id}-language`}>
                                <button type="button" role="menuitemradio" aria-checked={!georgian} lang="en" className="gk-menu__item" onClick={() => { void i18n.changeLanguage('en'); close(); }}>English</button>
                                <button type="button" role="menuitemradio" aria-checked={georgian} lang="ka" className="gk-menu__item" onClick={() => { void i18n.changeLanguage('ka'); close(); }}>ქართული</button>
                            </div>
                            <Link role="menuitem" to="/signup" className="gk-menu__item gk-menu__item--accent"><UserPlus aria-hidden="true" />{copy('Create account', 'ანგარიშის შექმნა')}</Link>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
