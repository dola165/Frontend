import { useAuth } from '../../../context/AuthContext';
import { useWorldData } from '../../world/useWorldData';
import type { PublicSquad } from '../../clubs/publicJourney';
import type { Squad } from '../api';
import { clubGrounds, clubProfile, clubSquads, coachedSquadIds, mySquads, type Ground } from './api';
import { ageGroupOf, suggestOurSquad, suggestTheirSquad, type Draft } from './matchPlan';

/** Everything the form reads: our squads and grounds, and the chosen opponent's squads and grounds. */
export function useArrangeData(draft: Pick<Draft, 'opponent' | 'squadId' | 'targetSquadId'>) {
    const { sessionId } = useAuth();
    const squads = useWorldData<Squad[]>(`arrange-squads:${sessionId}`, mySquads, 'Your squads could not load.');
    const coached = useWorldData<number[]>(`arrange-coached:${sessionId}`, coachedSquadIds);
    const ownClubId = squads.data?.find(squad => squad.id === draft.squadId)?.club_id ?? squads.data?.[0]?.club_id ?? null;
    const ownClub = useWorldData(ownClubId ? `arrange-club:${ownClubId}` : null, signal => clubProfile(ownClubId!, signal));
    const ours = useWorldData<Ground[]>(ownClubId ? `arrange-grounds:${ownClubId}` : null, signal => clubGrounds(ownClubId!, signal));
    const opponentId = draft.opponent?.id ?? null;
    const theirSquads = useWorldData<PublicSquad[]>(opponentId ? `arrange-their-squads:${opponentId}` : null, signal => clubSquads(opponentId!, signal));
    const theirs = useWorldData<Ground[]>(opponentId ? `arrange-their-grounds:${opponentId}` : null, signal => clubGrounds(opponentId!, signal));

    // Prefill only when the choice is obvious; an explicit choice always wins.
    const ourList = squads.data ?? [];
    const coachedIds = coached.data ?? [];
    const theirList = theirSquads.data ?? [];
    const chosenTheirs = theirList.find(squad => squad.id === draft.targetSquadId) ?? null;
    const squadId = draft.squadId || suggestOurSquad(ourList, coachedIds, chosenTheirs);
    const ourSquad = ourList.find(squad => squad.id === squadId) ?? null;
    const suggestedTheirs = suggestTheirSquad(theirList, ourSquad);
    const targetSquadId = draft.targetSquadId >= 0 ? draft.targetSquadId : suggestedTheirs || -1;
    return {
        squads, coached: coachedIds, ownClubId, ownCity: ownClub.data?.cityName ?? ours.data?.[0]?.city ?? '',
        ours, theirSquads, theirs, squadId, ourSquad, ageGroup: ageGroupOf(ourSquad?.category), targetSquadId, suggestedTheirs,
    };
}
