import { FormatGlyph } from '../../../tournaments/shape/FormatGlyph';
import { plannedShape } from '../../../tournaments/shape/shapeOf';
import { useWorldCopy } from '../../copy';
import { HistoryLine } from '../../scoreboard/HistoryLine';
import { Bracket } from './Bracket';
import { TableView } from './ShapeTable';
import { fixtureMatch, mineSideOf, placesTaken, type TournamentPaneData } from './tournamentPane';

/** Before the draw: the format as a picture, the places, and when its shape is decided. */
export function PlannedView({ data }: { data: TournamentPaneData }) {
    const t = useWorldCopy();
    const shape = plannedShape(data.rules, data.detail.entryCap, placesTaken(data.detail));
    if (!shape) return <p className="gk-faint">{t('The organiser has not published the format yet.')}</p>;
    return (
        <div className="gk-tpane-planned">
            <span className="gk-tpane-planned__glyph"><FormatGlyph kind={shape.kind} /></span>
            <div>
                <b>{t(shape.word)}</b>
                <p>{shape.places ? t('{count} of {cap} places', { count: shape.entered ?? 0, cap: shape.places }) : t('{count} entered', { count: shape.entered ?? 0 })}</p>
                <p className="gk-faint">{shape.kind === 'festival' ? t('Each round is made on the day, so every team keeps playing.')
                    : shape.kind === 'ladder' ? t('Teams climb by challenging the teams above them.')
                    : shape.kind === 'swiss' ? t('Each round is paired after the one before, by points.')
                    : t('The organiser makes the draw after entries close: the groups, who meets whom and the dates are set then.')}</p>
            </div>
        </div>
    );
}

/** The format's own tab: the whole bracket, the tables, the groups and their finals, a festival's rounds, a ladder. */
export function ShapeView({ data, open }: { data: TournamentPaneData; open: (value: string) => void }) {
    const t = useWorldCopy();
    const { detail, shape, mine } = data;
    const mineSide = mineSideOf(data);
    if (!shape) return <PlannedView data={data} />;
    const line = (fixture: (typeof detail.fixtures)[number]) => {
        const { match, code } = fixtureMatch(detail, fixture, data.canManage);
        return <HistoryLine key={fixture.id} match={match} crestOf={() => null} mine={mineSide} peek={`match-${code}`} open={open} />;
    };
    if (shape.kind === 'cup') return <>
        <Bracket rounds={shape.rounds} detail={detail} mine={mine} label={t('{name} bracket', { name: detail.name })} open={open} />
        {shape.bronze && <Bracket rounds={[{ round: 0, name: 'Third place', ties: [shape.bronze] }]} detail={detail} mine={mine} label={t('Third place')} open={open} />}
    </>;
    if (shape.kind === 'groups') return <>
        <div className="gk-tpane-groups">{shape.groups.map(group => <TableView key={group.stageId} table={group} detail={detail} mine={mine} title={group.name} />)}</div>
        {shape.finals.length > 0 ? shape.finals.map(tier => <section key={tier.stageId} className="gk-tpane-tier">
            {shape.finals.length > 1 && <h4>{tier.name}</h4>}
            <Bracket rounds={tier.rounds} detail={detail} mine={mine} label={shape.finals.length > 1 ? tier.name : t('Finals')} open={open} />
            {tier.bronze && <Bracket rounds={[{ round: 0, name: 'Third place', ties: [tier.bronze] }]} detail={detail} mine={mine} label={t('Third place')} open={open} />}
        </section>) : <p className="gk-faint">{t('The finals are drawn when the groups are played.')}</p>}
    </>;
    if (shape.kind === 'festival') return shape.rounds.length ? <>{shape.rounds.map(round => (
        <section key={round.round} className="gk-tpane-round"><h4>{t('Round {n}', { n: round.round })}</h4><ul className="gk-sb__rows">{round.fixtures.map(line)}</ul></section>
    ))}</> : <PlannedView data={data} />;
    if (shape.kind === 'ladder') return <>
        {shape.table && <TableView table={shape.table} detail={detail} mine={mine} title={t('The ladder')} />}
        {shape.challenges.length > 0 && <section className="gk-tpane-round"><h4>{t('Challenges played')}</h4><ul className="gk-sb__rows">{shape.challenges.slice(0, 12).map(line)}</ul></section>}
    </>;
    return <>{shape.tables.map(table => <TableView key={table.stageId} table={table} detail={detail} mine={mine} title={shape.tables.length > 1 ? table.name : undefined} />)}</>;
}
