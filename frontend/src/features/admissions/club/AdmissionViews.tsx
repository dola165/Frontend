import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge, Button, EmptyNote, List, Panel, Section } from '../../../design/primitives';
import type { AdmissionCase, AdmissionWorkspace } from '../types';

type AdmissionSession = AdmissionCase['sessions'][number];
import { useClubAdmissionCopy } from './copy';
import { availabilityCopy, methodCopy, nextCopy, ownerCopy, participationCopy, stageCopy } from './domain';
import { AdmissionDate, AdmissionLinkButton } from './ui';

const stageTone = (stage: AdmissionCase['stage']) => stage === 'ENROLLED' ? 'accent' as const : stage === 'COMPLETING_ENROLLMENT' ? 'warning' as const : 'neutral' as const;

/** Joining requests as rows: the player and group, where the request stands, and who acts next by when. */
export function AdmissionCaseList({ title, hint, cases, empty, emptyHint, onOpen }: { title: string; hint: string; cases: AdmissionCase[]; empty: string; emptyHint: string; onOpen: (id: number) => void }) {
    const { c, locale } = useClubAdmissionCopy();
    return <Section title={title} hint={hint}>
        <Panel flush>{cases.length ? <List label={title}>{cases.map(row => <li key={row.id}>
            <button type="button" className="gk-list-row adm-case" onClick={() => onOpen(row.id)} aria-label={`${c('openCase')} · ${row.playerName} · ${row.groupName}`}>
                <span className="gk-list-row__main"><span className="gk-list-row__title">{row.playerName}</span><span className="gk-list-row__meta">{row.groupName} · {row.intake}</span></span>
                <span className="adm-case__stage"><Badge tone={stageTone(row.stage)}>{c(stageCopy[row.stage])}</Badge><small>{row.responsible?.name ?? c('queue')}</small></span>
                <span className="adm-case__next"><strong>{c(ownerCopy[row.nextAction.owner])}</strong><small>{nextCopy[row.nextAction.code] ? c(nextCopy[row.nextAction.code]) : row.nextAction.label}</small><AdmissionDate value={row.nextAction.dueAt} locale={locale} /></span>
                <ArrowRight aria-hidden="true" className="adm-case__go" />
            </button>
        </li>)}</List> : <EmptyNote title={empty}>{emptyHint}</EmptyNote>}</Panel>
    </Section>;
}

/** Players invited to, or confirmed for, an introductory session, soonest first. */
export function AdmissionVisitors({ visitors, onOpen }: { visitors: { record: AdmissionCase; session: AdmissionSession }[]; onOpen: (id: number) => void }) {
    const { c, locale } = useClubAdmissionCopy();
    return <Section title={c('sessions')} hint={c('attendanceHint')}>
        <Panel flush>{visitors.length ? <List label={c('sessions')}>{visitors.map(({ record: row, session }) => <li key={`${row.id}:${session.id}`}><div className="gk-list-row adm-visitor">
            <span className="gk-list-row__main">
                <span className="gk-list-row__title">{row.playerName} · {session.title}</span>
                <span className="gk-list-row__meta">{session.location.name} · {session.contact}</span>
                <AdmissionDate value={session.startsAt} locale={locale} timezone={session.timezone} />
                {session.status === 'CONFIRMED' && <span className="gk-list-row__meta">{c('emergency')}: {session.emergencyContact ?? c('notProvided')}</span>}
            </span>
            <span className="gk-list-row__trail adm-visitor__trail"><Badge tone={session.status === 'CONFIRMED' ? 'accent' : 'neutral'}>{c(participationCopy[session.status])}</Badge><Badge>{row.groupName}</Badge>
                <AdmissionLinkButton onClick={() => onOpen(row.id)}>{c('openCase')}</AdmissionLinkButton></span>
        </div></li>)}</List> : <EmptyNote title={c('noVisitors')}>{c('noVisitorsHint')}</EmptyNote>}</Panel>
    </Section>;
}

/** The club's joining groups: terms, places and who has joined, with editing for leadership. */
export function AdmissionGroups({ workspace, only, onEdit, onNew, onOpen }: { workspace: AdmissionWorkspace; only: string | null; onEdit: (id: number) => void; onNew: () => void; onOpen: (id: number) => void }) {
    const { c, locale } = useClubAdmissionCopy();
    const groups = workspace.groups.filter(group => !only || String(group.id) === only);
    return <div className="gk-stack">
        {!workspace.canConfigure && <p className="gk-notice">{c('leadershipOnly')}</p>}
        {groups.length ? <div className="adm-groups">{groups.map(group => {
            const members = workspace.cases.filter(row => row.enrollment?.groupId === group.id && row.enrollment.status === 'ACTIVE');
            return <Panel as="section" flush key={group.id} title={group.name} action={<Badge tone={group.availability === 'CLOSED' ? 'neutral' : 'accent'}>{c(availabilityCopy[group.availability])}</Badge>}
                footer={<div className="gk-row adm-group__actions"><Link to={group.destination} className="admission-text-button">{c('openOpportunity')}<ArrowRight aria-hidden="true" /></Link>
                    {workspace.canConfigure && <Button size="sm" onClick={() => onEdit(group.id)}>{c('editGroup')}</Button>}</div>}>
                <dl className="adm-facts">
                    <div><dt>{c('method')}</dt><dd>{c(methodCopy[group.method])} · {group.intake}</dd></div>
                    <div><dt>{c('location')}</dt><dd>{group.location.name}</dd></div>
                    <div><dt>{c('schedule')}</dt><dd>{group.schedule}</dd></div>
                    <div><dt>{c('remaining')}</dt><dd className="gk-num">{group.remainingPlaces} / {group.capacity}</dd></div>
                    <div><dt>{c('groupVersion')}</dt><dd className="gk-num">{group.version}</dd></div>
                </dl>
                <h3 className="adm-subhead">{c('regularParticipants')} <span className="gk-faint gk-num">{members.length}</span></h3>
                {members.length ? <List label={`${c('regularParticipants')} · ${group.name}`}>{members.map(row => <li key={row.id}><div className="gk-list-row">
                    <span className="gk-list-row__main"><span className="gk-list-row__title">{row.playerName}</span><AdmissionDate value={row.enrollment!.startDate} locale={locale} label={c('startDate')} /></span>
                    <span className="gk-list-row__trail"><AdmissionLinkButton onClick={() => onOpen(row.id)}>{c('openCase')}</AdmissionLinkButton></span>
                </div></li>)}</List> : <p className="adm-quiet">—</p>}
            </Panel>;
        })}</div> : <Panel><EmptyNote title={c('noGroups')} action={workspace.canConfigure ? <Button size="sm" onClick={onNew}>{c('newGroup')}</Button> : undefined}>{c('noGroupsHint')}</EmptyNote></Panel>}
    </div>;
}

