import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Printer, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TournamentDetail, TournamentFixtureDto } from '../domain';
import { buildMatchdaySchedule, formatMatchday, type MatchdayRow } from '../matchdaySchedule';
import { participantName } from '../participantLabels';
import { tournamentFixtureStatusText } from '../../../components/tournaments/tournamentFormatters';
import './tournament-matchday.css';
import { downloadTournamentCalendar } from '../tournament-calendar';

interface Props {
    tournament: TournamentDetail;
    active: boolean;
    onMatch: (fixture: TournamentFixtureDto) => void;
    onBracket: () => void;
}

export function TournamentMatchday({ tournament, active, onMatch, onBracket }: Props) {
    const { t, i18n } = useTranslation();
    const copy = (en: string, ka: string) => i18n.language.startsWith('ka') ? ka : en;
    const [day, setDay] = useState('all');
    const [team, setTeam] = useState('all');
    const [stage, setStage] = useState('all');
    const [status, setStatus] = useState('all');
    const [attention, setAttention] = useState(false);
    const rows = useMemo(() => buildMatchdaySchedule(tournament), [tournament]);
    const days = [...new Set(rows.flatMap(row => row.kickoff ? [row.kickoff.day] : []))];
    const fixtureTeams = new Set(rows.flatMap(row => [row.fixture.homeEntryId, row.fixture.awayEntryId]));
    const teams = tournament.entries.filter(entry => fixtureTeams.has(entry.id));
    const missing = rows.filter(row => row.missingTime).length;
    const clashes = rows.filter(row => row.conflictingIds.length > 0).length;
    const completed = rows.filter(row => row.fixture.status === 'COMPLETED').length;
    const shown = rows.filter(row =>
        (day === 'all' || (day === 'unscheduled' ? !row.kickoff : row.kickoff?.day === day))
        && (team === 'all' || row.fixture.homeEntryId === Number(team) || row.fixture.awayEntryId === Number(team))
        && (stage === 'all' || row.fixture.stageId === Number(stage))
        && (status === 'all' || row.fixture.status === status)
        && (!attention || row.missingTime || row.conflictingIds.length > 0));
    const groups = new Map<string, MatchdayRow[]>();
    for (const row of shown) {
        const key = row.kickoff?.day ?? 'unscheduled';
        const group = groups.get(key) ?? [];
        group.push(row);
        groups.set(key, group);
    }
    const reset = () => { setDay('all'); setTeam('all'); setStage('all'); setStatus('all'); setAttention(false); };
    const filtered = day !== 'all' || team !== 'all' || stage !== 'all' || status !== 'all' || attention;
    const issueText = (row: MatchdayRow) => row.missingTime
        ? copy('Kickoff needed', 'დრო დასანიშნია')
        : row.conflictingIds.length ? copy('Team scheduled twice at this time', 'ამ დროს გუნდს ორი მატჩი აქვს') : '';
    const teamName = (name: string) => name || copy('To be decided', 'დასადგენია');
    const groupTitle = (key: string) => key === 'unscheduled' ? copy('Time to be arranged', 'დრო დასანიშნია') : formatMatchday(key, i18n.language);
    const score = (row: MatchdayRow) => row.fixture.homeScore != null && row.fixture.awayScore != null
        ? `${row.fixture.homeScore} – ${row.fixture.awayScore}` : 'vs';
    const stageText = (row: MatchdayRow) => row.stage || copy('Stage not assigned', 'ეტაპი არ არის მითითებული');
    const matchNumber = (row: MatchdayRow) => row.fixture.fixtureOrder != null ? `${copy('Match', 'მატჩი')} ${row.fixture.fixtureOrder}` : '';
    const printContext = [
        day === 'all' ? copy('All days', 'ყველა დღე') : groupTitle(day),
        team === 'all' ? copy('All teams', 'ყველა გუნდი') : participantName(teams.find(entry => entry.id === Number(team))),
        stage === 'all' ? copy('All stages', 'ყველა ეტაპი') : tournament.stages.find(item => item.id === Number(stage))?.name,
        status === 'all' ? copy('All statuses', 'ყველა სტატუსი') : tournamentFixtureStatusText(status as TournamentFixtureDto['status'], t),
        attention ? copy('Needs attention', 'საჭიროებს ყურადღებას') : '',
    ].filter(Boolean).join(' · ');

    return <div className="tw-matchday">
        <header className="tw-matchday-heading">
            <div><p className="tw-eyebrow">{copy('Tournament operations', 'ტურნირის მართვა')}</p>
                <h2>{copy('Every match. One schedule.', 'ყველა მატჩი ერთ განრიგში.')}</h2>
                <p>{copy('Plan the day across every stage, then open a match to arrange its kickoff or record a result.', 'დაგეგმეთ ყველა ეტაპის მატჩები. გახსენით მატჩი დროის დასანიშნად ან შედეგის ჩასაწერად.')}</p>
            </div>
            <div className="tw-actions"><button className="tw-button" disabled={!shown.some(row => row.fixture.scheduledAt && row.fixture.status !== 'CANCELLED')} onClick={() => downloadTournamentCalendar(tournament, shown.map(row => row.fixture))}><CalendarDays size={16}/>{copy('Export fixtures (.ics)', 'მატჩების ექსპორტი (.ics)')}</button><button className="tw-button" disabled={!shown.length} onClick={() => window.print()}><Printer size={16}/>{copy('Print schedule', 'განრიგის ბეჭდვა')}</button></div>
        </header>

        <div className="tw-matchday-summary" role="group" aria-label={copy('Schedule overview', 'განრიგის მიმოხილვა')}>
            <div><CalendarDays size={18}/><strong>{rows.length}</strong><span>{copy('Total matches', 'სულ მატჩები')}</span></div>
            <div className={missing ? 'needs-attention' : ''}><Clock3 size={18}/><strong>{missing}</strong><span>{copy('Need a kickoff', 'დრო დასანიშნია')}</span></div>
            <div className={clashes ? 'needs-attention' : ''}><AlertTriangle size={18}/><strong>{clashes}</strong><span>{copy('Matches with a clash', 'მატჩები დროის კონფლიქტით')}</span></div>
            <div><CheckCircle2 size={18}/><strong>{completed}</strong><span>{copy('Results confirmed', 'შედეგები დადასტურებულია')}</span></div>
        </div>

        {rows.length === 0 ? <div className="tw-matchday-empty"><CalendarDays size={32}/><h3>{copy('Matchday starts with your competition setup', 'მატჩების დღე შეჯიბრების გამართვით იწყება')}</h3><p>{copy('Matches will appear here as soon as they are added to the competition.', 'შეჯიბრებაში დამატებული მატჩები აქ გამოჩნდება.')}</p><button className="tw-button" onClick={onBracket}>{copy('Open competition', 'შეჯიბრების გახსნა')}<ArrowUpRight size={15}/></button></div> : <>
            <div className="tw-matchday-filters">
                <label>{copy('Day', 'დღე')}<select value={day} onChange={event => setDay(event.target.value)}>
                    <option value="all">{copy('All days', 'ყველა დღე')}</option>
                    {days.map(value => <option key={value} value={value}>{formatMatchday(value, i18n.language)}</option>)}
                    <option value="unscheduled">{copy('Time to be arranged', 'დრო დასანიშნია')}</option>
                </select></label>
                <label>{copy('Team', 'გუნდი')}<select value={team} onChange={event => setTeam(event.target.value)}><option value="all">{copy('All teams', 'ყველა გუნდი')}</option>{teams.map(entry => <option key={entry.id} value={entry.id}>{participantName(entry)}</option>)}</select></label>
                <label>{copy('Stage', 'ეტაპი')}<select value={stage} onChange={event => setStage(event.target.value)}><option value="all">{copy('All stages', 'ყველა ეტაპი')}</option>{tournament.stages.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>{copy('Status', 'სტატუსი')}<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">{copy('All statuses', 'ყველა სტატუსი')}</option>{(['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const).map(value => <option key={value} value={value}>{tournamentFixtureStatusText(value, t)}</option>)}</select></label>
            </div>
            <div className="tw-matchday-toolbar">
                <button className="tw-button" aria-pressed={attention} onClick={() => setAttention(value => !value)}><SlidersHorizontal size={14}/>{copy('Needs attention', 'საჭიროებს ყურადღებას')}</button>
                <span role="status">{shown.length} {copy('of', '/') } {rows.length} {copy('matches', 'მატჩი')}</span>
                {filtered && <button className="tw-matchday-reset" onClick={reset}>{copy('Clear filters', 'ფილტრების გასუფთავება')}</button>}
            </div>
            <p className="tw-matchday-note">{copy('Times are shown as entered by the organizer. Clash checks identify teams with the same kickoff; match duration, rest time, pitch and referee availability are not checked here.', 'დრო ნაჩვენებია ორგანიზატორის ჩანაწერის მიხედვით. მოწმდება გუნდის მატჩები ერთსა და იმავე დროს; ხანგრძლივობა, დასვენება, მოედანი და მსაჯის ხელმისაწვდომობა აქ არ მოწმდება.')}</p>
            {!shown.length && <div className="tw-matchday-empty"><CheckCircle2 size={28}/><h3>{copy('No matches in this view', 'ამ ხედში მატჩები არ არის')}</h3><p>{copy('Change your filters to see the rest of the schedule.', 'სხვა მატჩების სანახავად შეცვალეთ ფილტრები.')}</p><button className="tw-button" onClick={reset}>{copy('Show all matches', 'ყველა მატჩის ჩვენება')}</button></div>}
            {[...groups].map(([key, group]) => <section className="tw-matchday-group" key={key} aria-label={groupTitle(key)}>
                <header><h3>{groupTitle(key)}</h3><span>{group.length} {copy(group.length === 1 ? 'match' : 'matches', 'მატჩი')}</span></header>
                <div className="tw-matchday-list">{group.map(row => <article className={`tw-matchday-row${row.fixture.status === 'CANCELLED' ? ' is-cancelled' : ''}`} key={row.fixture.id}>
                    <div className="tw-matchday-time">{row.kickoff ? <time dateTime={row.fixture.scheduledAt ?? undefined}>{row.kickoff.time}</time> : <span>—</span>}<small>{copy('Kickoff', 'დაწყება')}</small></div>
                    <div className="tw-matchday-match"><p className="tw-matchday-stage">{stageText(row)}{matchNumber(row) && ` · ${matchNumber(row)}`}</p>
                        <div className="tw-matchday-teams"><strong>{teamName(row.home)}</strong><span className={score(row) === 'vs' ? 'is-versus' : ''}>{score(row)}</span><strong>{teamName(row.away)}</strong></div>
                        {issueText(row) && <p className="tw-matchday-warning"><AlertTriangle size={13}/>{issueText(row)}</p>}
                    </div>
                    <span className={`tw-matchday-status is-${row.fixture.status.toLowerCase()}`}>{tournamentFixtureStatusText(row.fixture.status, t)}</span>
                    <button className="tw-icon tw-matchday-open" aria-label={`${copy('Open match', 'მატჩის გახსნა')}: ${teamName(row.home)} / ${teamName(row.away)}`} onClick={() => onMatch(row.fixture)}><ArrowUpRight size={18}/></button>
                </article>)}</div>
            </section>)}
        </>}
        {active && createPortal(<article className="tw-matchday-print" aria-hidden="true">
            <header><p>GrassKickZ · {copy('Matchday schedule', 'მატჩების განრიგი')}</p><h1>{tournament.name}</h1><p>{tournament.organizerName}</p><p>{printContext}</p><p>{copy('Printed', 'დაბეჭდილია')}: {new Date().toLocaleString(i18n.language.startsWith('ka') ? 'ka-GE' : 'en-GB')}</p><p>{copy('Times as entered by the organizer. This is a snapshot; check GrassKickZ for changes.', 'დრო ორგანიზატორის ჩანაწერის მიხედვით. ცვლილებებისთვის შეამოწმეთ GrassKickZ.')}</p></header>
            {[...groups].map(([key, group]) => <section key={key}><h2>{groupTitle(key)}</h2><table><thead><tr><th>{copy('Time', 'დრო')}</th><th>{copy('Match', 'მატჩი')}</th><th>{copy('Stage', 'ეტაპი')}</th><th>{copy('Status / notes', 'სტატუსი / შენიშვნა')}</th></tr></thead><tbody>{group.map(row => <tr key={row.fixture.id}><td>{row.kickoff?.time ?? '—'}</td><td>{teamName(row.home)} {score(row)} {teamName(row.away)}</td><td>{stageText(row)}<br/>{matchNumber(row)}</td><td>{tournamentFixtureStatusText(row.fixture.status, t)}{issueText(row) && <><br/>{issueText(row)}</>}</td></tr>)}</tbody></table></section>)}
        </article>, document.body)}
    </div>;
}
