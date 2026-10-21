import type { Participant } from '../../../admissions/types';
import { useWorldCopy } from '../../copy';
import type { PaneMore } from '../PaneSection';
import { clubTab, type ClubExtras, type ClubPart, type PaneClub } from './clubPane';
import { ContactSection, HonoursSection, JobsSection, MatchesSection, PeopleSection, ProgrammesSection, TeamsSection, TrialsSection, VenuesSection } from './ClubSections';

interface PartProps { club: PaneClub; extras: ClubExtras; /** The child a parent is searching for. */ child?: Participant; player?: string | null }

/** Links to the club's Teams & training (a team, a programme), keeping the child a parent is searching for. */
const teamsLink = (club: PaneClub, player?: string | null) => (extra: Record<string, string> = {}) => clubTab(club.id, 'teams', extra, player);

/**
 * The club at a glance: what it says about itself, then a little of each part (programmes first for a parent searching
 * for a child), each with "View …" to its own tab in the pane.
 */
export function ClubOverview({ club, extras, child, player, select }: PartProps & { select: (part: ClubPart) => void }) {
    const t = useWorldCopy();
    const view = (label: string, part: ClubPart): PaneMore => ({ label: t(label), select: () => select(part) });
    const programmes = <ProgrammesSection key="programmes" club={club} child={child} link={teamsLink(club, player)} more={view('View programmes', 'teams')} />;
    const teams = extras.squads.length > 0 && <TeamsSection key="teams" squads={extras.squads} coaches={extras.coaches} link={teamsLink(club, player)} more={view('View teams', 'teams')} />;
    return (
        <>
            {club.description && <p className="gk-club-pane__about">{club.description}</p>}
            <div className="gk-pane-sections">
                {child ? [programmes, teams] : [teams, programmes]}
                {extras.coaches.length > 0 && <PeopleSection title="Coaches" people={extras.coaches} more={view('View coaches', 'coaches')} />}
                {extras.management.length > 0 && <PeopleSection title="Management" people={extras.management} shown={3} more={view('View management', 'management')} />}
                {(extras.next.length > 0 || extras.results.length > 0) && <MatchesSection next={extras.next} results={extras.results} more={view('View matches', 'matches')} />}
                {extras.trials.length > 0 && <TrialsSection trials={extras.trials} count={extras.trialCount} more={view('View trials', 'trials')} />}
                {extras.jobs.length > 0 && <JobsSection jobs={extras.jobs} more={view('View jobs', 'jobs')} />}
                {extras.venues.length > 0 && <VenuesSection places={extras.venues} more={view('View venues', 'venues')} />}
                <HonoursSection club={club} more={view('All honours', 'honours')} />
                <ContactSection club={club} more={view('All contact details', 'contact')} />
            </div>
        </>
    );
}

/**
 * One part of the club on its own tab in the pane: all of it, with a little more about each (who coaches each team,
 * which teams each coach has, how often a programme trains). Its full tab is the frame's "Club page".
 */
export function ClubPartView({ part, club, extras, child, player }: PartProps & { part: ClubPart }) {
    const t = useWorldCopy();
    switch (part) {
        case 'teams': {
            const programmes = <ProgrammesSection key="programmes" club={club} child={child} link={teamsLink(club, player)} all />;
            const teams = extras.squads.length > 0 && <TeamsSection key="teams" squads={extras.squads} coaches={extras.coaches} link={teamsLink(club, player)} all />;
            return <div className="gk-pane-sections">{child ? [programmes, teams] : [teams, programmes]}</div>;
        }
        case 'coaches': return <PeopleSection title="Coaches" people={extras.coaches} all />;
        case 'management': return <PeopleSection title="Management" people={extras.management} all />;
        case 'matches': return <div className="gk-pane-sections"><MatchesSection next={extras.next} results={extras.results} all /></div>;
        case 'venues': return <VenuesSection places={extras.venues} all />;
        case 'trials': return <TrialsSection trials={extras.trials} count={extras.trialCount} all
            more={extras.trialCount > extras.trials.length ? { label: t('All {count} trials', { count: extras.trialCount }), to: `/world/opportunities?tab=trials&clubId=${club.id}` } : undefined} />;
        case 'jobs': return <JobsSection jobs={extras.jobs} all />;
        case 'honours': return <HonoursSection club={club} all />;
        case 'contact': return <ContactSection club={club} all />;
    }
}
