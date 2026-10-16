import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, LogOut, Moon, Settings, ShieldCheck, Sun } from 'lucide-react';
import { Avatar } from '../../../design/primitives';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import type { AuthUser } from '../../../context/AuthContext';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import { CreateLink } from '../../../features/pages/create/CreateLink';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { ThemePreference } from '../../../theme';
import { PinGlyph } from './pins/PinsPanel';
import type { WorkPlace } from './pins/pinCatalog';
import { moveMenuFocus, openMenuFromKey, usePopover } from './usePopover';
import { personName, useInOwnPlace } from './account';

export interface AccountProps {
    user: AuthUser;
    /** Squads, tournaments, organizations, venues and hubs the person works in, other than the My Club tab. */
    workspaces: WorkPlace[];
    themePreference: ThemePreference;
    setThemePreference: (value: ThemePreference) => void;
    onLogout: () => void;
}

// Each language is named in itself, so a person can always find their own.
const languageNames: Record<string, string> = { en: 'English', ka: 'ქართული' };
const languageName = (code: string) => languageNames[code] ?? code.toUpperCase();

/**
 * Profile, schedule, settings, workspaces, appearance, language and signing out: the desktop account menu (as menu
 * items) and the phone's "You" sheet (as plain links and toggles) list the same things.
 */
export function AccountItems({ user, workspaces, themePreference, setThemePreference, onLogout, close, menu, profile = true, createPage = true }: AccountProps & {
    close: (returnFocus?: boolean) => void; menu: boolean; profile?: boolean; createPage?: boolean;
}) {
    const copy = useJourneyCopy();
    const { i18n } = useTranslation();
    const { pathname } = useLocation();
    const id = useId();
    const name = personName(user, copy);
    const language = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
    const languages = Object.keys(i18n.options?.resources ?? { en: {}, ka: {} });
    const dark = themePreference !== 'light';
    const select = (action: () => void) => () => { action(); close(); };
    const item = menu ? 'menuitem' : undefined;
    const choice = (checked: boolean) => menu ? { role: 'menuitemradio', 'aria-checked': checked } : { 'aria-pressed': checked };
    return (
        <>
            {profile && <Link role={item} to={`/profile/${user.id}`} className="gk-menu__item gk-menu__profile">
                <Avatar src={resolveMediaUrl(user.avatarUrl)} name={name} size={36} />
                <span className="gk-menu__profile-text"><strong>{name}</strong><span>{copy('View your profile', 'პროფილის ნახვა')}</span></span>
            </Link>}
            <Link role={item} to={`/profile/${user.id}?tab=schedule`} className="gk-menu__item"><CalendarDays aria-hidden="true" />{copy('My schedule', 'ჩემი განრიგი')}</Link>
            <Link role={item} to="/account" className="gk-menu__item"><Settings aria-hidden="true" />{copy('Account & settings', 'ანგარიში და პარამეტრები')}</Link>
            {hasNavigationCapability(user.navigationCapabilities, 'admin.console') && (
                <Link role={item} to="/admin" className="gk-menu__item"><ShieldCheck aria-hidden="true" />{copy('Administration', 'ადმინისტრირება')}</Link>
            )}
            {createPage && <CreateLink role={item} variant="menu" from="account" onClick={() => close()}>{copy('Create a page', 'გვერდის შექმნა')}</CreateLink>}
            {workspaces.length > 0 && (
                <>
                    <div className="gk-menu__sep" role="separator" />
                    <div role="group" aria-labelledby={`${id}-work`}>
                        <p className="gk-menu__label" id={`${id}-work`}>{copy('Your workspaces', 'თქვენი სამუშაო სივრცეები')}</p>
                        {workspaces.map(place => (
                            <Link key={place.path} role={item} to={place.path} className="gk-menu__item gk-menu__item--work" aria-current={pathname === place.path.split('?')[0] ? 'page' : undefined}>
                                <PinGlyph icon={place.icon} /><span className="gk-menu__work"><span>{place.label}</span><span>{place.kind}</span></span>
                            </Link>
                        ))}
                    </div>
                </>
            )}
            <div className="gk-menu__sep" role="separator" />
            <p className="gk-menu__label" id={`${id}-theme`}>{copy('Appearance', 'იერსახე')}</p>
            <div className="gk-segment" role="group" aria-labelledby={`${id}-theme`}>
                <button type="button" {...choice(dark)} className="gk-menu__item" onClick={select(() => setThemePreference('map-light'))}><Moon aria-hidden="true" />{copy('Dark', 'მუქი')}</button>
                <button type="button" {...choice(!dark)} className="gk-menu__item" onClick={select(() => setThemePreference('light'))}><Sun aria-hidden="true" />{copy('Light', 'ღია')}</button>
            </div>
            <p className="gk-menu__label" id={`${id}-language`}>{copy('Language', 'ენა')}</p>
            <div className="gk-segment" role="group" aria-labelledby={`${id}-language`}>
                {languages.map(code => (
                    <button key={code} type="button" {...choice(language === code)} lang={code} className="gk-menu__item" onClick={select(() => void i18n.changeLanguage(code))}>
                        {languageName(code)}
                    </button>
                ))}
            </div>
            <div className="gk-menu__sep" role="separator" />
            <button type="button" role={item} className="gk-menu__item gk-menu__item--danger" onClick={() => { close(false); onLogout(); }}>
                <LogOut aria-hidden="true" />{copy('Sign out', 'გასვლა')}
            </button>
        </>
    );
}

/** Wide screens: the person's own corner as a menu under the avatar. On a phone the avatar opens "You" instead. */
export function AccountMenu(props: AccountProps) {
    const copy = useJourneyCopy();
    const { open, toggle, show, close, triggerRef, panelRef, onKeyDown } = usePopover();
    const id = useId();
    const name = personName(props.user, copy);
    const inOwnPlace = useInOwnPlace(props.user.id);

    return (
        <div className="gk-hanchor gk-header__account" onKeyDown={onKeyDown}>
            <button ref={triggerRef} type="button" className="gk-hbtn gk-hbtn--avatar" data-current={inOwnPlace || undefined} aria-haspopup="menu" aria-expanded={open}
                aria-controls={open ? id : undefined} aria-label={copy(`Account menu for ${name}`, `ანგარიშის მენიუ: ${name}`)} title={name} onClick={toggle}
                onKeyDown={event => openMenuFromKey(event, show)}>
                <Avatar src={resolveMediaUrl(props.user.avatarUrl)} name={name} size={34} />
            </button>
            {open && (
                <div ref={panelRef} id={id} role="menu" tabIndex={-1} aria-label={copy('Account', 'ანგარიში')} className="gk-pop gk-pop--menu" onKeyDown={moveMenuFocus}>
                    <AccountItems {...props} close={close} menu />
                </div>
            )}
        </div>
    );
}
