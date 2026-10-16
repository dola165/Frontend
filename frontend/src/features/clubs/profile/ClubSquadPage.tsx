import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Navigation, Shield, Users } from 'lucide-react';
import { Button, ButtonLink, EmptyNote, FixtureRow, List, ListRow, Panel, Section, Skeleton } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { dayLabel, timeLabel } from '../../clubWorkspace/fixtures';
import { activityColors, activityIcons } from '../../schedule/activityIcons';
import { SquadTrainingSchedule } from '../SquadTrainingSchedule';
import { FacilityDirectionsPanel } from '../FacilityDirectionsPanel';
import type { PublicFacility } from '../ClubPlaceCard';
import { placeType } from '../clubPlaceTypes';
import type { TrainingSession } from '../trainingCalendar';
import { money, programmeAge, programmePrice, type TrainingProgramme } from '../presentation';
import { squadLine, trainingPath, type ClubEnquiryContext, type PublicSquad, type PublicStaff } from '../publicJourney';
import { useOverviewSource } from '../useOverviewSource';
import { usePageEditIfAny } from '../../pages/edit/context';
import { feeBandText } from '../../pages/model/fees';
import { trainsLine } from './trainsLine';
import type { ClubProfile } from './types';

interface Timetable { canView: boolean; sessions: TrainingSession[] }

const coaches = (people: PublicStaff[], squadId: number) => people.filter(p => p.responsibilities.some(r => r.squadId === squadId || r.squadIds?.includes(squadId)));

/**
 * One squad for an outsider deciding whether to join: who it is for, when and where it trains, who coaches it and what it costs,
 * with one way in. The timetable, the places, the programme and the players follow, each in its own quiet box.
 */
export function ClubSquadPage({ club, squad, programmes, onContact, isAuthenticated, canManage }: {
    club: ClubProfile; squad: PublicSquad; programmes: TrainingProgramme[]; onContact: (context: ClubEnquiryContext) => void; isAuthenticated: boolean; canManage: boolean;
}) {
    const timetable = useOverviewSource<Timetable>(`/clubs/${club.id}/squads/${squad.id}/training-schedule`);
    const people = useOverviewSource<PublicStaff[]>(`/clubs/${club.id}/staff-directory`);
    const places = useOverviewSource<PublicFacility[]>(`/clubs/${club.id}/facilities`);
    const [directions, setDirections] = useState<PublicFacility | null>(null);
    const [fullTimetable, setFullTimetable] = useState(false);
    const [now] = useState(() => Date.now());
    const sessions = timetable.data?.canView ? timetable.data.sessions.filter(s => Date.parse(s.endsAt) >= now).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)) : [];
    const trains = trainsLine(sessions);
    const staff = coaches(people.data ?? [], squad.id);
    // Pitches and grounds only: a gym or a medical room is not where a visitor goes for a first session.
    const venues = (places.data ?? []).filter(f => placeType(f) !== 'FACILITY' && (f.squadId == null || f.squadId === squad.id));
    const programme = programmes[0];
    // Without a programme, a club with a page still says what training costs: the fee band its owner set.
    const band = feeBandText(usePageEditIfAny()?.page?.boxes.fees.band ?? null);
    const enquiry: ClubEnquiryContext = { name: squad.name, path: trainingPath(club.id, { squad: squad.id }), squadIds: [squad.id] };
    const roster = `/clubs/${club.id}/squads?squad=${squad.id}`;
    const fact = (label: string, value: React.ReactNode) => <div className="gk-club-squad__fact"><dt>{label}</dt><dd>{value}</dd></div>;

    return <>
        <Link className="gk-section__action gk-row gk-club-back" to={trainingPath(club.id)}><ArrowLeft size={15} aria-hidden="true" />All teams & training</Link>
        <Section boxed className="gk-club-squad">
            <Panel padded>
                <div className="gk-club-squad__head">
                    <span className="gk-club-icon gk-club-icon--info gk-club-squad__crest"><Shield aria-hidden="true" /></span>
                    <div className="gk-club-squad__title"><h2>{squad.name}</h2><p className="gk-muted">{squadLine(squad)} · {club.name}</p></div>
                    <div className="gk-club-squad__actions">
                        {canManage ? <>
                            <ButtonLink to={`/clubs/${club.id}/workspace?tab=squads&squad=${squad.id}`}>Squad workspace</ButtonLink>
                            <ButtonLink variant="primary" to={roster}><Users aria-hidden="true" />Players</ButtonLink>
                        </> : <>
                            <Button onClick={() => onContact({ ...enquiry, intent: 'question' })}>Ask a question</Button>
                            <Button variant="primary" onClick={() => onContact({ ...enquiry, intent: 'visit' })}>Arrange a first visit<ArrowRight aria-hidden="true" /></Button>
                        </>}
                    </div>
                </div>
                <dl className="gk-club-squad__facts">
                    {fact('Trains', timetable.loading ? <Skeleton height={16} width={120} /> : trains ?? (timetable.data && !timetable.data.canView ? 'Times shared with squad members' : 'Times on request'))}
                    {fact('Where', places.loading ? <Skeleton height={16} width={120} /> : venues[0]?.title ?? 'Ask the club')}
                    {fact('Coaches', people.loading ? <Skeleton height={16} width={120} /> : staff.length ? <span className="gk-club-squad__faces">{staff.slice(0, 4).map(p => <Link key={p.userId} to={`/profile/${p.userId}`} className="gk-row"><Crest src={p.avatarUrl} name={p.fullName} size={24} round />{p.fullName.split(' ')[0]}</Link>)}</span> : 'Ask the club')}
                    {fact('Fees', programme ? <><strong className="gk-num">{programmePrice(programme)}</strong>{programme.trialAmount != null && <span className="gk-muted"> · Trial {Number(programme.trialAmount) === 0 ? 'free' : money(programme.trialAmount, programme.currency)}</span>}</> : band ? <strong className="gk-num">{band.range}</strong> : 'Ask the club')}
                </dl>
            </Panel>
        </Section>

        <Section boxed icon={CalendarDays} title="Training times" hint={trains ? `Trains ${trains}` : 'Next six weeks'} action={canManage ? { label: 'Manage sessions', to: `/calendar?scope=squad&squadId=${squad.id}` } : undefined}>
            <Panel flush>{timetable.loading ? <div className="gk-panel--pad"><Skeleton height={48} /></div>
                : timetable.failed ? <EmptyNote title="Training times couldn’t load" action={<Button size="sm" onClick={timetable.retry}>Try again</Button>} />
                : timetable.data && !timetable.data.canView ? <EmptyNote title="Shared with squad members">{isAuthenticated ? 'The club has not published this squad’s times. Ask about them below.' : 'Sign in, or ask the club about training times.'}</EmptyNote>
                : !sessions.length ? <EmptyNote title="No sessions scheduled yet">Ask the club about training days and times.</EmptyNote>
                : <List label="Next sessions">{sessions.slice(0, 4).map(s => <FixtureRow key={s.id} tone="training" icon={activityIcons.TRAINING} iconColor={activityColors.TRAINING} time={timeLabel(s.startsAt, s.timezone)} day={dayLabel(s.startsAt, undefined, s.timezone)} title={s.title || 'Training'} meta={s.location || venues[0]?.title} />)}</List>}
            </Panel>
            {sessions.length > 0 && <div className="gk-club-squad__more">
                <button type="button" className="gk-section__action" aria-expanded={fullTimetable} onClick={() => setFullTimetable(v => !v)}>{fullTimetable ? 'Hide the full timetable' : 'Full timetable'}</button>
                {fullTimetable && <div className="club-public"><SquadTrainingSchedule clubId={club.id} squadId={squad.id} /></div>}
            </div>}
        </Section>

        <Section boxed icon={MapPin} tone="warning" title="Where you’ll train" hint="Use the place confirmed for your session">
            <Panel flush>{places.loading ? <div className="gk-panel--pad"><Skeleton height={48} /></div>
                : !venues.length ? <EmptyNote title="No place published yet">The club confirms the location before your first visit.</EmptyNote>
                : <List label="Training places">{venues.slice(0, 3).map(v => <ListRow key={v.id} lead={<span className="gk-club-icon gk-club-icon--warning"><MapPin aria-hidden="true" /></span>} title={v.title}
                    meta={v.details.address || v.linkedVenue?.address || 'Address on request'} trail={<Button size="sm" onClick={() => setDirections(v)}><Navigation aria-hidden="true" />Directions</Button>} />)}</List>}
            </Panel>
        </Section>

        <Section boxed title="What to expect" hint={programme ? [programmeAge(programme), programme.sessionsPerWeek ? `${programme.sessionsPerWeek} ${programme.sessionsPerWeek === 1 ? 'session' : 'sessions'} a week` : null].filter(Boolean).join(' · ') : undefined}>
            <Panel padded>
                {programme ? <>
                    <p className="gk-club-story">{programme.details || 'Ask the club about the training approach and the right level for you.'}</p>
                    <dl className="gk-club-facts">
                        {([['Fees', programmePrice(programme)], ['Trial session', programme.trialAmount], ['Joining fee', programme.joiningFee], ['Equipment', programme.equipmentFee]] as const).filter(([, v]) => v != null).map(([name, v]) => <div key={name} className="gk-profile-fact"><dt>{name}</dt><dd>{name === 'Fees' ? v : Number(v) === 0 ? 'No charge' : money(v as string, programme.currency)}</dd></div>)}
                    </dl>
                    {programmes.length > 1 && <p className="gk-muted gk-club-note">{programmes.length} programmes train with this squad: {programmes.map(p => <Link key={p.id} className="gk-profile__link" to={trainingPath(club.id, { programme: p.id })}>{p.name}</Link>).reduce<React.ReactNode[]>((acc, el, i) => i ? [...acc, ', ', el] : [el], [])}.</p>}
                </> : <p className="gk-muted">The club has not published a programme for this squad. Ask about its training and how players are selected.</p>}
            </Panel>
        </Section>

        <Section boxed icon={Users} tone="info" title="Players">
            <Panel flush><List label="Players"><ListRow to={roster} lead={<span className="gk-club-icon gk-club-icon--info"><Users aria-hidden="true" /></span>} title="See the squad" meta={isAuthenticated ? 'Players, positions and squad profiles' : 'Sign in to see player profiles'} trail={<ArrowRight aria-hidden="true" className="gk-faint" size={16} />} /></List></Panel>
        </Section>
        {directions && <FacilityDirectionsPanel clubId={club.id} facilityId={directions.id} title={directions.title} address={directions.details.address || directions.linkedVenue?.address} onClose={() => setDirections(null)} />}
    </>;
}
