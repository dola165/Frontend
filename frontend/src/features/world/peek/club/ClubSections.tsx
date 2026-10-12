import { Link } from 'react-router-dom';
import { AtSign, Globe, LandPlot, Mail, MapPin, Trophy } from 'lucide-react';
import { MediaImage } from '../../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../../utils/resolveMediaUrl';
import type { ClubJob } from '../../../clubs/api';
import type { PublicFacility } from '../../../clubs/ClubPlaceCard';
import { staffTitle, type PublicSquad, type PublicStaff } from '../../../clubs/publicJourney';
import type { HistoryMatch } from '../../../matchHistory/api';
import type { TryoutPosting } from '../../../tryouts/api';
import type { Participant } from '../../../admissions/types';
import { plural, useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { codeLabel, ENGAGEMENT, fixtureDay, postedLabel, shortDate } from '../../format';
import { fitsAge, programmeAges, programmeFee, publicProgrammes } from '../../cards/programmes';
import { ageOn } from '../../players';
import { HistoryLine } from '../../scoreboard/HistoryLine';
import { matchCode } from '../../scoreboard/matchCode';
import { useClubCrests } from '../../scoreboard/useClubCrests';
import { PaneSection, type PaneMore } from '../PaneSection';
import { peekClick, peekOf, useRelatedOpen } from '../usePeek';
import { contactWays, squadsOf, type PaneClub } from './clubPane';
import '../../cards/cards.css';

/* A club's parts in the pane. Each shows a little in the overview (with "View …" to its own tab) and all of it, with a
   little more about each, in its tab (`all`). */

/** A link to something the club relates to: it opens over the club (with a way back), or its page with a modifier. */
function Related({ to, peek, children }: { to: string; peek: string; children: string }) {
    const relate = useRelatedOpen();
    return <Link to={to} onClick={peekClick(peek, relate)}>{children}</Link>;
}

/** The club's teams, each to its place on the club's Teams & training; in their tab, with who coaches each. */
export function TeamsSection({ squads, coaches, link, more, all }: { squads: PublicSquad[]; coaches: PublicStaff[]; link: (extra?: Record<string, string>) => string; more?: PaneMore; all?: boolean }) {
    const t = useWorldCopy();
    if (all) return (
        <PaneSection title={t('Teams')} count={squads.length} more={more}>
            <ul className="gk-peek-list gk-pane-grid">{squads.map(squad => {
                const theirs = coaches.filter(person => squadsOf(person).some(item => item.id === squad.id));
                // Its age group when the name does not say it, and who coaches it.
                const age = codeLabel(squad.category);
                const about = [!squad.name.toLowerCase().includes(age.toLowerCase()) && age, ...theirs.slice(0, 2).map(person => person.fullName)].filter(Boolean);
                return (
                    <li key={squad.id} className="gk-pane-line">
                        <Link to={link({ squad: String(squad.id) })}>{squad.name}</Link>
                        {about.length > 0 && <small>{about.join(' · ')}</small>}
                    </li>
                );
            })}</ul>
        </PaneSection>
    );
    return (
        <PaneSection title={t('Teams')} count={squads.length} more={more}>
            <ul className="gk-pane-chips">{squads.slice(0, 10).map(squad => (
                <li key={squad.id}><Link to={link({ squad: String(squad.id) })}>{squad.name}</Link></li>
            ))}{squads.length > 10 && <li className="gk-faint">{t('{count} more', { count: squads.length - 10 })}</li>}</ul>
        </PaneSection>
    );
}

/** Training programmes with their ages and fees (in their tab, how often and what the club says of them); for a parent searching for a child, the ones that fit come first, marked. */
export function ProgrammesSection({ club, child, link, more, all }: { club: PaneClub; child?: Participant; link: (extra?: Record<string, string>) => string; more?: PaneMore; all?: boolean }) {
    const t = useWorldCopy();
    const programmes = publicProgrammes(club.presentation), age = ageOn(child?.dateOfBirth);
    if (!programmes.length) return null;
    const fits = (programme: (typeof programmes)[number]) => age != null && fitsAge(programme, age);
    const sorted = [...programmes].sort((a, b) => Number(fits(b)) - Number(fits(a)));
    return (
        <PaneSection title={t('Training programmes')} count={programmes.length} more={more}>
            <ul className={`gk-peek-list${all ? ' gk-pane-grid' : ''}`}>{sorted.slice(0, all ? undefined : 3).map(programme => (
                <li key={programme.id ?? programme.name} className="gk-pane-line">
                    {programme.id != null ? <Link to={link({ programme: String(programme.id) })}>{programme.name}</Link> : <b>{programme.name}</b>}
                    <small>{[programmeAges(programme), programmeFee(programme), all && programme.sessionsPerWeek ? t('{count} a week', { count: plural(programme.sessionsPerWeek, 'session') }) : null].filter(Boolean).join(' · ')}{fits(programme) && child && <span className="gk-result-open"> · {t('Fits {name}', { name: child.name.split(' ')[0] })}</span>}</small>
                    {all && programme.details && <p className="gk-pane-note">{programme.details}</p>}
                </li>
            ))}</ul>
        </PaneSection>
    );
}

/** People the club publishes (its coaches, its management): faces, names and what they do (in their tab, for which teams); each opens over the club. */
export function PeopleSection({ title, people, more, shown = 4, all }: { title: string; people: PublicStaff[]; more?: PaneMore; shown?: number; all?: boolean }) {
    const t = useWorldCopy();
    return (
        <PaneSection title={t(title)} count={people.length} more={more}>
            <ul className="gk-pane-people">{people.slice(0, all ? undefined : shown).map(person => {
                const teams = all ? squadsOf(person).map(squad => squad.name).filter(Boolean) : [];
                return (
                    <li key={person.userId}>
                        <Crest src={person.avatarUrl} name={person.fullName} size={all ? 40 : 32} round />
                        <span>
                            <Related to={`/profile/${person.userId}`} peek={peekOf('person', person.userId)}>{person.fullName}</Related>
                            <small>{t(staffTitle(person))}</small>
                            {teams.length > 0 && <small>{teams.join(', ')}</small>}
                        </span>
                    </li>
                );
            })}</ul>
        </PaneSection>
    );
}

/** Score lines that open over the club. */
function MatchLines({ matches }: { matches: HistoryMatch[] }) {
    const crestOf = useClubCrests();
    const relate = useRelatedOpen();
    return <ul className="gk-sb__rows">{matches.map(match => <HistoryLine key={match.id} match={match} crestOf={crestOf} peek={peekOf('match', matchCode(match))} open={relate} />)}</ul>;
}

/** The club's next matches and latest results as score lines, three of each; in their tab, side by side, all of them. */
export function MatchesSection({ next, results, more, all }: { next: HistoryMatch[]; results: HistoryMatch[]; more?: PaneMore; all?: boolean }) {
    const t = useWorldCopy();
    if (all) return (
        <>
            {next.length > 0 && <PaneSection title={t('Next')} count={next.length}><MatchLines matches={next} /></PaneSection>}
            {results.length > 0 && <PaneSection title={t('Results')} count={results.length}><MatchLines matches={results} /></PaneSection>}
        </>
    );
    return (
        <PaneSection title={t('Matches')} more={more}>
            {next.length > 0 && <><h4 className="gk-pane-sub">{t('Next')}</h4><MatchLines matches={next.slice(0, 3)} /></>}
            {results.length > 0 && <><h4 className="gk-pane-sub">{t('Results')}</h4><MatchLines matches={results.slice(0, 3)} /></>}
        </PaneSection>
    );
}

/** Open trials: each opens over the club. */
export function TrialsSection({ trials, count, more, all }: { trials: TryoutPosting[]; count: number; more?: PaneMore; all?: boolean }) {
    const t = useWorldCopy();
    return (
        <PaneSection title={t('Trials')} count={count} more={more}>
            <ul className={`gk-peek-list${all ? ' gk-pane-grid' : ''}`}>{trials.slice(0, all ? undefined : 2).map(trial => (
                <li key={trial.id} className="gk-pane-line">
                    <Related to={`/tryouts/${trial.id}`} peek={peekOf('trial', trial.id)}>{trial.title}</Related>
                    <small>{[trial.tryoutDate ? fixtureDay(trial.tryoutDate) : null, codeLabel(trial.ageGroup), trial.deadline ? t('Apply by {date}', { date: shortDate(trial.deadline) ?? '' }) : null].filter(Boolean).join(' · ')}</small>
                </li>
            ))}</ul>
        </PaneSection>
    );
}

/** Jobs and volunteering at the club: each opens over the club. */
export function JobsSection({ jobs, more, all }: { jobs: ClubJob[]; more?: PaneMore; all?: boolean }) {
    const t = useWorldCopy();
    return (
        <PaneSection title={t('Jobs & volunteering')} count={jobs.length} more={more}>
            <ul className={`gk-peek-list${all ? ' gk-pane-grid' : ''}`}>{jobs.slice(0, all ? undefined : 3).map(job => {
                const terms = ENGAGEMENT[job.engagementType ?? 'UNSPECIFIED'] ?? ENGAGEMENT.UNSPECIFIED;
                return (
                    <li key={job.id} className="gk-pane-line">
                        <Related to={`/jobs/${job.id}`} peek={peekOf('job', job.id)}>{job.title}</Related>
                        <small>{[t(terms.label), postedLabel(job.createdAt), job.applicationCount ? plural(job.applicationCount, 'applicant') : null].filter(Boolean).join(' · ')}</small>
                    </li>
                );
            })}</ul>
        </PaneSection>
    );
}

/** Where the club plays: a photo, its name (a venue that can be booked opens over the club) and address. */
export function VenuesSection({ places, more, all }: { places: PublicFacility[]; more?: PaneMore; all?: boolean }) {
    const t = useWorldCopy();
    return (
        <PaneSection title={t('Venues')} count={places.length} more={more}>
            <ul className={`gk-peek-list${all ? ' gk-pane-grid' : ''}`}>{places.slice(0, all ? undefined : 2).map(place => {
                const photo = resolveMediaUrl(place.linkedVenue?.photo);
                return (
                    <li key={place.id} className="gk-pane-venue">
                        <span className="gk-world-venue-thumb">{photo ? <MediaImage src={photo} alt="" loading="lazy" /> : <LandPlot aria-hidden="true" />}</span>
                        <span className="gk-pane-line">
                            {place.linkedVenue ? <Related to={`/stadiums/${place.linkedVenue.id}`} peek={peekOf('venue', place.linkedVenue.id)}>{place.title}</Related> : <b>{place.title}</b>}
                            <small><MapPin aria-hidden="true" />{place.linkedVenue?.address || place.details.address || place.linkedVenue?.city || t('Address on the club page')}</small>
                        </span>
                    </li>
                );
            })}</ul>
        </PaneSection>
    );
}

/** What the club has won, newest first. */
export function HonoursSection({ club, more, all }: { club: PaneClub; more?: PaneMore; all?: boolean }) {
    const t = useWorldCopy();
    const honours = [...(club.honours ?? [])].sort((a, b) => (b.yearWon ?? 0) - (a.yearWon ?? 0));
    if (!honours.length) return null;
    return (
        <PaneSection title={t('Honours')} count={honours.length} more={more}>
            <ul className={`gk-peek-list${all ? ' gk-pane-grid' : ''}`}>{honours.slice(0, all ? undefined : 3).map(honour => (
                <li key={`${honour.title}:${honour.yearWon}`} className="gk-pane-honour"><Trophy aria-hidden="true" /><span>{honour.title}</span><small className="gk-faint">{honour.yearWon}</small></li>
            ))}</ul>
        </PaneSection>
    );
}

/** The club's public ways to reach it (its website, Instagram, email); in their tab, its address too. */
export function ContactSection({ club, more, all }: { club: PaneClub; more?: PaneMore; all?: boolean }) {
    const t = useWorldCopy();
    const { website, instagram, email } = contactWays(club);
    const ways = [
        website && { href: website, label: t('Website'), Icon: Globe },
        instagram && { href: instagram, label: 'Instagram', Icon: AtSign },
        email && { href: `mailto:${email}`, label: email, Icon: Mail },
    ].filter((way): way is { href: string; label: string; Icon: typeof Globe } => Boolean(way));
    const address = all ? club.addressText : null;
    if (!ways.length && !address) return null;
    return (
        <PaneSection title={t('Contact')} more={more}>
            {ways.length > 0 && <ul className="gk-pane-chips">{ways.map(way => (
                <li key={way.href}><a href={way.href} target={way.href.startsWith('mailto:') ? undefined : '_blank'} rel="noreferrer"><way.Icon aria-hidden="true" />{way.label}</a></li>
            ))}</ul>}
            {address && <p className="gk-pane-line"><small><MapPin aria-hidden="true" />{address}</small></p>}
        </PaneSection>
    );
}
