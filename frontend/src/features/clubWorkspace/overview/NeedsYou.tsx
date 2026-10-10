import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Badge, Button, EmptyNote, List, ListRow, Panel, Section, Skeleton, type BadgeTone } from '../../../design/primitives';
import { label, moduleNames } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import { operationTab } from '../../clubOperations/workspaceNavigation';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import type { ClubManagementOverview, PlayerAffiliationStatus } from '../../clubs/domain';
import { useOverviewConsent } from './useOverviewConsent';
import { dueLabel } from '../fixtures';
import { useOutstandingWork } from './useOutstandingWork';
import { clubOverviewEn } from '../../../locales/clubOverview';

interface NeedItem { key: string; title: string; meta: string; badge: string; tone: BadgeTone; rank: number; date?: string | null; open: () => void }

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/**
 * One list of everything waiting for this person, in priority order: overdue first,
 * then decisions, then upcoming deadlines. Counts come from the server; nothing is guessed.
 */
export function NeedsYou({ clubId, overview, roles, squads, canManageOperations, tryoutPending, onOpen, onOpenPlayers, limit = 7 }: {
    clubId: number; overview: ClubManagementOverview | null; roles: RolesWorkspace | null; squads: number[] | null;
    canManageOperations: boolean; tryoutPending: number; onOpen: OpenWorkspace;
    onOpenPlayers?: (status: 'ALL' | PlayerAffiliationStatus) => void; limit?: number;
}) {
    const work = useOutstandingWork(roles || overview ? clubId : null, squads);
    const clubWide = squads === null;
    const consent = useOverviewConsent(clubId, clubWide && canManageOperations && overview !== null, overview?.activePlayerCount ?? 0, overview?.trialistCount ?? 0);
    const openPlayers = (status: 'ALL' | PlayerAffiliationStatus) => onOpenPlayers ? onOpenPlayers(status) : onOpen('players');
    const { t } = useTranslation();
    const copy = (key: keyof typeof clubOverviewEn, values?: Record<string, string | number>) => t(`clubOverview.${key}`, { defaultValue: clubOverviewEn[key], ...values });
    const items: NeedItem[] = [];
    if (clubWide && canManageOperations && overview) {
        const overdue = overview.overdueTrialistCount ?? 0, trials = Math.max(0, (overview.trialistCount ?? 0) - overdue);
        if (overdue) items.push({ key: 'overdue-trials', title: plural(overdue, 'overdue trial decision'), meta: 'Long-running trials need a progress decision', badge: 'Overdue', tone: 'danger', rank: 0, open: () => openPlayers('TRIALIST') });
        if (overview.pendingApplications.length) items.push({ key: 'applications', title: plural(overview.pendingApplications.length, 'membership application'), meta: 'Players and staff asking to join', badge: 'Decide', tone: 'warning', rank: 1, open: () => onOpen('applications') });
        if (tryoutPending) items.push({ key: 'tryouts', title: plural(tryoutPending, 'tryout review'), meta: 'Pending and shortlisted applicants', badge: 'Decide', tone: 'warning', rank: 1, open: () => onOpen('tryouts') });
        if (trials) items.push({ key: 'trials', title: plural(trials, 'player', 'players') + ' on trial', meta: 'Review progress and trial end dates', badge: 'Review', tone: 'neutral', rank: 3, open: () => openPlayers('TRIALIST') });
    }
    if (roles?.invitations.length) items.push({ key: 'invitations', title: roles.invitations.length === 1 ? 'A staff role is waiting for your answer' : `${roles.invitations.length} staff roles are waiting for your answer`, meta: roles.invitations.map(a => a.title).join(', '), badge: 'Respond', tone: 'warning', rank: 1, open: () => onOpen('coach-hub', { hub: 'responsibilities' }) });
    const requests = roles?.leadership ? roles.requests.filter(r => r.status === 'PENDING' && r.user_id !== roles.actorId) : [];
    if (clubWide && requests.length) items.push({ key: 'role-requests', title: plural(requests.length, 'staff role request'), meta: requests.map(r => r.name).join(', '), badge: 'Decide', tone: 'warning', rank: 1, open: () => onOpen('role-requests') });
    // Parent consent: up to three players by name, then the rest together. The check covers a bounded sample.
    const consentRows = consent.result?.players ?? [];
    consentRows.slice(0, 3).forEach(player => {
        const status = player.parentalConsentStatus;
        const state = status === 'PENDING' ? { key: 'consentPending', tone: 'info' as const } : status === 'EXPIRED' ? { key: 'consentExpired', tone: 'danger' as const } : status === 'DECLINED' ? { key: 'consentDeclined', tone: 'danger' as const } : { key: 'consentMissing', tone: 'warning' as const };
        items.push({ key: `consent-${player.userId}`, title: player.fullName || player.username || copy('playerFallback', { id: player.userId }), meta: copy('parentConsent'), badge: copy(state.key as keyof typeof clubOverviewEn), tone: state.tone, rank: 2, open: () => openPlayers(player.status) });
    });
    if (consentRows.length > 3) items.push({ key: 'consent-more', title: `${consentRows.length - 3} more ${consentRows.length - 3 === 1 ? 'player needs' : 'players need'} parent consent`, meta: copy('consentHint'), badge: copy('consentMissing'), tone: 'warning', rank: 2, open: () => openPlayers('ALL') });
    const consentNote = consent.result ? (consent.result.reviewed >= consent.result.total ? copy('consentComplete') : copy('consentPartial', { reviewed: consent.result.reviewed, total: consent.result.total })) : null;
    for (const record of work.rows) {
        const due = dueLabel(record.attentionDate ?? record.due_on);
        const overdue = Boolean(record.expired || due?.overdue);
        const squad = record.squad_id ? roles?.squads.find(s => s.id === record.squad_id)?.name : null;
        items.push({
            key: `record-${record.id}`, title: record.title,
            meta: [moduleNames[record.module], squad ?? (record.squad_id ? null : 'Club-wide'), label(record.status)].filter(Boolean).join(' · '),
            badge: record.expired ? 'Expired' : due?.label ?? label(record.status), tone: overdue ? 'danger' : 'neutral', rank: overdue ? 0 : 2,
            date: record.attentionDate ?? record.due_on,
            open: () => onOpen(operationTab(record.module), { record: String(record.id), ...(record.squad_id ? { squad: String(record.squad_id) } : {}) }),
        });
    }
    items.sort((a, b) => a.rank - b.rank || (a.date ?? '').localeCompare(b.date ?? ''));
    const shown = items.slice(0, limit);
    const hidden = items.length - shown.length;

    let body: ReactNode;
    if (work.loading && !items.length) body = <div className="cw-skeleton-rows" role="status" aria-label="Checking what needs you">{[0, 1, 2].map(i => <Skeleton key={i} height={40} />)}</div>;
    else if (!items.length && !work.error) body = <EmptyNote title="Nothing needs you right now">New decisions, deadlines and reviews will appear here.</EmptyNote>;
    else body = <List label="Needs you">{shown.map(item => <ListRow key={item.key} onClick={item.open} title={item.title} meta={item.meta} trail={<Badge tone={item.tone}>{item.badge}</Badge>} />)}</List>;

    return <Section title="Needs you" hint={items.length ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : undefined} action={<button type="button" className="gk-section__action cw-text-button" onClick={() => onOpen('actions')}>Work queue</button>}>
        <Panel flush footer={hidden > 0 ? <button type="button" className="cw-link" onClick={() => onOpen('actions')}>{plural(hidden, 'more item')} in the work queue</button> : undefined}>
            {work.error && <div className="cw-panel-notice"><div className="gk-notice gk-notice--danger" role="alert"><span className="cw-notices__text">{work.error}</span><Button size="sm" onClick={work.retry}>Try again</Button></div></div>}
            {body}
            {consent.error && <div className="cw-panel-notice"><div className="gk-notice gk-notice--warning" role="status"><span className="cw-notices__text">{copy('consentError')}</span><Button size="sm" onClick={() => { void consent.retry(); }}>{copy('retry')}</Button></div></div>}
            {!work.loading && !work.error && items.length > 0 && !work.rows.length && <p className="cw-panel-note"><CheckCircle2 aria-hidden="true" />No record deadlines in the next three weeks.</p>}
            {consentNote && <p className="cw-panel-note"><CheckCircle2 aria-hidden="true" />{copy('parentConsent')}: {consentNote}</p>}
        </Panel>
    </Section>;
}
