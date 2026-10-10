import './workspace-shell.css';
import { useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Avatar, GkRoot } from '../primitives';
import { useDialogFocus } from '../../components/workspace/useDialogFocus';

export interface WorkspaceNavItem { id: string; label: string; icon: LucideIcon; count?: number }
export interface WorkspaceNavGroup { id: string; label: string; icon?: LucideIcon; items: WorkspaceNavItem[] }
export interface WorkspaceContext { name: string; crest?: string | null; role?: ReactNode; back?: { label: string; to: string } }

interface WorkspaceShellProps {
    /** Accessible name of the workspace, for example "Club workspace". */
    label: string;
    context: WorkspaceContext;
    /** Always-visible destinations at the top of the rail. */
    primary: WorkspaceNavItem[];
    /** Personal shortcuts, chosen by the person. */
    pinned?: WorkspaceNavItem[];
    /** Sections shown first, usually the ones the person's responsibilities need. */
    groups: WorkspaceNavGroup[];
    /** Everything else, one disclosure away. */
    more?: WorkspaceNavGroup[];
    footer?: WorkspaceNavItem[];
    active: string;
    onSelect: (id: string) => void;
    /** Builds a real URL for each destination so links can be opened in a new tab. */
    hrefFor?: (id: string) => string;
    /** Title of the current section, shown in the phone header. */
    sectionTitle: string;
    /** Separates the collapsed preference between workspaces. */
    storageKey: string;
    children: ReactNode;
}

const readCollapsed = (key: string) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
const countLabel = (count?: number) => (count ? (count > 99 ? '99+' : String(count)) : null);

/**
 * One layout for every workspace: a left rail with the context, primary destinations,
 * pins and grouped sections (collapsible to icons), and a content area. On phones the
 * rail becomes a drawer behind a header that names the current section.
 */
export function WorkspaceShell({ label, context, primary, pinned = [], groups, more = [], footer = [], active, onSelect, hrefFor, sectionTitle, storageKey, children }: WorkspaceShellProps) {
    const collapseKey = `gk-ws-collapsed:${storageKey}`;
    const [collapsed, setCollapsed] = useState(() => readCollapsed(collapseKey));
    const [drawerOpen, setDrawerOpen] = useState(false);
    const railRef = useRef<HTMLElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    useDialogFocus(drawerOpen, railRef, () => setDrawerOpen(false), closeRef);

    // Short navigation stays fully open; long navigation opens the section you are in.
    // A section the person opens or closes keeps that choice.
    const activeGroup = [...groups, ...more].find(group => group.items.some(item => item.id === active))?.id;
    const autoOpen = groups.reduce((total, group) => total + group.items.length, 0) <= 14;
    const [toggled, setToggled] = useState<Record<string, boolean>>({});
    const isOpen = (id: string) => toggled[id] ?? (autoOpen || id === activeGroup);
    const moreOpen = toggled['gk-ws-more'] ?? more.some(group => group.id === activeGroup);

    const toggleCollapsed = () => setCollapsed(value => {
        try { localStorage.setItem(collapseKey, value ? '0' : '1'); } catch { /* The rail still works without a saved preference. */ }
        return !value;
    });
    const toggleGroup = (id: string, open: boolean) => setToggled(previous => ({ ...previous, [id]: !open }));
    const select = (id: string) => { onSelect(id); setDrawerOpen(false); };

    const renderItem = (item: WorkspaceNavItem) => {
        const Icon = item.icon, current = item.id === active, count = countLabel(item.count);
        const body = <><Icon aria-hidden="true" /><span className="gk-ws__item-label">{item.label}</span>{count && <span className="gk-ws__count" aria-label={`${item.count} waiting`}>{count}</span>}</>;
        const common = { className: 'gk-ws__item', 'aria-current': current ? 'page' as const : undefined, title: collapsed ? item.label : undefined };
        if (hrefFor) {
            const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
                if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); select(item.id);
            };
            return <li key={item.id}><a {...common} href={hrefFor(item.id)} onClick={onClick}>{body}</a></li>;
        }
        return <li key={item.id}><button type="button" {...common} onClick={() => select(item.id)}>{body}</button></li>;
    };
    const renderGroup = (group: WorkspaceNavGroup, scope: string) => {
        const open = collapsed || isOpen(group.id);
        const listId = `gk-ws-${scope}-${group.id}`;
        return <div className="gk-ws__group" key={group.id}>
            <button type="button" className="gk-ws__group-toggle" aria-expanded={open} aria-controls={listId} onClick={() => toggleGroup(group.id, open)}>
                {group.icon && <group.icon aria-hidden="true" className="gk-ws__group-icon" />}<span>{group.label}</span><ChevronDown aria-hidden="true" className="gk-ws__chevron" />
            </button>
            <ul id={listId} className="gk-ws__items" hidden={!open} aria-label={group.label}>{group.items.map(renderItem)}</ul>
        </div>;
    };

    return <GkRoot className="gk-ws" data-collapsed={collapsed || undefined}>
        {drawerOpen && <button type="button" className="gk-ws__backdrop" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />}
        <aside ref={railRef} id={`gk-ws-rail-${storageKey}`} className="gk-ws__rail" data-open={drawerOpen || undefined}
            role={drawerOpen ? 'dialog' : undefined} aria-modal={drawerOpen || undefined} aria-label={`${label} navigation`}>
            <div className="gk-ws__context">
                {context.back && <Link className="gk-ws__back" to={context.back.to} title={collapsed ? context.back.label : undefined}><ArrowLeft aria-hidden="true" /><span>{context.back.label}</span></Link>}
                <div className="gk-ws__identity">
                    <Avatar src={context.crest} name={context.name} size={36} square />
                    <div className="gk-ws__identity-text"><strong>{context.name}</strong>{context.role && <span>{context.role}</span>}</div>
                </div>
                <button ref={closeRef} type="button" className="gk-ws__close" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}><X aria-hidden="true" /></button>
            </div>
            <nav className="gk-ws__nav" aria-label={`${label} sections`}>
                <ul className="gk-ws__items gk-ws__items--primary">{primary.map(renderItem)}</ul>
                {pinned.length > 0 && <div className="gk-ws__group"><p className="gk-ws__caption">Pinned</p><ul className="gk-ws__items" aria-label="Pinned">{pinned.map(renderItem)}</ul></div>}
                {groups.map(group => renderGroup(group, 'main'))}
                {more.length > 0 && !collapsed && <div className="gk-ws__more">
                    <button type="button" className="gk-ws__group-toggle" aria-expanded={moreOpen} aria-controls={`gk-ws-more-${storageKey}`} onClick={() => toggleGroup('gk-ws-more', moreOpen)}>
                        <span>More tools</span><ChevronDown aria-hidden="true" />
                    </button>
                    <div id={`gk-ws-more-${storageKey}`} hidden={!moreOpen}>{more.map(group => renderGroup(group, 'more'))}</div>
                </div>}
                {footer.length > 0 && <ul className="gk-ws__items gk-ws__items--footer">{footer.map(renderItem)}</ul>}
            </nav>
            <button type="button" className="gk-ws__collapse" onClick={toggleCollapsed} aria-pressed={collapsed} title={collapsed ? 'Expand navigation' : undefined}>
                {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}<span>{collapsed ? 'Expand' : 'Collapse'}</span>
            </button>
        </aside>
        <div className="gk-ws__main">
            <div className="gk-ws__bar">
                <button type="button" className="gk-btn gk-btn--secondary gk-btn--sm" aria-expanded={drawerOpen} aria-controls={`gk-ws-rail-${storageKey}`} aria-label={`${label} menu`} onClick={() => setDrawerOpen(true)}><Menu aria-hidden="true" />Menu</button>
                <div className="gk-ws__bar-title"><strong>{sectionTitle}</strong><span>{context.name}</span></div>
            </div>
            {children}
        </div>
    </GkRoot>;
}
