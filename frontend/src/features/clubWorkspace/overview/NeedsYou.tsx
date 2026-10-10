import type { ReactNode } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Button, EmptyNote, List, ListRow, Panel, Section, Skeleton, type BadgeTone } from '../../../design/primitives';
import { label, moduleNames } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { operationTab } from '../../clubOperations/workspaceNavigation';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { isFinished } from '../../clubOperations/records/recordStatus';
import type { ClubManagementOverview, PlayerAffiliationStatus } from '../../clubs/domain';
import { clubOverviewEn } from '../../../locales/clubOverview';
import { useCopy } from '../../../locales/useCopy';
import { useOverviewConsent } from './useOverviewConsent';
import { dueLabel } from '../fixtures';
import { useOutstandingWork } from './useOutstandingWork';
import { useNow } from '../useNow';
import '../club-workspace.css';

interface NeedItem { key: string; title: string; meta: string; badge: string; tone: BadgeTone; rank: number; date?: string | null; open: () => void }
const consentStates = { PENDING: ['consentPending', 'info'], EXPIRED: ['consentExpired', 'danger'], DECLINED: ['consentDeclined', 'danger'] } as const;

/**
 * One list of everything waiting for this person, in priority order: overdue first,
 * then decisions, then upcoming deadlines. Counts come from the server; nothing is guessed.
 */
export function NeedsYou({ clubId, overview, roles, squads, canManageOperations, tryoutPending, onOpen, onOpenPlayers, limit = 7, className }: {
    clubId: number; overview: ClubManagementOverview | null; roles: RolesWorkspace | null; squads: number[] | null;
    canManageOperations: boolean; tryoutPending: number; onOpen: OpenWorkspace;
    onOpenPlayers?: (status: 'ALL' | PlayerAffiliationStatus) => void; limit?: number; className?: string;
}) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const now = useNow();
    const work = useOutstandingWork(roles || overview ? clubId : null, squads);
    const clubWide = squads === null;
    const consent = useOverviewConsent(clubId, clubWide && canManageOperations && overview !== null, overview?.activePlayerCount ?? 0, overview?.trialistCount ?? 0);
    const openPlayers = (status: 'ALL' | PlayerAffiliationStatus) => onOpenPlayers ? onOpenPlayers(status) : onOpen('players');
    const items: NeedItem[] = [];
    if (clubWide && canManageOperations && overview) {
        const overdue = overview.overdueTrialistCount ?? 0, trials = Math.max(0, (overview.trialistCount ?? 0) - overdue);
        // The server's count is authoritative; the applicant list only loads once Tryouts is open.
        const tryouts = overview.pendingTryoutCount ?? tryoutPending;
        if (overdue) items.push({ key: 'overdue-trials', title: copy('needOverdueTrials', { count: overdue }), meta: copy('needOverdueTrialsMeta'), badge: copy('badgeOverdue'), tone: 'danger', rank: 0, open: () => openPlayers('TRIALIST') });
        if (overview.pendingApplications.length) items.push({ key: 'applications', title: copy('needApplications', { count: overview.pendingApplications.length }), meta: copy('needApplicationsMeta'), badge: copy('badgeDecide'), tone: 'warning', rank: 1, open: () => onOpen('applications') });
        if (tryouts) items.push({ key: 'tryouts', title: copy('needTryouts', { count: tryouts }), meta: copy('needTryoutsMeta'), badge: copy('badgeDecide'), tone: 'warning', rank: 1, open: () => onOpen('tryouts') });
        if (trials) items.push({ key: 'trials', title: copy('needTrials', { count: trials }), meta: copy('needTrialsMeta'), badge: copy('badgeReview'), tone: 'neutral', rank: 3, open: () => openPlayers('TRIALIST') });
    }
    if (roles?.invitations.length) items.push({ key: 'invitations', title: copy('needInvitations', { count: roles.invitations.length }), meta: roles.invitations.map(a => a.title).join(', '), badge: copy('badgeRespond'), tone: 'warning', rank: 1, open: () => onOpen('coach-hub', { hub: 'responsibilities' }) });
    const requests = roles?.leadership ? roles.requests.filter(r => r.status === 'PENDING' && r.user_id !== roles.actorId) : [];
    if (clubWide && requests.length) items.push({ key: 'role-requests', title: copy('needRoleRequests', { count: requests.length }), meta: requests.map(r => r.name).join(', '), badge: copy('badgeDecide'), tone: 'warning', rank: 1, open: () => onOpen('role-requests') });
    // Parent consent: up to three players by name, then the rest together. The check covers a bounded sample.
    const consentRows = consent.result?.players ?? [];
    consentRows.slice(0, 3).forEach(player => {
        const [badge, tone] = consentStates[player.parentalConsentStatus as keyof typeof consentStates] ?? ['consentMissing', 'warning'];
        items.push({ key: `consent-${player.userId}`, title: player.fullName || player.username || copy('playerFallback', { id: player.userId }), meta: copy('parentConsent'), badge: copy(badge), tone, rank: 2, open: () => openPlayers(player.status) });
    });
    if (consentRows.length > 3) items.push({ key: 'consent-more', title: copy('needMoreConsent', { count: consentRows.length - 3 }), meta: copy('consentHint'), badge: copy('consentMissing'), tone: 'warning', rank: 2, open: () => openPlayers('ALL') });
    const consentNote = consent.result ? (consent.result.reviewed >= consent.result.total ? copy('consentComplete') : copy('consentPartial', { reviewed: consent.result.reviewed, total: consent.result.total })) : null;
    // Club deadlines assigned to someone else stay visible to leadership, after the person's own work.
    let others = 0;
    for (const record of work.rows) {
        const due = dueLabel(record.attentionDate ?? record.due_on, now, isFinished(record.status));
        const overdue = Boolean(record.expired || due?.overdue);
        const squad = record.squad_id ? roles?.squads.find(s => s.id === record.squad_id)?.name : null;
        const colleague = Boolean(roles && record.assigned_user_id && record.assigned_user_id !== roles.actorId);
        if (colleague) others += 1;
        items.push({
            key: `record-${record.id}`, title: record.title,
            meta: [moduleNames[record.module], squad ?? (record.squad_id ? null : copy('clubWide')), label(record.status), colleague ? copy('withColleague') : null].filter(Boolean).join(' · '),
            badge: record.expired ? copy('badgeExpired') : due?.label ?? label(record.status), tone: overdue ? 'danger' : 'neutral', rank: (overdue ? 0 : 2) + (colleague ? 0.5 : 0),
            date: record.attentionDate ?? record.due_on,
            open: () => onOpen(operationTab(record.module), { record: String(record.id), ...(record.squad_id ? { squad: String(record.squad_id) } : {}) }),
        });
    }
    items.sort((a, b) => a.rank - b.rank || (a.date ?? '').localeCompare(b.date ?? ''));
    const shown = items.slice(0, limit);
    const hidden = items.length - shown.length;

    let body: ReactNode;
    if (work.loading && !items.length) body = <div className="cw-skeleton-rows" role="status" aria-label={copy('needsChecking')}>{[0, 1, 2].map(i => <Skeleton key={i} height={40} />)}</div>;
    else if (!items.length && !work.error) body = <EmptyNote title={copy('needsEmpty')}>{copy('needsEmptyHint')}</EmptyNote>;
    else body = <List label={copy('needsYou')}>{shown.map(item => <ListRow key={item.key} onClick={item.open} lead={<span className={`cw-dot cw-dot--${item.tone}`} aria-hidden="true" />} title={item.title} meta={item.meta} trail={<><span className={`cw-status cw-status--${item.tone}`}>{item.badge}</span><ChevronRight className="cw-chevron" aria-hidden="true" /></>} />)}</List>;

    return <Section className={className} boxed title={copy('needsYou')} hint={items.length ? others ? copy('waitingSplit', { count: items.length - others, others }) : copy('waiting', { count: items.length }) : undefined} action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('actions')}>{copy('workQueue')}</button>}>
        <Panel flush footer={hidden > 0 ? <button type="button" className="cw-text-button" onClick={() => onOpen('actions')}>{copy('moreInQueue', { count: hidden })}</button> : undefined}>
            {work.error && <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{work.error}</span><Button size="sm" onClick={work.retry}>{copy('retry')}</Button></div></div>}
            {body}
            {consent.error && <div className="cw-panel-notice"><div className="gk-notice gk-notice--warning" role="status"><span className="cw-notices__text">{copy('consentError')}</span><Button size="sm" onClick={() => { void consent.retry(); }}>{copy('retry')}</Button></div></div>}
            {!work.loading && !work.error && items.length > 0 && !work.rows.length && <p className="cw-panel-note"><CheckCircle2 aria-hidden="true" />{copy('noRecordDeadlines')}</p>}
            {consentNote && <p className="cw-panel-note"><CheckCircle2 aria-hidden="true" />{copy('parentConsent')}: {consentNote}</p>}
        </Panel>
    </Section>;
}
