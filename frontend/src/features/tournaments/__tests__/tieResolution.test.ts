import { apiClient } from '../../../api/axiosConfig';
import { fetchTournamentTieHistory, fetchTournamentTieState, resolveTournamentTie } from '../api';
import { buildTournamentTieResolution, type TournamentTieContest } from '../domain';

vi.mock('../../../api/axiosConfig', () => ({
    apiClient: { get: vi.fn(), post: vi.fn() },
}));

const contest: TournamentTieContest = {
    key: 'RANK:10:1', stageId: 10, fixtureId: null, rank: 1,
    candidateEntryIds: [21, 22], sourceRevision: '4:7:9',
    ruleContext: 'points DESC, goal difference DESC, goals for DESC',
    status: 'UNRESOLVED', selectedEntryId: null, resolutionId: null,
    consequential: true, readyForResolution: true,
};

describe('tournament tie-resolution contract', () => {
    beforeEach(() => vi.clearAllMocks());

    it('copies the opaque key, exact candidate set, revision, selected contender, and trimmed note', () => {
        expect(buildTournamentTieResolution(contest, 22, '  Witnessed drawing of lots  ')).toEqual({
            key: 'RANK:10:1', sourceRevision: '4:7:9', candidateEntryIds: [21, 22],
            selectedEntryId: 22, note: 'Witnessed drawing of lots',
        });
    });

    it('defends against an invalid candidate without calling the server', async () => {
        expect(() => buildTournamentTieResolution(contest, 99, 'Reason')).toThrow(/tied contenders supplied by the server/i);
        await expect(resolveTournamentTie(7, contest, 99, 'Reason')).rejects.toThrow(/tied contenders supplied by the server/i);
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('uses the authoritative state, audit, and resolution endpoints', async () => {
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { contests: [], blocked: false, staleStageIds: [], blockedStageIds: [] } });
        vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });
        vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { contests: [], blocked: false, staleStageIds: [], blockedStageIds: [] } });
        await fetchTournamentTieState(7);
        await fetchTournamentTieHistory(7);
        await resolveTournamentTie(7, contest, 21, 'Documented coin toss');
        expect(apiClient.get).toHaveBeenNthCalledWith(1, '/tournaments/7/tie-state');
        expect(apiClient.get).toHaveBeenNthCalledWith(2, '/tournaments/7/tie-resolutions');
        expect(apiClient.post).toHaveBeenCalledWith('/tournaments/7/tie-resolutions', expect.objectContaining({
            key: contest.key, sourceRevision: contest.sourceRevision, candidateEntryIds: [21, 22], selectedEntryId: 21,
        }));
    });
});
