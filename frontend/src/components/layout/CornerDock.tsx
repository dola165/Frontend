import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DO_PARAM } from '../../features/actions/registry';
import { CREATE_PARAM } from '../../features/pages/create/entry';
import { WELCOME_PARAM } from '../../features/start/welcomeSteps';
import './corner-dock.css';

/** Address keys that open something over the page: the welcome, an action's flow, the start sheet. */
const OVER_PAGE = [WELCOME_PARAM, DO_PARAM, CREATE_PARAM];

/**
 * The app frame's one floating corner: bottom right on a wide screen, above the tab bar on a phone. One thing lives
 * here at a time: today "Your first week", later the Dola guide. It stays empty while something is open over the page
 * (the welcome, an action's flow, the start sheet, any dialog) and while the page-creation fox is out (`corner-dock.css`).
 */
export function CornerDock({ children }: { children: ReactNode }) {
    const params = new URLSearchParams(useLocation().search);
    if (OVER_PAGE.some(key => params.has(key))) return null;
    return <div className="gk gk-corner">{children}</div>;
}
