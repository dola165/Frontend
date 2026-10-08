import { workspaceAreas } from '../../features/clubOperations/workspaceStructure';
import { MediaImage } from '../ui/MediaImage';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BellRing, X, ChevronDown, LayoutDashboard, ClipboardList, Search, Pin, Users, Goal, Bus, Compass, BriefcaseBusiness, Settings2 } from 'lucide-react';
import { clubRoleLabel, type ClubManagementOverview } from '../../features/clubs/domain';
import type { TabItem, WorkspaceTab } from './types';
import { useDialogFocus } from './useDialogFocus';
import { resolveMediaUrl } from '../../utils/resolveMediaUrl';

interface WorkspaceSidebarProps {
    clubId: number;
    overview: ClubManagementOverview | null;
    activeTab: WorkspaceTab;
    tabs: TabItem[];
    shortcuts?: string[];
    unreadInboxCount: number;
    clubName?: string | null;
    clubLogoUrl?: string | null;
    mobileOpen: boolean;
    onTabChange: (tab: WorkspaceTab) => void;
    onNavigate: (path: string) => void;
    onClose: () => void;
    showHidden?: boolean;
    hasHidden?: boolean;
    onShowHidden?: (value: boolean) => void;
}

export const WorkspaceSidebar = ({
    clubId, overview, activeTab, tabs, unreadInboxCount, clubName, clubLogoUrl, mobileOpen,
    onTabChange, onNavigate, onClose, showHidden, hasHidden, onShowHidden, shortcuts,
}: WorkspaceSidebarProps) => (
    <SidebarContent
        clubId={clubId}
        overview={overview}
        activeTab={activeTab}
        tabs={tabs}
        shortcuts={shortcuts}
        unreadInboxCount={unreadInboxCount}
        clubName={clubName}
        clubLogoUrl={clubLogoUrl}
        mobileOpen={mobileOpen}
        onTabChange={onTabChange}
        onNavigate={onNavigate}
        onClose={onClose}
        showHidden={showHidden}
        hasHidden={hasHidden}
        onShowHidden={onShowHidden}
    />
);

const areaIcons = { football: Goal, people: Users, operations: Bus, recruitment: Compass, business: BriefcaseBusiness, settings: Settings2 };

const SidebarContent = ({
    clubId, overview, activeTab, tabs, unreadInboxCount, clubName, clubLogoUrl, mobileOpen,
    onTabChange, onNavigate, onClose, shortcuts,
}: WorkspaceSidebarProps) => {
    const { t } = useTranslation();
    const sidebarRef = useRef<HTMLElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const resolvedClubLogoUrl = resolveMediaUrl(clubLogoUrl);
    const [clubLogoFailedUrl, setClubLogoFailedUrl] = useState<string | null>(null);
    useDialogFocus(mobileOpen, sidebarRef, onClose, closeRef);
    const groups=workspaceAreas.map(area=>({...area,items:area.tabs.map(id=>tabs.find(t=>t.id===id)).filter((t):t is TabItem=>Boolean(t))})).filter(a=>a.items.length);
    const currentArea=groups.find(a=>a.items.some(t=>t.id===activeTab));
    const [expanded,setExpanded]=useState<{tab:string;area:string}|null>(null);
    const openArea=expanded?.tab===activeTab?expanded.area:currentArea?.id;
    const go=(tab:WorkspaceTab)=>{onTabChange(tab);onClose();};
    const item=(tab:TabItem)=>{const Icon=tab.icon;return <button type="button" key={tab.id} aria-current={activeTab===tab.id?'page':undefined} onClick={()=>go(tab.id)}><Icon size={16}/><span>{tab.label}</span>{tab.badge&&<span className="work-nav-count">{tab.badge}</span>}</button>;};

    return <>
    {mobileOpen && <button type="button" aria-label={t('clubWorkspace.closeNavigation')} onClick={onClose} className="workspace-sidebar-backdrop" />}
    <aside ref={sidebarRef} id="workspace-navigation" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen ? true : undefined} aria-label="Club workspace navigation" className={`workspace-sidebar flex w-[210px] shrink-0 flex-col border-r border-[var(--fc-border)] bg-[var(--fc-sidebar-bg)] ${mobileOpen ? 'is-open' : ''}`}>
        {/* Header */}
        <div className="work-club-identity border-b border-[var(--fc-border)] px-3 py-4">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => { onNavigate(`/clubs/${clubId}`); onClose(); }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--fc-text-muted)] hover:text-[var(--fc-text-primary)] transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t('clubWorkspace.backToClub')}
                </button>
                <button ref={closeRef} type="button" onClick={onClose} aria-label={t('clubWorkspace.closeNavigation')} className="workspace-mobile-only rounded-lg p-1.5 text-[var(--fc-text-muted)] hover:bg-[var(--fc-surface-hover)] hover:text-[var(--fc-text-primary)]">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="mt-3 flex min-w-0 items-center gap-2.5">
                {resolvedClubLogoUrl && clubLogoFailedUrl !== resolvedClubLogoUrl ? (
                    <MediaImage src={resolvedClubLogoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" onError={() => setClubLogoFailedUrl(resolvedClubLogoUrl)} />
                ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--fc-accent-soft)] text-xs font-bold text-[var(--fc-accent)]">
                        {(clubName || 'C').charAt(0).toUpperCase()}
                    </span>
                )}
                <div className="min-w-0">
                    <p className="work-club-name text-sm font-semibold text-[var(--fc-text-primary)]">{clubName || `Club #${clubId}`}</p>
                    <p className="truncate text-[11px] font-medium text-[var(--fc-text-muted)]">{overview?.currentUserRole ? clubRoleLabel(overview.currentUserRole) : t('clubWorkspace.workspace')}</p>
                </div>
            </div>

        </div>

        <nav className="work-navigation" aria-label="Workspace sections">
            {tabs.some(t=>t.id==='overview')&&item({id:'overview',label:'Overview',icon:LayoutDashboard})}
            {tabs.some(t=>t.id==='actions')&&item({id:'actions',label:'Work queue',icon:ClipboardList})}
            {overview&&['OWNER','CLUB_ADMIN','COACH'].includes(overview.currentUserRole??'')&&item({id:'inbox',label:'Inbox',icon:BellRing,badge:unreadInboxCount?String(unreadInboxCount):null})}
            {Boolean(shortcuts?.length)&&<><p className="work-nav-caption">Your shortcuts</p>{shortcuts?.map(id=>tabs.find(t=>t.id===id)).filter((t):t is TabItem=>Boolean(t)).map(t=>item({...t,icon:Pin}))}</>}
            <p className="work-nav-caption">Club workspace</p>
            {groups.map(area=>{const Icon=areaIcons[area.id as keyof typeof areaIcons];const isOpen=openArea===area.id;return <div key={area.id} data-work-area={area.id}>
                <button type="button" className="work-nav-group" aria-expanded={isOpen} aria-controls={`work-nav-${area.id}`} onClick={()=>setExpanded({tab:activeTab,area:isOpen?'':area.id})}><Icon size={17} aria-hidden="true"/><span>{area.label}</span><ChevronDown className="work-nav-chevron" size={14} aria-hidden="true"/></button>
                <div id={`work-nav-${area.id}`} className="work-nav-disclosure" data-open={isOpen} inert={!isOpen} aria-hidden={!isOpen}><div><div className="work-nav-children">{area.items.map(item)}</div></div></div>
            </div>;})}
            <div className="work-nav-footer"><button type="button" aria-current={activeTab==='tools'?'page':undefined} onClick={()=>go('tools')}><Search size={16}/><span>All tools</span></button></div>
        </nav>
    </aside>
    </>;
};
