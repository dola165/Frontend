import type { ComponentType } from 'react';
import type { FieldId } from './fields';
import type { FieldProps } from './fields/fieldProps';
import { ArrangementsField, CompetitionsField, EventsField, LiveCompetitionsField, OpenMatchesField, RefereeNeededField, ResultsField } from './fields/MatchFields';
import { CampaignsField, CoachingJobsField, JobsField, StaffJobsField, TrialsField, VolunteeringField } from './fields/OpportunityFields';
import { PeopleField, RefereesField, SpecialistsField } from './fields/PeopleFields';
import { AcademiesField, ClubsField, GroupsField, OpenClubsField, VenuesField } from './fields/PlaceFields';
import { MatchLoadField, NextOpponentField, SquadFixturesField, WatchOpponentsField } from './fields/SquadFields';
import { InvitationsField, OpponentsForYouField, RefereesForYouField } from './fields/ExchangeFields';
import { AgeTrialsField, CompetitionResultsField, CompetitionsForYouField, MyCompetitionsField } from './fields/CompetitionFields';
import { FreePitchesField, IndoorPitchesField } from './fields/PitchFields';
import { FromClubsField } from './fields/FromClubsField';

/** The view for every field of the front page. */
export const FIELD_VIEWS: Record<FieldId, ComponentType<FieldProps>> = {
    nextOpponent: NextOpponentField, squadFixtures: SquadFixturesField, matchLoad: MatchLoadField, watchOpponents: WatchOpponentsField,
    invitations: InvitationsField, opponentsForYou: OpponentsForYouField, refereesForYou: RefereesForYouField,
    myCompetitions: MyCompetitionsField, competitionResults: CompetitionResultsField, competitionsForYou: CompetitionsForYouField, ageTrials: AgeTrialsField,
    freePitches: FreePitchesField, indoorPitches: IndoorPitchesField, fromClubs: FromClubsField,
    matches: OpenMatchesField, events: EventsField, refereeNeeded: RefereeNeededField, competitions: CompetitionsField, liveCompetitions: LiveCompetitionsField,
    results: ResultsField, arrangements: ArrangementsField,
    people: PeopleField, referees: RefereesField, specialists: SpecialistsField,
    clubs: ClubsField, academies: AcademiesField, openClubs: OpenClubsField, groups: GroupsField, venues: VenuesField,
    trials: TrialsField, jobs: JobsField, coachingJobs: CoachingJobsField, staffJobs: StaffJobsField, volunteering: VolunteeringField, campaigns: CampaignsField,
};
