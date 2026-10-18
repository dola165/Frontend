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
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';

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
    const copy = useJourneyCopy();
    const venues = (places.data ?? []).filter(f => placeType(f) !== 'FACILITY' && (f.squadId == null || f.squadId === squad.id));
    const programme = programmes[0];
    // Without a programme, a club with a page still says what training costs: the fee band its owner set.
    const band = feeBandText(usePageEditIfAny()?.page?.boxes.fees.band ?? null);
    const enquiry: ClubEnquiryContext = { name: squad.name, path: trainingPath(club.id, { squad: squad.id }), squadIds: [squad.id] };
    const roster = `/clubs/${club.id}/squads?squad=${squad.id}`;
    const fact = (label: string, value: React.ReactNode) => <div className="gk-club-squad__fact"><dt>{label}</dt><dd>{value}</dd></div>;

    return <>
        <Link className="gk-section__action gk-row gk-club-back" to={trainingPath(club.id)}><ArrowLeft size={15} aria-hidden="true" />{copy('All teams & training', 'ყველა გუნდი და ვარჯიში')}</Link>
        <Section boxed className="gk-club-squad">
            <Panel padded>
                <div className="gk-club-squad__head">
                    <span className="gk-club-icon gk-club-icon--info gk-club-squad__crest"><Shield aria-hidden="true" /></span>
                    <div className="gk-club-squad__title"><h2>{squad.name}</h2><p className="gk-muted">{squadLine(squad)} · {club.name}</p></div>
                    <div className="gk-club-squad__actions">
                        {canManage ? <>
                            <ButtonLink to={`/squads/${squad.id}`}>{copy('Squad page', 'გუნდის გვერდი')}</ButtonLink><ButtonLink to={`/squads/${squad.id}?tab=schedule&setup=training`}>{copy('Set up training', 'ვარჯიშის დაგეგმვა')}</ButtonLink>
                            <ButtonLink variant="primary" to={roster}><Users aria-hidden="true" />{copy('Players', 'მოთამაშეები')}</ButtonLink>
                        </> : <>
                            <Button onClick={() => onContact({ ...enquiry, intent: 'question' })}>{copy('Ask a question', 'კითხვის დასმა')}</Button>
                            <Button variant="primary" onClick={() => onContact({ ...enquiry, intent: 'visit' })}>{copy('Arrange a first visit', 'პირველი ვიზიტის დაგეგმვა')}<ArrowRight aria-hidden="true" /></Button>
                        </>}
                    </div>
                </div>
                <dl className="gk-club-squad__facts">
                    {fact(copy('Trains', 'ვარჯიში'), timetable.loading ? <Skeleton height={16} width={120} /> : trains ?? (timetable.data && !timetable.data.canView ? copy('Times shared with squad members', 'დრო გუნდის წევრებისთვისაა') : copy('Times on request', 'დრო მოთხოვნით')))}
                    {fact(copy('Where', 'სად'), places.loading ? <Skeleton height={16} width={120} /> : venues[0]?.title ?? copy('Ask the club', 'ჰკითხეთ კლუბს'))}
                    {fact(copy('Coaches', 'მწვრთნელები'), people.loading ? <Skeleton height={16} width={120} /> : staff.length ? <span className="gk-club-squad__faces">{staff.slice(0, 4).map(p => <Link key={p.userId} to={`/profile/${p.userId}`} className="gk-row"><Crest src={p.avatarUrl} name={p.fullName} size={24} round />{p.fullName.split(' ')[0]}</Link>)}</span> : copy('Ask the club', 'ჰკითხეთ კლუბს'))}
                    {fact(copy('Fees', 'გადასახადი'), programme ? <><strong className="gk-num">{programmePrice(programme)}</strong>{programme.trialAmount != null && <span className="gk-muted"> · {copy('Trial', 'საცდელი')} {Number(programme.trialAmount) === 0 ? copy('free', 'უფასო') : money(programme.trialAmount, programme.currency)}</span>}</> : band ? <strong className="gk-num">{band.range}</strong> : copy('Ask the club', 'ჰკითხეთ კლუბს'))}
                </dl>
            </Panel>
        </Section>

        <Section boxed icon={CalendarDays} title={copy('Training times', 'ვარჯიშის დრო')} hint={trains ? `${copy('Trains', 'ვარჯიში')} ${trains}` : copy('Next six weeks', 'მომდევნო ექვსი კვირა')} action={canManage ? { label: copy('Manage sessions', 'ვარჯიშების მართვა'), to: `/calendar?scope=squad&squadId=${squad.id}` } : undefined}>
            <Panel flush>{timetable.loading ? <div className="gk-panel--pad"><Skeleton height={48} /></div>
                : timetable.failed ? <EmptyNote title={copy('Training times couldn’t load', 'ვარჯიშის დრო ვერ ჩაიტვირთა')} action={<Button size="sm" onClick={timetable.retry}>{copy('Try again', 'ხელახლა ცდა')}</Button>} />
                : timetable.data && !timetable.data.canView ? <EmptyNote title={copy('Shared with squad members', 'გაზიარებულია გუნდის წევრებთან')}>{isAuthenticated ? copy('The club has not published this squad’s times. Ask about them below.', 'კლუბს გუნდის ვარჯიშის დრო არ გამოუქვეყნებია. ჰკითხეთ ქვემოთ.') : copy('Sign in, or ask the club about training times.', 'შედით ან ჰკითხეთ კლუბს ვარჯიშის დრო.')}</EmptyNote>
                : !sessions.length ? <EmptyNote title={copy('No sessions scheduled yet', 'ვარჯიშები ჯერ არ არის დაგეგმილი')}>{copy('Ask the club about training days and times.', 'ჰკითხეთ კლუბს ვარჯიშის დღეები და დრო.')}</EmptyNote>
                : <List label={copy('Next sessions', 'შემდეგი ვარჯიშები')}>{sessions.slice(0, 4).map(s => <FixtureRow key={s.id} tone="training" icon={activityIcons.TRAINING} iconColor={activityColors.TRAINING} time={timeLabel(s.startsAt, s.timezone)} day={dayLabel(s.startsAt, undefined, s.timezone)} title={s.title || copy('Training', 'ვარჯიში')} meta={s.location || venues[0]?.title} />)}</List>}
            </Panel>
            {sessions.length > 0 && <div className="gk-club-squad__more">
                <button type="button" className="gk-section__action" aria-expanded={fullTimetable} onClick={() => setFullTimetable(v => !v)}>{fullTimetable ? copy('Hide the full timetable', 'სრული განრიგის დამალვა') : copy('Full timetable', 'სრული განრიგი')}</button>
                {fullTimetable && <div className="club-public"><SquadTrainingSchedule clubId={club.id} squadId={squad.id} /></div>}
            </div>}
        </Section>

        <Section boxed icon={MapPin} tone="warning" title={copy('Where you’ll train', 'სად ივარჯიშებთ')} hint={copy('Use the place confirmed for your session', 'მიჰყევით ვარჯიშისთვის დადასტურებულ ადგილს')}>
            <Panel flush>{places.loading ? <div className="gk-panel--pad"><Skeleton height={48} /></div>
                : !venues.length ? <EmptyNote title={copy('No place published yet', 'ადგილი ჯერ არ გამოქვეყნებულა')}>{copy('The club confirms the location before your first visit.', 'პირველ ვიზიტამდე კლუბი ადგილს დაგიდასტურებთ.')}</EmptyNote>
                : <List label={copy('Training places', 'სავარჯიშო ადგილები')}>{venues.slice(0, 3).map(v => <ListRow key={v.id} lead={<span className="gk-club-icon gk-club-icon--warning"><MapPin aria-hidden="true" /></span>} title={v.title}
                    meta={v.details.address || v.linkedVenue?.address || copy('Address on request', 'მისამართი მოთხოვნით')} trail={<Button size="sm" onClick={() => setDirections(v)}><Navigation aria-hidden="true" />{copy('Directions', 'მიმართულება')}</Button>} />)}</List>}
            </Panel>
        </Section>

        {(programme || canManage) && <Section boxed title={copy('What to expect', 'რას უნდა ელოდოთ')} hint={programme ? [programmeAge(programme), programme.sessionsPerWeek ? copy(`${programme.sessionsPerWeek} ${programme.sessionsPerWeek === 1 ? 'session' : 'sessions'} a week`, `${programme.sessionsPerWeek} ვარჯიში კვირაში`) : null].filter(Boolean).join(' · ') : undefined}>
            <Panel padded>
                {programme ? <>
                    <p className="gk-club-story">{programme.details || copy('Ask the club about the training approach and the right level for you.', 'ჰკითხეთ კლუბს ვარჯიშის მიდგომისა და თქვენთვის შესაფერისი დონის შესახებ.')}</p>
                    <dl className="gk-club-facts">
                        {([['Fees', programmePrice(programme)], ['Trial session', programme.trialAmount], ['Joining fee', programme.joiningFee], ['Equipment', programme.equipmentFee]] as const).filter(([, v]) => v != null).map(([name, v]) => <div key={name} className="gk-profile-fact"><dt>{({ Fees: copy('Fees', 'გადასახადი'), 'Trial session': copy('Trial session', 'საცდელი ვარჯიში'), 'Joining fee': copy('Joining fee', 'შესვლის საფასური'), Equipment: copy('Equipment', 'ეკიპირება') } as Record<string, string>)[name]}</dt><dd>{name === 'Fees' ? v : Number(v) === 0 ? copy('No charge', 'უფასო') : money(v as string, programme.currency)}</dd></div>)}
                    </dl>
                    {programmes.length > 1 && <p className="gk-muted gk-club-note">{copy(`${programmes.length} programmes train with this squad`, `ამ გუნდთან ვარჯიშობს ${programmes.length} პროგრამა`)}: {programmes.map(p => <Link key={p.id} className="gk-profile__link" to={trainingPath(club.id, { programme: p.id })}>{p.name}</Link>).reduce<React.ReactNode[]>((acc, el, i) => i ? [...acc, ', ', el] : [el], [])}.</p>}
                </> : <p className="gk-muted">{copy('The club has not published a programme for this squad. Ask about its training and how players are selected.', 'კლუბს ამ გუნდის პროგრამა არ გამოუქვეყნებია. ჰკითხეთ ვარჯიშებისა და მოთამაშეთა შერჩევის შესახებ.')}</p>}
            </Panel>
        </Section>}

        <Section boxed icon={Users} tone="info" title={copy('Players', 'მოთამაშეები')}>
            <Panel flush><List label={copy('Players', 'მოთამაშეები')}><ListRow to={roster} lead={<span className="gk-club-icon gk-club-icon--info"><Users aria-hidden="true" /></span>} title={copy('See the squad', 'გუნდის ნახვა')} meta={isAuthenticated ? copy('Players, positions and squad profiles', 'მოთამაშეები, პოზიციები და გუნდის პროფილები') : copy('Sign in to see player profiles', 'მოთამაშეთა პროფილების სანახავად შედით')} trail={<ArrowRight aria-hidden="true" className="gk-faint" size={16} />} /></List></Panel>
        </Section>
        {directions && <FacilityDirectionsPanel clubId={club.id} facilityId={directions.id} title={directions.title} address={directions.details.address || directions.linkedVenue?.address} onClose={() => setDirections(null)} />}
    </>;
}
