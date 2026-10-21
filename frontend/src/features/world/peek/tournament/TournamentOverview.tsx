import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { fixtureDay, fixtureTime } from '../../format';
import { HistoryLine } from '../../scoreboard/HistoryLine';
import { CupPath } from '../../scoreboard/MiniTable';
import { cupPath, nextFixture, zoned } from '../../scoreboard/standings';
import { StageTable } from '../match/MatchTable';
import { PaneSection } from '../PaneSection';
import { Bracket } from './Bracket';
import { TableView } from './ShapeTable';
import { PlannedView } from './ShapeView';
import { entryById, fixtureMatch, mineSideOf, sideName, visibleEntries, type TournamentPaneData, type TournamentPart } from './tournamentPane';

/** "View …" for the format's own tab, by its name. */
const VIEW: Record<string, string> = { Bracket: 'View bracket', Table: 'View table', Groups: 'View groups', Festival: 'View rounds', Ladder: 'View ladder' };

/** The final when it is the next match: both sides (or still to be decided), the day and time. The ground stays out until it can be named. */
function FinalPoster({ data, open }: { data: TournamentPaneData; open: (value: string) => void }) {
    const t = useWorldCopy();
    if (data.shape?.kind !== 'cup') return null;
    const final = data.shape.rounds.at(-1);
    const tie = final?.ties.length === 1 ? final.ties[0] : null;
    if (!tie || tie.state !== 'next') return null;
    const fixture = tie.fixtures[tie.fixtures.length - 1];
    const side = (id: number | null, label: string | null) => {
        const entry = entryById(data.detail, id), name = sideName(entry, label) ?? t('To be decided');
        return <span className="gk-tpane-final__side" data-tbd={id == null || undefined} data-mine={(id != null && data.mine.has(id)) || undefined}><Crest name={name} size={40} round /><b>{name}</b>{entry?.squadName && <small>{entry.squadName}</small>}</span>;
    };
    const when = tie.scheduledAt ? `${fixtureDay(zoned(tie.scheduledAt), data.rules?.timezone)} · ${fixtureTime(zoned(tie.scheduledAt), data.rules?.timezone)}` : t('Date to confirm');
    return (
        <button type="button" className="gk-tpane-final" onClick={() => open(`match-${fixtureMatch(data.detail, fixture).code}`)}>
            <small>{t('Final')} · {when}</small>
            <span className="gk-tpane-final__sides">{side(tie.home.entryId, fixture.homeLabel)}<span aria-hidden="true">{t('v')}</span>{side(tie.away.entryId, fixture.awayLabel)}</span>
        </button>
    );
}

/**
 * The tournament at a glance: my way through it (the cup run or my table), my next match or the final, then a little
 * of each part (the format's view, matches, teams, about) with "View …" to its tab.
 */
export function TournamentOverview({ data, open, select, shapeLabel }: {
    data: TournamentPaneData; open: (value: string) => void; select: (part: TournamentPart) => void; /** The format tab's name ("Bracket"). */ shapeLabel: string | null;
}) {
    const t = useWorldCopy();
    const { detail, shape, mine } = data;
    const mineSide = mineSideOf(data);
    const line = (fixture: (typeof detail.fixtures)[number]) => { const { match, code } = fixtureMatch(detail, fixture, data.canManage); return <HistoryLine key={fixture.id} match={match} crestOf={() => null} mine={mineSide} peek={`match-${code}`} open={open} />; };
    const knockout = detail.fixtures.filter(fixture => detail.stages.find(stage => stage.id === fixture.stageId)?.stageType === 'KNOCKOUT');
    const run = mine.size && knockout.some(fixture => mine.has(fixture.homeEntryId ?? -1) || mine.has(fixture.awayEntryId ?? -1)) ? cupPath(knockout, mine) : null;
    const tableStage = shape?.kind === 'league' ? shape.tables[0]?.stageId
        : shape?.kind === 'groups' ? (shape.groups.find(group => detail.fixtures.some(fixture => fixture.stageId === group.stageId && (mine.has(fixture.homeEntryId ?? -1) || mine.has(fixture.awayEntryId ?? -1)))) ?? shape.groups[0])?.stageId
        : undefined;
    // A ladder and Swiss rounds rank by the engine's own order (rating, Buchholz), which the stage's standings do not know.
    const ranked = shape?.kind === 'ladder' ? shape.table : shape?.kind === 'swiss' ? shape.tables[0] : null;
    // The final, when it is next, has its own poster; my next match is then not repeated above it.
    const finalTie = shape?.kind === 'cup' && shape.rounds.at(-1)?.ties.length === 1 ? shape.rounds.at(-1)!.ties[0] : null;
    const upcoming = nextFixture(detail.fixtures, mine);
    const next = upcoming && !(finalTie?.state === 'next' && finalTie.fixtures.some(fixture => fixture.id === upcoming.id)) ? upcoming : null;
    const played = detail.fixtures.filter(fixture => fixture.status === 'COMPLETED' && fixture.homeScore != null).sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? '')).slice(0, 3);
    const coming = detail.fixtures.filter(fixture => fixture.status === 'SCHEDULED' && fixture.homeEntryId != null && fixture.awayEntryId != null).sort((a, b) => (a.scheduledAt ?? '9').localeCompare(b.scheduledAt ?? '9')).slice(0, 3);
    const teams = visibleEntries(data);
    return <>
        {run && <section className="gk-pane-section"><h3 className="gk-peek-section__title">{t('Your run')}</h3><CupPath steps={run.steps} label={t('{name} run', { name: detail.name })} />{run.eliminated && <p className="gk-faint">{t('Out of the cup')}</p>}</section>}
        {next && <section className="gk-pane-section"><h3 className="gk-peek-section__title">{t('Your next match')}</h3><ul className="gk-sb__rows">{line(next)}</ul></section>}
        <FinalPoster data={data} open={open} />
        <div className="gk-pane-sections">
            {shapeLabel && <PaneSection title={t(shapeLabel)} more={{ label: t(VIEW[shapeLabel] ?? 'View all'), select: () => select('draw') }}>
                {!shape ? <PlannedView data={data} />
                    : shape.kind === 'cup' ? <Bracket rounds={shape.rounds.slice(-2)} detail={detail} mine={mine} label={t('{name} bracket', { name: detail.name })} open={open} />
                    : ranked ? <TableView table={ranked} detail={detail} mine={mine} />
                    : tableStage ? <StageTable tournament={detail} stageId={tableStage} mine={mine} level={4} label={shape.kind === 'groups' ? undefined : null} />
                    : <p className="gk-faint">{t('{count} matches', { count: detail.fixtures.length })}</p>}
            </PaneSection>}
            <PaneSection title={t('Matches')} count={detail.fixtures.length || undefined} more={{ label: t('View matches'), select: () => select('matches') }}>
                {played.length || coming.length ? <ul className="gk-sb__rows">{[...coming, ...played].slice(0, 4).map(line)}</ul> : <p className="gk-faint">{t('The matches appear once the draw is made.')}</p>}
            </PaneSection>
            <PaneSection title={t('Teams')} count={teams.length} more={{ label: t('View teams'), select: () => select('teams') }}>
                {teams.length ? <ul className="gk-pane-chips">{teams.slice(0, 8).map(entry => <li key={entry.id}><span className="gk-tpane-chip" data-mine={mine.has(entry.id) || undefined}><Crest name={sideName(entry) ?? '?'} size={16} round />{sideName(entry)}</span></li>)}</ul>
                    : <p className="gk-faint">{t('No teams have entered yet.')}</p>}
            </PaneSection>
            {detail.description && <PaneSection title={t('About')} more={{ label: t('View about'), select: () => select('about') }}><p className="gk-pane-note">{detail.description}</p></PaneSection>}
        </div>
    </>;
}
