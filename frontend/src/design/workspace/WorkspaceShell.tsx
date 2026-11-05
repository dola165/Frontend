import './workspace-shell.css';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Eye, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Avatar, GkRoot } from '../primitives';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';
import { useCopy } from '../../locales/useCopy';
import { workspaceShellEn } from '../../locales/workspaceDesign';

/** `view` marks a destination the person can read but not change; the rail shows it as a small eye. */
export interface WorkspaceNavItem { id: string; label: string; icon: LucideIcon; count?: number; view?: boolean }
export interface WorkspaceContext { name: string; crest?: string | null; role?: ReactNode; back?: { label: string; to: string } }

interface WorkspaceShellProps {
    /** Accessible name of the workspace, for example "Club workspace". */
    label: string;
    context: WorkspaceContext;
    /** The workspace's places, at the top of the rail. */
    primary: WorkspaceNavItem[];
    /** Quieter places under a thin line, such as Club office's More tools. */
    quiet?: WorkspaceNavItem[];
    footer?: WorkspaceNavItem[];
    active: string;
    onSelect: (id: string) => void;
    /** Builds a real URL for each destination so links can be opened in a new tab. */
    hrefFor?: (id: string) => string;
    /** Title of the current section, shown in the phone header. */
    sectionTitle: string;
    /** Separates the collapsed preference between workspaces. */
    storageKey: string;
    /**
     * Runs before any link in the shell leaves the page (the context's back link), so open editors can ask about
     * unsaved work first. It receives the navigation and calls it when allowed. Rail items go through `onSelect`.
     */
    guard?: (proceed: () => void) => void;
    /** The page is a full canvas under the app header (no padded page frame around it), so the shell fills it all. */
    canvas?: boolean;
    /** Small actions at the top right of every page of this workspace. */
    actions?: ReactNode;
    children: ReactNode;
}

const readCollapsed = (key: string) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const countLabel = (count?: number) => (count ? (count > 99 ? '99+' : String(count)) : null);
const plainClick = (event: MouseEvent<HTMLAnchorElement>) => !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * One frame for every job page (owner, 28 October 2026): a left rail with the way back, the crest and the person's
 * job, the page's places, quieter places under a thin line and the calendar at the bottom (collapsible to icons),
 * then the content. On phones the rail becomes a drawer behind a header that names the current place.
 */
export function WorkspaceShell({ label, context, primary, quiet = [], footer = [], active, onSelect, hrefFor, sectionTitle, storageKey, guard, canvas, actions, children }: WorkspaceShellProps) {
    const copy = useCopy('workspaceShell', workspaceShellEn);
    const navigate = useNavigate();
    const collapseKey = `gk-ws-collapsed:${storageKey}`;
    const [collapsed, setCollapsed] = useState(() => readCollapsed(collapseKey));
    const [drawerOpen, setDrawerOpen] = useState(false);
    const railRef = useRef<HTMLElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    useDialogFocus(drawerOpen, railRef, () => setDrawerOpen(false), closeRef);

    const toggleCollapsed = () => setCollapsed(value => {
        try { localStorage.setItem(collapseKey, value ? '0' : '1'); } catch { /* The rail still works without a saved preference. */ }
        return !value;
    });
    const select = (id: string) => { onSelect(id); setDrawerOpen(false); };

    const renderItem = (item: WorkspaceNavItem) => {
        const Icon = item.icon, current = item.id === active, count = countLabel(item.count);
        const body = <><Icon aria-hidden="true" /><span className="gk-ws__item-label">{item.label}</span>
            {item.view && <Eye className="gk-ws__view" role="img" aria-label={copy('viewOnly')} />}
            {count && <span className="gk-ws__count" aria-label={copy('waiting', { count: item.count! })}>{count}</span>}</>;
        const common = { className: 'gk-ws__item', 'aria-current': current ? 'page' as const : undefined, title: collapsed ? item.label : undefined };
        if (hrefFor) {
            const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
                if (!plainClick(event)) return;
                event.preventDefault(); select(item.id);
            };
            return <li key={item.id}><a {...common} href={hrefFor(item.id)} onClick={onClick}>{body}</a></li>;
        }
        return <li key={item.id}><button type="button" {...common} onClick={() => select(item.id)}>{body}</button></li>;
    };

    const back = context.back;
    const leave = (event: MouseEvent<HTMLAnchorElement>) => {
        if (!guard || !back || !plainClick(event)) return;
        event.preventDefault();
        guard(() => { setDrawerOpen(false); navigate(back.to); });
    };

    return <GkRoot className="gk-ws" data-collapsed={collapsed || undefined} data-canvas={canvas || undefined}>
        {/* A tap outside closes the drawer; the backdrop stays interactive while the page behind it is inert. */}
        {drawerOpen && <div className="gk-ws__backdrop" data-dialog-backdrop="" aria-hidden="true" onClick={() => setDrawerOpen(false)} />}
        <aside ref={railRef} id={`gk-ws-rail-${storageKey}`} className="gk-ws__rail" data-open={drawerOpen || undefined}
            role={drawerOpen ? 'dialog' : undefined} aria-modal={drawerOpen || undefined} aria-label={copy('navigation', { name: label })}>
            <div className="gk-ws__context">
                {back && <Link className="gk-ws__back" to={back.to} onClick={leave} title={collapsed ? back.label : undefined}><ArrowLeft aria-hidden="true" /><span>{back.label}</span></Link>}
                <div className="gk-ws__identity">
                    <Avatar src={context.crest} name={context.name} size={36} square />
                    <div className="gk-ws__identity-text"><strong>{context.name}</strong>{context.role && <span>{context.role}</span>}</div>
                </div>
                <button ref={closeRef} type="button" className="gk-ws__close" aria-label={copy('closeNavigation')} onClick={() => setDrawerOpen(false)}><X aria-hidden="true" /></button>
            </div>
            <nav className="gk-ws__nav" aria-label={copy('sections', { name: label })}>
                <ul className="gk-ws__items gk-ws__items--primary">{primary.map(renderItem)}</ul>
                {quiet.length > 0 && <ul className="gk-ws__items gk-ws__items--quiet">{quiet.map(renderItem)}</ul>}
            </nav>
            {/* Outside the scrolling part, so the way out is always on screen whatever is open above. */}
            {footer.length > 0 && <ul className="gk-ws__items gk-ws__items--footer" aria-label={copy('sections', { name: label })}>{footer.map(renderItem)}</ul>}
            <button type="button" className="gk-ws__collapse" onClick={toggleCollapsed} aria-pressed={collapsed} title={collapsed ? copy('expandNavigation') : undefined}>
                {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}<span>{collapsed ? copy('expand') : copy('collapse')}</span>
            </button>
        </aside>
        <div className="gk-ws__main">
            <div className="gk-ws__bar">
                <button type="button" className="gk-btn gk-btn--secondary gk-btn--sm" aria-expanded={drawerOpen} aria-controls={`gk-ws-rail-${storageKey}`} aria-label={copy('menuLabel', { name: label })} onClick={() => setDrawerOpen(true)}><Menu aria-hidden="true" />{copy('menu')}</button>
                <div className="gk-ws__bar-title"><strong>{sectionTitle}</strong><span>{context.name}</span></div>
            </div>
            {actions && <div className="gk-ws__actions">{actions}</div>}
            {children}
        </div>
    </GkRoot>;
}
