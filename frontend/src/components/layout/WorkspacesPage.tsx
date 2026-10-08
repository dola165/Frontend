import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Building2, CalendarDays, Check, ChevronDown, Clock3, Flag, Inbox, LayoutGrid, MapPin, RefreshCw, Search, Settings2, Shield, Trophy, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { requestDestination } from '../../features/requests/api';
import { formatDate } from '../../utils/formatting';
import { connectedWorkspaces, type ConnectedWorkspace } from './connectedWorkspaces';
import { eventWhen, useWorkspaceBriefing } from './workspaceBriefing';
import './my-work.css';

const icons: Record<ConnectedWorkspace['group'], LucideIcon> = { Clubs: Shield, 'Personal work': LayoutGrid, Teams: Users, Organizations: Building2, Venues: MapPin, Tournaments: Trophy };
const groups: ConnectedWorkspace['group'][] = ['Clubs', 'Teams', 'Personal work', 'Organizations', 'Venues', 'Tournaments'];
const schedulePreviewCount = 2;
const secondary = (work: ConnectedWorkspace) => ['club.work', 'admin.console'].includes(work.key.split(':')[0]);

function WorkspaceRow({ work }: { work: ConnectedWorkspace }) {
    const Icon = icons[work.group];
    return <div data-place-group={work.group} className={`mw-place${work.group === 'Teams' ? ' mw-team' : ''}`}><Link to={work.path}><span className="mw-place-icon"><Icon size={19} aria-hidden="true"/></span>
        <span className="mw-place-copy"><strong>{work.label}</strong><small>{work.description}</small></span><ArrowRight className="mw-place-arrow" size={17} aria-hidden="true"/>
        {work.group === 'Teams' && <span className="mw-team-footer">Open squad hub<ArrowRight size={14} aria-hidden="true"/></span>}</Link>
        {!!work.actions?.length && <div className="mw-place-actions">{work.actions.map(action => <Link key={action.path} to={action.path}>{action.label}</Link>)}</div>}
    </div>;
}

export function WorkspacesPage() {
    const { user, sessionId } = useAuth();
    return user ? <MyWork key={`${user.id}:${sessionId}`} /> : null;
}
function MyWork() {
    const { user, sessionId, refreshNavigationCapabilities } = useAuth(), location = useLocation();
    const [revision, setRevision] = useState(0), [query, setQuery] = useState('');
    const refreshedAt = useRef(0);
    const briefing = useWorkspaceBriefing(sessionId, user?.navigationCapabilities, revision);
    const connections = connectedWorkspaces(user?.navigationCapabilities), main = connections.filter(work => !secondary(work));
    const manage = connections.filter(secondary);
    const showSearch = main.length > 6 || query.length > 0;
    const tournamentFocus = new URLSearchParams(location.search).get('area') === 'tournaments';
    const ordered = tournamentFocus ? ['Tournaments' as const, ...groups.filter(group => group !== 'Tournaments')] : groups;
    const visible = main.filter(work => `${work.label} ${work.description} ${work.group}`.toLowerCase().includes(query.trim().toLowerCase()));
    const requests = briefing.requests, requestLoading = !requests && !briefing.requestsFailed;
    const partialRequests = !!requests?.unavailableSources.length;
    const pending = requests?.counts.actionable ?? 0;
    const items = requests?.items.filter(item => item.actionable).slice(0, 3) ?? [];
    const busy = briefing.loading || requestLoading;
    const refresh = () => { refreshedAt.current = Date.now(); setRevision(value => value + 1); void refreshNavigationCapabilities().catch(() => {}); };
    useEffect(() => {
        refreshedAt.current = Date.now();
        const onReturn = () => {
            if (!document.hidden && Date.now() - refreshedAt.current > 30000) {
                refreshedAt.current = Date.now(); setRevision(value => value + 1);
                void refreshNavigationCapabilities().catch(() => {});
            }
        };
        window.addEventListener('focus', onReturn); document.addEventListener('visibilitychange', onReturn);
        return () => { window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onReturn); };
    }, [refreshNavigationCapabilities]);
    return <main className="my-work-page">
        <header className="mw-heading"><div><p className="mw-eyebrow">Your football work</p><h1>My work</h1><p>Your day, your teams, and the places you work.</p></div>
            <div className="mw-heading-actions"><span>{formatDate(briefing.now, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <button type="button" onClick={refresh} disabled={busy} aria-label="Refresh my work"><RefreshCw size={16} aria-hidden="true"/>Refresh</button></div>
        </header>
        <div className="mw-briefing">
            <section className={`mw-panel mw-attention${pending ? ' has-pending' : ''}${!pending && !partialRequests && !requestLoading && !briefing.requestsFailed ? ' is-clear' : ''}`} aria-labelledby="mw-attention-title">
                <header className="mw-panel-heading"><h2 id="mw-attention-title"><Inbox size={18} aria-hidden="true"/>Needs your attention</h2><Link to="/requests?view=INCOMING">Requests<ArrowRight size={15} aria-hidden="true"/></Link></header>
                <p className="mw-panel-caption">Incoming approvals and invitations</p>
                {requestLoading ? <p className="mw-state" role="status">Checking your requests…</p> : briefing.requestsFailed ? <div className="mw-state" role="alert"><strong>Requests couldn’t load</strong><p>Open Requests or try again to check what’s waiting.</p><button onClick={refresh} disabled={busy}>Try again</button></div> : <>
                    <div className="mw-attention-summary"><span className={`mw-summary-icon${pending ? ' is-pending' : ''}`}>{pending ? <Inbox size={24} aria-hidden="true"/> : <Check size={24} aria-hidden="true"/>}</span>
                        <div><strong>{pending ? `${partialRequests ? 'At least ' : ''}${pending} ${pending === 1 ? 'request needs' : 'requests need'} a decision` : partialRequests ? 'Some requests are unavailable' : 'No requests awaiting your decision'}</strong>
                            <p>{pending ? 'Invitations and approvals across your responsibilities.' : partialRequests ? 'Check Requests for the available information.' : 'New invitations and approvals will appear here.'}</p></div></div>
                    {items.map(item => <Link className="mw-request-row" to={requestDestination(item.destination) ?? '/requests?view=INCOMING'} key={item.key}><span><strong>{item.title}</strong><small>{item.context}</small></span><ArrowRight size={15} aria-hidden="true"/></Link>)}
                    {pending > items.length && <Link className="mw-text-link" to="/requests?view=INCOMING">Review all decisions<ArrowRight size={15} aria-hidden="true"/></Link>}
                    {partialRequests && <p className="mw-source-note" role="status">Some request sources couldn’t load. <button onClick={refresh} disabled={busy}>Try again</button></p>}
                    {requests && requests.counts.outgoing > 0 && <Link className="mw-waiting" to="/requests?view=OUTGOING">{requests.counts.outgoing} sent {requests.counts.outgoing === 1 ? 'request' : 'requests'} awaiting a response<ArrowRight size={14} aria-hidden="true"/></Link>}
                </>}
            </section>
            <section className="mw-panel mw-schedule" aria-labelledby="mw-schedule-title">
                <header className="mw-panel-heading"><h2 id="mw-schedule-title"><CalendarDays size={18} aria-hidden="true"/>Coming up</h2><Link to="/calendar">Schedule<ArrowRight size={15} aria-hidden="true"/></Link></header>
                <p className="mw-panel-caption">Next 7 days · personal and shared club activities</p>
                {briefing.loading ? <p className="mw-state" role="status">Loading your schedule…</p> : <>
                    {briefing.events.slice(0, schedulePreviewCount).map(event => <Link className="mw-event" to={event.path} key={event.key}><time dateTime={event.startsAt}><b>{formatDate(event.startsAt, { day: 'numeric' })}</b><span>{formatDate(event.startsAt, { month: 'short' })}</span></time>
                        <span className="mw-event-info"><span className="mw-event-time"><Clock3 size={12} aria-hidden="true"/>{eventWhen(event, briefing.now)}</span><strong>{event.title}</strong><small>{event.context}{event.location ? ` · ${event.location}` : ''}</small></span><ArrowRight size={15} aria-hidden="true"/></Link>)}
                    {!briefing.events.length && <div className="mw-state mw-empty"><CalendarDays size={25} aria-hidden="true"/><strong>{briefing.scheduleFailed.length ? 'Your schedule is partly unavailable' : 'Room for your next activity'}</strong><p>{briefing.scheduleFailed.length ? 'Open the schedule or retry the unavailable sources.' : 'No scheduled activities in the next 7 days. Plan something in your calendar.'}</p><Link to="/calendar">Open my schedule<ArrowRight size={15} aria-hidden="true"/></Link></div>}
                    {!!briefing.scheduleFailed.length && <p className="mw-source-note" role="status">Some schedules couldn’t load. <button onClick={refresh} disabled={busy}>Try again</button></p>}
                    {briefing.events.length > schedulePreviewCount && <Link className="mw-text-link" to="/calendar">Open the full schedule<ArrowRight size={15} aria-hidden="true"/></Link>}
                </>}
            </section>
        </div>
        <section className="mw-places" aria-labelledby="mw-places-title"><header className="mw-section-heading"><div><h2 id="mw-places-title">Your places</h2><p>Continue across your clubs, teams and appointments.</p></div><div className="mw-places-tools">
            {showSearch && <label className="mw-search"><Search size={16} aria-hidden="true"/><input aria-label="Find a workspace" placeholder="Find a workspace" value={query} onChange={event => setQuery(event.target.value)}/></label>}
            <details className="mw-manage" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); event.stopPropagation(); } }}><summary><Settings2 size={15} aria-hidden="true"/>Manage my work<ChevronDown size={15} aria-hidden="true"/></summary>
                <nav className="mw-manage-links" aria-label="Workspace management"><Link to={`/profile/${user?.id}`}>My profile<ArrowRight size={15} aria-hidden="true"/></Link><Link to="/account/roles">My football identities<ArrowRight size={15} aria-hidden="true"/></Link>{manage.map(work => <Link key={work.key} to={work.path}>{work.label}<ArrowRight size={15} aria-hidden="true"/></Link>)}
                    {user?.navigationCapabilities?.workspaces.some(work => work.id === 'organization.create') && <Link to="/organizations/create">Create an organization<ArrowRight size={15} aria-hidden="true"/></Link>}
                    <Link to="/requests?view=HISTORY">Request history<ArrowRight size={15} aria-hidden="true"/></Link><p className="mw-access-note">Access follows your approved appointments.</p></nav>
            </details></div></header>
            {ordered.map(group => { const work = visible.filter(item => item.group === group); return work.length > 0 && <section className={`mw-group${group === 'Teams' ? ' mw-group-teams' : ''}`} key={group} data-place-group={group} aria-label={group}><h3>{(() => { const Icon = icons[group]; return <Icon size={16} aria-hidden="true"/>; })()}{group === 'Teams' ? 'Teams & squads' : group}<span>{work.length}</span></h3><div className="mw-place-list">{work.slice(0, 3).map(item => <WorkspaceRow key={item.key} work={item}/>)}</div>
                {work.length > 3 && <details className="mw-more-places"><summary>Show {work.length - 3} more<ChevronDown size={15} aria-hidden="true"/></summary><div className="mw-place-list">{work.slice(3).map(item => <WorkspaceRow key={item.key} work={item}/>)}</div></details>}</section>; })}
            {!!main.length && !visible.length && <p className="mw-state" role="status">No places match “{query}”. Try a club or team name.</p>}
            {!main.length && <div className="mw-panel mw-new-connection"><Flag size={26} aria-hidden="true"/><h3>Find your next connection</h3><p>Clubs, teams and appointments appear here once your access is approved.</p><Link to="/clubs/following">Clubs I follow<ArrowRight size={15} aria-hidden="true"/></Link><Link to="/clubs">Explore clubs<ArrowRight size={15} aria-hidden="true"/></Link></div>}
        </section>
    </main>;
}
