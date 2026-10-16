import { useEffect, useState } from 'react';
import { Briefcase, ChevronRight, HeartHandshake, Landmark, ShieldCheck, ShoppingBag, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import type { TabItem, WorkspaceTab } from '../../../components/workspace/types';
import type { Bootstrap } from '../../clubOperations/api';
import type { RolesWorkspace } from '../../clubOperations/useWorkspaceRoles';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { isFinished } from '../../clubOperations/records/recordStatus';
import type { ClubManagementOverview, PlayerAffiliationStatus } from '../../clubs/domain';
import { campaignMoney, fetchManagedCampaigns, progressOf, type Campaign } from '../../campaigns/api';
import { fetchAllClubStoreProducts } from '../../store/api';
import { clubOverviewEn } from '../../../locales/clubOverview';
import { useCopy } from '../../../locales/useCopy';
import { dueLabel } from '../fixtures';
import { useOutstandingWork } from './useOutstandingWork';
import { useNow } from '../useNow';
import '../club-workspace.css';

/** The club's money and shop in numbers, loaded once for the leadership's Today page; a failure leaves the row quiet. */
function useClubCommerce(club: number, enabled: boolean) {
    const [state, setState] = useState<{ club: number; campaigns: Campaign[] | null; products: number | null } | null>(null);
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        void Promise.all([
            fetchManagedCampaigns(club, controller.signal).catch(() => null),
            fetchAllClubStoreProducts(club).then(list => list.length).catch(() => null),
        ]).then(([campaigns, products]) => { if (!controller.signal.aborted) setState({ club, campaigns, products }); });
        return () => controller.abort();
    }, [club, enabled]);
    return state?.club === club ? state : null;
}

/**
 * The club in numbers, for the people who run it: one row per thing a bigger club has to keep an eye on
 * (squads, players, staff, who is joining, money, fundraising, the shop), each with its count, the one thing
 * that needs a decision, and a press into the tool. Counts come from the server; nothing is guessed.
 */
export function ClubNumbers({ clubId, overview, roles, boot, tabs, tryoutPending, onOpen, onOpenPlayers }: {
    clubId: number; overview: ClubManagementOverview | null; roles: RolesWorkspace | null; boot: Bootstrap | null; tabs: TabItem[]; tryoutPending: number;
    onOpen: OpenWorkspace; onOpenPlayers?: (status: 'ALL' | PlayerAffiliationStatus) => void;
}) {
    const copy = useCopy('clubOverview', clubOverviewEn);
    const now = useNow();
    const has = (tab: WorkspaceTab) => tabs.some(item => item.id === tab);
    const commerce = useClubCommerce(clubId, has('campaigns') || has('store'));
    const work = useOutstandingWork(has('finance') ? clubId : null, null);
    const overdueMoney = work.rows.filter(record => record.module === 'FINANCE' && !isFinished(record.status) && (record.expired || dueLabel(record.attentionDate ?? record.due_on, now, false)?.overdue)).length;
    const live = commerce?.campaigns?.filter(campaign => campaign.status === 'PUBLISHED') ?? [];
    const raised = live.reduce((sum, campaign) => sum + (progressOf(campaign).raised ?? 0), 0), goal = live.reduce((sum, campaign) => sum + (campaign.goalAmount ?? 0), 0);
    const currency = live[0]?.currency ?? 'GEL';
    const squads = roles?.squads ?? [], players = squads.reduce((sum, squad) => sum + squad.player_count, 0);
    const trials = overview?.trialistCount ?? 0, overdueTrials = overview?.overdueTrialistCount ?? 0;
    const applications = overview?.pendingApplications.length ?? 0, tryouts = overview?.pendingTryoutCount ?? tryoutPending;

    type Row = { id: string; icon: LucideIcon; title: string; meta: string; status?: { text: string; tone: 'danger' | 'warning' | 'neutral' }; open?: () => void };
    const rows: Row[] = [
        { id: 'squads', icon: ShieldCheck, title: copy('numSquads'), meta: copy('numSquadsMeta', { count: squads.length, players }), open: () => onOpen('squads') },
        { id: 'players', icon: Users, title: copy('numPlayers'), meta: [copy('numActive', { count: overview?.activePlayerCount ?? players }), copy('numTrial', { count: trials })].join(' · '),
            status: overdueTrials ? { text: copy('numOverdueTrials', { count: overdueTrials }), tone: 'warning' } : undefined, open: onOpenPlayers ? () => onOpenPlayers(overdueTrials ? 'TRIALIST' : 'ACTIVE') : () => onOpen('players') },
        { id: 'staff', icon: Briefcase, title: copy('numStaff'), meta: copy('numStaffMeta', { count: boot?.staff.length ?? overview?.members.length ?? 0 }), open: has('personnel') ? () => onOpen('personnel') : undefined },
        { id: 'joining', icon: UserPlus, title: copy('numJoining'), meta: [copy('numApplications', { count: applications }), copy('numTryouts', { count: tryouts })].join(' · '),
            status: applications + tryouts ? { text: copy('badgeDecide'), tone: 'warning' } : undefined, open: has('applications') ? () => onOpen(applications || !tryouts ? 'applications' : 'tryouts') : undefined },
        ...(has('finance') ? [{ id: 'money', icon: Landmark, title: copy('numMoney'), meta: work.loading ? '…' : overdueMoney ? copy('numOverdueMoney', { count: overdueMoney }) : copy('numNothingOverdue'),
            status: overdueMoney ? { text: copy('badgeOverdue'), tone: 'danger' as const } : undefined, open: () => onOpen('finance') }] : []),
        ...(has('campaigns') ? [{ id: 'fundraising', icon: HeartHandshake, title: copy('numFundraising'), meta: commerce?.campaigns ? [copy('numLive', { count: live.length }), goal ? copy('numRaised', { raised: campaignMoney(raised, currency), goal: campaignMoney(goal, currency) }) : null].filter(Boolean).join(' · ') : '…', open: () => onOpen('campaigns') }] : []),
        ...(has('store') ? [{ id: 'store', icon: ShoppingBag, title: copy('numStore'), meta: commerce?.products != null ? copy('numProducts', { count: commerce.products }) : '…', open: () => onOpen('store') }] : []),
    ];
    return <Section className="cw-overview__numbers" boxed title={copy('numbersTitle')} hint={copy('numbersHint')}>
        <Panel flush>{!overview && !roles ? <div className="cw-skeleton-rows" role="status" aria-label={copy('numbersTitle')}>{[0, 1, 2].map(i => <Skeleton key={i} height={44} />)}</div>
            : <List label={copy('numbersTitle')}>{rows.map(row => <ListRow key={row.id} onClick={row.open} lead={<span className="cw-num__icon"><row.icon aria-hidden="true" /></span>} title={row.title} meta={row.meta}
                trail={<>{row.status && <span className={`cw-status cw-status--${row.status.tone}`}>{row.status.text}</span>}{row.open && <ChevronRight className="cw-chevron" aria-hidden="true" />}</>} />)}</List>}</Panel>
    </Section>;
}
