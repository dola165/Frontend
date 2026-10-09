import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, LogOut, Moon, Settings, ShieldCheck, Sun } from 'lucide-react';
import { Avatar } from '../../../design/primitives';
import { hasNavigationCapability } from '../../../context/navigationCapabilities';
import type { AuthUser } from '../../../context/AuthContext';
import { useJourneyCopy } from '../../../features/squadCommunication/journeyCopy';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import type { ThemePreference } from '../../../theme';
import { moveMenuFocus, usePopover } from './usePopover';

interface AccountMenuProps { user: AuthUser; themePreference: ThemePreference; setThemePreference: (value: ThemePreference) => void; onLogout: () => void }

// Each language is named in itself, so a person can always find their own.
const languageNames: Record<string, string> = { en: 'English', ka: 'ქართული' };
const languageName = (code: string) => languageNames[code] ?? code.toUpperCase();

/** The person's own corner: profile, schedule, settings, appearance, language and signing out. */
export function AccountMenu({ user, themePreference, setThemePreference, onLogout }: AccountMenuProps) {
    const copy = useJourneyCopy();
    const { i18n } = useTranslation();
    const { open, toggle, close, triggerRef, panelRef, onKeyDown } = usePopover();
    const id = useId();
    const name = user.fullName || user.name || user.username || copy('Your profile', 'თქვენი პროფილი');
    const language = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];
    const languages = Object.keys(i18n.options.resources ?? { en: {}, ka: {} });
    const dark = themePreference !== 'light';
    const select = (action: () => void) => () => { action(); close(); };

    return (
        <div className="gk-hanchor" onKeyDown={onKeyDown}>
            <button ref={triggerRef} type="button" className="gk-hbtn gk-hbtn--avatar" aria-haspopup="menu" aria-expanded={open}
                aria-controls={open ? id : undefined} aria-label={copy(`Account menu for ${name}`, `ანგარიშის მენიუ: ${name}`)} title={name} onClick={toggle}>
                <Avatar src={resolveMediaUrl(user.avatarUrl)} name={name} size={34} />
            </button>
            {open && (
                <div ref={panelRef} id={id} role="menu" aria-label={copy('Account', 'ანგარიში')} className="gk-pop gk-pop--menu" onKeyDown={moveMenuFocus}>
                    <Link role="menuitem" to={`/profile/${user.id}`} className="gk-menu__item gk-menu__profile">
                        <Avatar src={resolveMediaUrl(user.avatarUrl)} name={name} size={36} />
                        <span className="gk-menu__profile-text"><strong>{name}</strong><span>{copy('View your profile', 'პროფილის ნახვა')}</span></span>
                    </Link>
                    <Link role="menuitem" to="/calendar" className="gk-menu__item"><CalendarDays aria-hidden="true" />{copy('My schedule', 'ჩემი განრიგი')}</Link>
                    <Link role="menuitem" to="/account" className="gk-menu__item"><Settings aria-hidden="true" />{copy('Account & settings', 'ანგარიში და პარამეტრები')}</Link>
                    {hasNavigationCapability(user.navigationCapabilities, 'admin.console') && (
                        <Link role="menuitem" to="/admin" className="gk-menu__item"><ShieldCheck aria-hidden="true" />{copy('Administration', 'ადმინისტრირება')}</Link>
                    )}
                    <div className="gk-menu__sep" role="separator" />
                    <p className="gk-menu__label" id={`${id}-theme`}>{copy('Appearance', 'იერსახე')}</p>
                    <div className="gk-segment" role="group" aria-labelledby={`${id}-theme`}>
                        <button type="button" role="menuitemradio" aria-checked={dark} className="gk-menu__item" onClick={select(() => setThemePreference('map-light'))}><Moon aria-hidden="true" />{copy('Dark', 'მუქი')}</button>
                        <button type="button" role="menuitemradio" aria-checked={!dark} className="gk-menu__item" onClick={select(() => setThemePreference('light'))}><Sun aria-hidden="true" />{copy('Light', 'ღია')}</button>
                    </div>
                    <p className="gk-menu__label" id={`${id}-language`}>{copy('Language', 'ენა')}</p>
                    <div className="gk-segment" role="group" aria-labelledby={`${id}-language`}>
                        {languages.map(code => (
                            <button key={code} type="button" role="menuitemradio" aria-checked={language === code} lang={code} className="gk-menu__item" onClick={select(() => void i18n.changeLanguage(code))}>
                                {languageName(code)}
                            </button>
                        ))}
                    </div>
                    <div className="gk-menu__sep" role="separator" />
                    <button type="button" role="menuitem" className="gk-menu__item gk-menu__item--danger" onClick={() => { close(false); onLogout(); }}>
                        <LogOut aria-hidden="true" />{copy('Sign out', 'გასვლა')}
                    </button>
                </div>
            )}
        </div>
    );
}
