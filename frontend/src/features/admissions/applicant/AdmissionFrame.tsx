import type { ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { playerPath, usePlayerSelection } from '../../parents/playerSelection';
import { ArrowLeft, ArrowUpRight, HeartHandshake, LayoutDashboard, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import './applicant.css';

export interface AdmissionTab { id: string; label: string; count?: number }
export function AdmissionSection({ active, children }: { active: boolean; children: ReactNode }) {
    return <div className="admission-section admission-stack" hidden={!active}>{children}</div>;
}
export function AdmissionFrame({ title, description, children, back, tabs, activeTab = 'overview', action }: {
    title: string; description?: string; children: ReactNode; back?: string; tabs?: AdmissionTab[]; activeTab?: string; action?: ReactNode;
}) {
    const copy = useJourneyCopy();
    const location = useLocation();
    const [params] = useSearchParams();
    const { requestedPlayerId } = usePlayerSelection();
    const tabPath = (id: string) => { const next = new URLSearchParams(params); if (id === 'overview') next.delete('tab'); else next.set('tab', id); return `${location.pathname}${next.size ? '?' + next : ''}`; };
    const destinations = [
        { path: '/admissions', label: copy('Joining football', 'ფეხბურთში მონაწილეობა'), Icon: LayoutDashboard, active: location.pathname.startsWith('/admissions') },
        { path: '/map', label: copy('Find groups', 'ჯგუფების მოძებნა'), Icon: MapPin, active: location.pathname === '/map' },
        { path: '/parent', label: copy('Parent Hub', 'მშობლის სივრცე'), Icon: HeartHandshake, active: location.pathname === '/parent' },
    ];
    return <main className="admission-applicant admission-workspace">
        <aside className="admission-workspace-rail"><p className="admission-rail-label">{copy('Your football', 'თქვენი ფეხბურთი')}</p>
            <nav aria-label={copy('Football workspace', 'საფეხბურთო სივრცე')}>{destinations.map(item => <Link key={item.path} to={playerPath(item.path, requestedPlayerId)} aria-current={item.active ? 'page' : undefined}><item.Icon size={18} aria-hidden="true" /><span>{item.label}</span></Link>)}</nav>
            <Link className="admission-rail-home" to="/home">{copy('Back to Home', 'მთავარზე დაბრუნება')}<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </aside>
        <div className="admission-workspace-main">
            <div className="admission-breadcrumb">{back ? <Link className="admission-back" to={playerPath(back, requestedPlayerId)}><ArrowLeft size={15} aria-hidden="true" />{copy('Back', 'უკან')}</Link> : <span>{copy('Your football', 'თქვენი ფეხბურთი')}</span>}</div>
            <header className="admission-page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="admission-heading-action">{action}</div>}</header>
            {tabs && <nav className="admission-view-tabs" aria-label={copy('Page sections', 'გვერდის სექციები')}>{tabs.map(item => <Link key={item.id} to={tabPath(item.id)} aria-current={activeTab === item.id ? 'page' : undefined}>{item.label}{item.count !== undefined && <span className="admission-tab-count">{item.count}</span>}</Link>)}</nav>}
            <div className="admission-page-content">{children}</div>
        </div>
    </main>;
}
export function AdmissionLoading() {
    const copy = useJourneyCopy();
    return <p className="admission-loading" role="status"><Loader2 className="animate-spin" size={20}/>{copy('Loading joining arrangements…', 'მონაწილეობის პირობები იტვირთება…')}</p>;
}
export function AdmissionError({ message, retry }: { message: string; retry?: () => void }) {
    const copy = useJourneyCopy();
    return <div className="admission-error" role="alert"><p>{message}</p>{retry && <button className="admission-button" onClick={retry}><RefreshCw size={16}/>{copy('Try again', 'ხელახლა ცდა')}</button>}</div>;
}
