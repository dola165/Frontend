import { Button, EmptyNote } from '../../../design/primitives';
import { MediaImage } from '../../../components/ui/MediaImage';
import { useAuth } from '../../../context/AuthContext';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { useWorldCopy } from '../copy';
import { shortDate } from '../format';
import { loadMyTeams, NO_TEAMS } from '../scoreboard/myTeams';
import { useWorldData } from '../useWorldData';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { tournamentDetail } from './match/matchPeekData';
import { StageTable } from './match/MatchTable';
import './peek.css';
import './match/match-peek.css';

/**
 * A tournament over World: its banner, dates and who runs it, then each table (my teams marked), with the full
 * tournament page one link away. It opens on the left beside a match, or on the right from a list's "Table".
 */
export default function TournamentPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const { sessionId } = useAuth();
    const tournamentId = Number(id);
    const valid = Number.isInteger(tournamentId) && tournamentId > 0;
    const data = useWorldData(valid ? `tournament-peek:${tournamentId}` : null, () => tournamentDetail(tournamentId), 'This tournament could not load.');
    const teams = useWorldData(`my-teams:${sessionId}`, () => loadMyTeams(sessionId)).data ?? NO_TEAMS;
    if (data.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    const tournament = data.data;
    if (!tournament) return (
        <DrawerFrame title={t('Tournament')}>
            <EmptyNote title={data.error || t('This tournament could not load.')} action={valid ? <Button size="sm" onClick={data.retry}>{t('Try again')}</Button> : undefined} />
        </DrawerFrame>
    );
    const mine = new Set(tournament.entries.filter(entry => (entry.squadId != null && teams.squadIds.has(entry.squadId)) || (entry.squadId == null && entry.clubId != null && teams.clubIds.has(entry.clubId))).map(entry => entry.id));
    const dates = [shortDate(tournament.startDate), shortDate(tournament.endDate)].filter(Boolean);
    const banner = resolveMediaUrl(tournament.bannerImageUrl);
    // Top-level stages with a table; a group stage's groups each have their own.
    const tables = tournament.stages.filter(stage => ['LEAGUE', 'GROUP', 'ROUND_ROBIN'].includes(stage.stageType)).sort((a, b) => a.stageOrder - b.stageOrder).slice(0, 4);
    return (
        <DrawerFrame title={tournament.name} page={{ to: `/tournaments/${tournament.id}`, label: t('Tournament page') }}>
            {banner && <MediaImage className="gk-tpeek__banner" src={banner} alt="" />}
            <header className="gk-tpeek__head">
                <h3>{tournament.name}</h3>
                <small>{[dates.length ? [...new Set(dates)].join(' – ') : null, tournament.hostClubName ?? tournament.organizerName].filter(Boolean).join(' · ')}</small>
            </header>
            {tournament.description && <p className="gk-peek-about">{tournament.description}</p>}
            {tables.map(stage => <StageTable key={stage.id} tournament={tournament} stageId={stage.id} mine={mine} />)}
        </DrawerFrame>
    );
}
