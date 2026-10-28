import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inClubOffice } from '../../clubOffice/officeLinks';
import { RefreshCw, UserPlus } from 'lucide-react';
import type { AdmissionCase, AdmissionInquiry, Choice, Opportunity } from '../types';
import type { AuthSessionId } from '../../../utils/authStorage';
import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { Button, Chip, PageFrame, PageHeader, SearchInput, Skeleton, StatTile } from '../../../design/primitives';
import { Tabs } from '../../../design/Tabs';
import { useClubAdmissionCopy } from './copy';
import { stageCopy } from './domain';
import { AdmissionError } from './ui';
import { CaseDetail } from './CaseDetail';
import { GroupEditor } from './GroupEditor';
import { JoiningProgrammeSetup } from './JoiningProgrammeSetup';
import { inquiryOwner, useInquiryCopy } from '../inquiryPresentation';
import { OfflineInquiry } from './OfflineInquiry';
import { InquiryQueue } from './InquiryQueue';
import { AdmissionCaseList, AdmissionGroups, AdmissionVisitors } from './AdmissionViews';
import { LegacyAdmissions } from '../legacy/LegacyAdmissions';
import { FamilyClubEnrollment } from '../../parents/FamilyClubEnrollment';
import type { useClubAdmissions } from './useClubAdmissions';
import './club-admission.css';
import '../../clubWorkspace/club-workspace.css';

const VIEWS = ['cases', 'sessions', 'groups', 'history'] as const;
type View = typeof VIEWS[number];

/**
 * Player admission: everyone asking to join, the visitors invited to sessions, the joining groups and their terms,
 * and the history. Each request opens on its own page; every change is a versioned command the server confirms.
 */
export function ClubAdmissionWorkspace({ state, sessionId, onOpen, onRosterChanged, existingPeople = [] }: { state: ReturnType<typeof useClubAdmissions>; sessionId: AuthSessionId; onOpen: OpenWorkspace; onRosterChanged: () => void; existingPeople?: Choice[] }) {
    const { c } = useClubAdmissionCopy(); const { copy } = useInquiryCopy(); const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState(''), [groupFilter, setGroupFilter] = useState(''), [stageFilter, setStageFilter] = useState(''), [queueFilter, setQueueFilter] = useState('action');
    const [editing, setEditing] = useState<Opportunity | null | undefined>(undefined), [saved, setSaved] = useState(false), [offline, setOffline] = useState(false);
    const view: View = (VIEWS as readonly string[]).includes(params.get('admissionView') ?? '') ? params.get('admissionView') as View : 'cases';
    const caseId = Number(params.get('case') ?? params.get('caseId'));
    const inquiryId = Number(params.get('inquiryId') ?? params.get('inquiry'));
    const workspace = state.data;
    const setupOpen = params.get('joiningSetup') === '1' && inquiryId > 0;
    const update = (change: (q: URLSearchParams) => void) => { const q = new URLSearchParams(params); change(q); setParams(q); };
    const openSetup = (id: number) => update(q => { q.set('inquiryId', String(id)); q.set('joiningSetup', '1'); q.set('admissionView', 'cases'); q.delete('case'); q.delete('caseId'); });
    const returnToInquiry = () => update(q => { q.delete('joiningSetup'); q.set('admissionView', 'cases'); });
    const inquiryChanged = (value: AdmissionInquiry) => { state.setData(current => current ? { ...current, inquiries: current.inquiries?.map(row => row.id === value.id ? value : row) } : current); void state.reload(); };
    const intakeOpen = offline || params.get('intake') === '1';
    const closeIntake = () => { setOffline(false); update(q => q.delete('intake')); };
    const changeView = (next: View) => { update(q => { q.set('admissionView', next); ['case', 'inquiry', 'inquiryId', 'caseId', 'admissionGroup', 'joiningSetup'].forEach(key => q.delete(key)); }); setEditing(undefined); setOffline(false); };
    const openCase = (id: number) => update(q => { q.delete('joiningSetup'); q.set('case', String(id)); q.delete('inquiry'); q.delete('inquiryId'); q.delete('caseId'); q.set('admissionView', 'cases'); });
    const back = () => update(q => ['case', 'caseId', 'inquiry', 'inquiryId', 'joiningSetup'].forEach(key => q.delete(key)));
    const changed = (value: AdmissionCase) => {
        const previous = workspace?.cases.find(row => row.id === value.id);
        state.setData(current => current ? { ...current, cases: current.cases.map(row => row.id === value.id ? value : row) } : current);
        const placementChanged = previous?.enrollment?.id !== value.enrollment?.id || previous?.enrollment?.status !== value.enrollment?.status;
        const offerChanged = previous?.offer?.id !== value.offer?.id || previous?.offer?.version !== value.offer?.version || previous?.offer?.status !== value.offer?.status;
        if (placementChanged) onRosterChanged();
        if (placementChanged || offerChanged) void state.reload();
    };

    const header = (actions?: boolean) => <PageHeader title={c('title')} subtitle={c('intro')} actions={actions && <>
        <Button variant="ghost" disabled={state.loading} onClick={() => void state.reload()}><RefreshCw aria-hidden="true" />{c('refresh')}</Button>
        <Button variant="primary" aria-expanded={intakeOpen} onClick={() => { setOffline(!intakeOpen); update(q => q.delete('intake')); }}><UserPlus aria-hidden="true" />{copy('Add or invite a player', 'მოთამაშის დამატება ან მოწვევა')}</Button>
    </>} />;
    if (!workspace) return <PageFrame className="cw-page club-admission">{header()}
        {state.loading ? <div className="cw-loading" role="status" aria-label={c('loading')}><Skeleton height={96} /><Skeleton height={240} /></div>
            : <AdmissionError message={state.error || c('revoked')} onRetry={() => void state.reload()} retry={c('retry')} />}
    </PageFrame>;

    const record = workspace.cases.find(row => row.id === caseId);
    const cases = workspace.cases.filter(row => (!groupFilter || String(row.groupId) === groupFilter) && (!stageFilter || row.stage === stageFilter) && `${row.playerName} ${row.groupName} ${row.responsible?.name ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
    const actionable = cases.filter(row => !['ENROLLED', 'CLOSED'].includes(row.stage) && (queueFilter === 'all' || row.nextAction.owner === (queueFilter === 'family' ? 'APPLICANT' : 'CLUB')))
        .sort((a, b) => (a.nextAction.dueAt ?? '9999').localeCompare(b.nextAction.dueAt ?? '9999') || a.submittedAt.localeCompare(b.submittedAt));
    const shownCases = view === 'history' ? cases.filter(row => ['ENROLLED', 'CLOSED'].includes(row.stage)) : actionable;
    const visitors = cases.flatMap(row => row.sessions.filter(session => ['INVITED', 'CONFIRMED', 'RECONFIRM_REQUIRED'].includes(session.status)).map(session => ({ record: row, session }))).sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
    const inquiries = workspace.inquiries ?? [];
    const inquiryClosed = (row: AdmissionInquiry) => ['RESOLVED', 'DECLINED', 'WITHDRAWN'].includes(row.status);
    const inquiryQueued = (row: AdmissionInquiry) => !inquiryClosed(row) && !(row.status === 'ROUTED' && row.caseId);
    const setupTask = (row: AdmissionInquiry) => Boolean(row.setup?.requested && !row.groupId && row.setup.canConfigure);
    const needsClub = (row: AdmissionInquiry) => inquiryOwner(row) === 'CLUB' || setupTask(row);
    const shownInquiries = inquiries.filter(row => row.id === inquiryId || ((view === 'history' ? inquiryClosed(row) : inquiryQueued(row) && (queueFilter === 'all' || (queueFilter === 'family' ? inquiryOwner(row) === 'APPLICANT' : needsClub(row))))
        && (!groupFilter || String(row.groupId) === groupFilter) && `${row.playerName ?? ''} ${row.message}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
    const clubWaiting = workspace.cases.filter(row => row.nextAction.owner === 'CLUB' && !['ENROLLED', 'CLOSED'].includes(row.stage)).length + inquiries.filter(row => needsClub(row) && inquiryQueued(row)).length;
    const metrics = [
        { key: 'needsClub' as const, count: workspace.cases.filter(row => row.nextAction.owner === 'CLUB').length + inquiries.filter(row => needsClub(row) && inquiryQueued(row)).length, attention: true },
        { key: 'upcoming' as const, count: workspace.cases.flatMap(row => row.sessions).filter(session => session.status === 'CONFIRMED').length },
        { key: 'awaitingFamily' as const, count: workspace.cases.filter(row => row.nextAction.owner === 'APPLICANT').length + inquiries.filter(row => inquiryOwner(row) === 'APPLICANT' && inquiryQueued(row)).length },
    ];
    const casesTitle = view === 'history' ? copy('Players & completed requests', 'მოთამაშეები და დასრულებული მოთხოვნები') : queueFilter === 'family' ? copy('Waiting for the player or guardian', 'მოთამაშის ან მეურვის მოლოდინში') : copy('Next steps', 'შემდეგი ნაბიჯები');

    if (setupOpen) return <PageFrame className="cw-page club-admission"><JoiningProgrammeSetup inquiryId={inquiryId} workspace={workspace} sessionId={sessionId} onChanged={inquiryChanged} onReturn={returnToInquiry} /></PageFrame>;
    if (record) return <PageFrame className="cw-page club-admission"><CaseDetail key={record.id} record={record} workspace={workspace} sessionId={sessionId} onChanged={changed} onBack={back} onOpen={onOpen} onRefresh={() => void state.reload()} /></PageFrame>;

    return <PageFrame className="cw-page club-admission">
        {header(true)}
        <div className="gk-stack">
            {caseId > 0 && (state.loading ? <p role="status" className="gk-muted">{c('loading')}</p> : <AdmissionError message={c('revoked')} retry={c('back')} onRetry={back} />)}
            {inquiryId > 0 && !inquiries.some(row => row.id === inquiryId) && (state.loading ? <p role="status" className="gk-muted">{c('loading')}</p>
                : <AdmissionError message={copy('This enquiry is unavailable with your current club access. Return to the queue or refresh your access.', 'ეს მიმართვა თქვენი მიმდინარე წვდომით მიუწვდომელია. დაბრუნდით რიგში ან განაახლეთ წვდომა.')} retry={copy('Return to joining queue', 'რიგში დაბრუნება')} onRetry={back} />)}
            {intakeOpen && <div className="adm-intake">
                {workspace.clubId && <FamilyClubEnrollment key={`${sessionId}:${workspace.clubId}`} clubId={workspace.clubId} canContinueWithoutGroup onLinked={result => { void state.reload(); const destination = new URL(inClubOffice(result.staffDestination), window.location.origin); setParams(destination.searchParams); setOffline(false); }} />}
                {workspace.groups.some(group => group.canManage) && <OfflineInquiry workspace={workspace} people={existingPeople.filter((person, index, rows) => rows.findIndex(p => p.id === person.id) === index)} sessionId={sessionId} onClose={closeIntake} />}
            </div>}
            {state.error && <AdmissionError message={state.error} onRetry={() => void state.reload()} retry={c('retry')} />}
            {saved && <p className="gk-notice cw-notices__success" role="status">{c('saved')}</p>}
            <div className="gk-stats" role="group" aria-label={c('loadedOnly')}>{metrics.map(item => <StatTile key={item.key} label={c(item.key)} value={item.count} tone={item.attention && item.count ? 'attention' : undefined} />)}</div>
            <Tabs label={c('title')} value={view} onChange={changeView} items={VIEWS.map(id => ({
                id, label: id === 'cases' ? copy('Joining queue', 'გაწევრიანების რიგი') : id === 'history' ? copy('Players & history', 'მოთამაშეები და ისტორია') : c(id),
                count: id === 'cases' ? clubWaiting || undefined : id === 'sessions' ? visitors.length || undefined : undefined,
            }))} />
            {view !== 'groups' && <div className="rec-toolbar">
                {view === 'cases' && <div className="gk-chips" role="group" aria-label={copy('Who needs to act', 'ვინ უნდა იმოქმედოს')}>
                    {[['action', copy('Needs our action', 'ჩვენი მოქმედებაა საჭირო')], ['family', copy('Waiting for family', 'ოჯახის პასუხის მოლოდინში')], ['all', copy('All ongoing requests', 'ყველა მიმდინარე მოთხოვნა')]].map(([id, text]) =>
                        <Chip key={id} pressed={queueFilter === id} onClick={() => setQueueFilter(id)}>{text}</Chip>)}
                </div>}
                <SearchInput className="rec-toolbar__search" aria-label={c('search')} placeholder={c('search')} value={search} onChange={event => setSearch(event.target.value)} />
                <select className="gk-input" aria-label={c('group')} value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="">{c('allGroups')}</option>{workspace.groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
                {view === 'cases' && <select className="gk-input" aria-label={c('stage')} value={stageFilter} onChange={event => setStageFilter(event.target.value)}><option value="">{c('allStages')}</option>{Object.entries(stageCopy).map(([value, key]) => <option value={value} key={value}>{c(key)}</option>)}</select>}
            </div>}
            {(view === 'cases' || view === 'history') && <>
                <InquiryQueue selectedInquiryId={inquiryId} records={shownInquiries} groups={workspace.groups} sessionId={sessionId} onRefresh={() => void state.reload()} onOpenCase={openCase} onChanged={inquiryChanged} onSetup={openSetup} />
                <AdmissionCaseList title={casesTitle} cases={shownCases} onOpen={openCase}
                    hint={view === 'history' ? copy('Current placements and past outcomes stay available here.', 'მიმდინარე ჩარიცხვები და წარსული შედეგები აქ რჩება.') : copy('Open a request to arrange a visit, record its outcome or agree a place.', 'გახსენით მოთხოვნა ვიზიტის დასაგეგმად, შედეგის ჩასაწერად ან ადგილის შესათანხმებლად.')}
                    empty={view === 'cases' ? copy('No player arrangements need action here', 'მოთამაშის შეთანხმებებზე მოქმედება საჭირო არ არის') : c('emptyCases')}
                    emptyHint={view === 'cases' ? copy('Check the other queue filters, or invite a player to start their joining arrangement.', 'შეამოწმეთ რიგის სხვა ფილტრები ან მოიწვიეთ მოთამაშე.') : c('emptyCasesHint')} />
                <LegacyAdmissions view={view === 'history' ? 'history' : 'review'} sessionId={sessionId} organizationId={workspace.organizationId} playerId={Number(params.get('person')) || undefined} onChanged={() => void state.reload()} />
            </>}
            {view === 'sessions' && <AdmissionVisitors visitors={visitors} onOpen={openCase} />}
            {view === 'groups' && (editing !== undefined
                ? <GroupEditor key={editing?.id ?? 'new'} workspace={workspace} group={editing ? workspace.groups.find(group => group.id === editing.id) ?? editing : null} sessionId={sessionId} onRefresh={() => void state.reload()}
                    onSaved={() => { setSaved(true); setEditing(undefined); void state.reload(); }} onCancel={() => setEditing(undefined)} />
                : <>
                    {workspace.canConfigure && <div><Button variant="primary" onClick={() => { setSaved(false); setEditing(null); }}>{c('newGroup')}</Button></div>}
                    <AdmissionGroups workspace={workspace} only={params.get('admissionGroup') ?? params.get('group')} onNew={() => { setSaved(false); setEditing(null); }}
                        onEdit={id => { setSaved(false); setEditing(workspace.groups.find(group => group.id === id) ?? null); }} onOpen={openCase} />
                </>)}
        </div>
    </PageFrame>;
}
