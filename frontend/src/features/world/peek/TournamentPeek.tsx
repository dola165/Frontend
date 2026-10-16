import { useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { Button, ButtonLink, EmptyNote } from '../../../design/primitives';
import { Tabs } from '../../../design/Tabs';
import { Status } from '../../../design/DataTable';
import { MediaImage } from '../../../components/ui/MediaImage';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { FormatGlyph } from '../../tournaments/shape/FormatGlyph';
import { plannedShape } from '../../tournaments/shape/shapeOf';
import { useWorldCopy } from '../copy';
import { feeLabel, placesLabel, tournamentFact, whatLabel, type TournamentItem } from '../directories/tournaments/tournamentItem';
import { shortDate } from '../format';
import { zoned } from '../scoreboard/standings';
import { DrawerFrame, DrawerLoading } from './DrawerFrame';
import { FollowHost } from './tournament/FollowHost';
import { TournamentAction } from './tournament/TournamentAction';
import { useTournamentGate, useTournamentPane } from './tournament/useTournamentGate';
import { ShapeView } from './tournament/ShapeView';
import { TournamentOverview } from './tournament/TournamentOverview';
import { TournamentAbout, TournamentMatches, TournamentTeams } from './tournament/TournamentParts';
import { organiserOf, placesTaken, tournamentChanged, tournamentParts, type TournamentPaneData, type TournamentPart } from './tournament/tournamentPane';
import { useRelatedOpen, usePeekPart } from './usePeek';
import './peek.css';
import './pane.css';
import './tournament/tournament-pane.css';

/**
 * A tournament beside the list (or in a drawer): its banner, format and who runs it, the one fact that matters now,
 * then tabs that switch in place: an overview (my run, my next match or the final, a little of each part), the
 * format's own view (the bracket, the table, the groups…), the matches, the teams and what the organiser published.
 * The tab shown is in the address; a match or the organiser opens stacked over it.
 */
export default function TournamentPeek({ id }: { id: string }) {
    const t = useWorldCopy();
    const tournamentId = Number(id);
    const valid = Number.isInteger(tournamentId) && tournamentId > 0;
    const data = useTournamentPane(tournamentId);
    if (data.loading) return <DrawerFrame title={t('Loading…')}><DrawerLoading /></DrawerFrame>;
    if (!data.data) return (
        <DrawerFrame title={t('Tournament')}>
            <EmptyNote title={data.error || t('This tournament could not load.')} action={valid ? <Button size="sm" onClick={data.retry}>{t('Try again')}</Button> : undefined} />
        </DrawerFrame>
    );
    return <TournamentPane data={data.data} reload={data.retry} />;
}

/** The tournament as a list item, so the pane says its one fact exactly as its row does. */
function asItem({ detail, rules, mine }: TournamentPaneData): TournamentItem {
    return {
        id: detail.id, name: detail.name, status: detail.status, scope: detail.participantScope, start: zoned(detail.startDate), end: zoned(detail.endDate),
        organizer: detail.hostClubName ?? detail.organizerName ?? null, banner: detail.bannerImageUrl ?? null, rules, entryCount: placesTaken(detail), entryCap: detail.entryCap ?? null,
        opensAt: zoned(detail.registrationOpensAt), closesAt: zoned(detail.registrationClosesAt),
        champion: detail.entries.find(entry => entry.id === detail.championEntryId)?.clubName ?? detail.championName ?? null,
        mine: detail.entries.filter(entry => mine.has(entry.id)).map(entry => ({ name: entry.squadName ?? entry.clubName ?? '', status: entry.status })),
    };
}

function TournamentPane({ data, reload }: { data: TournamentPaneData; reload: () => void }) {
    const t = useWorldCopy();
    const { detail, rules, host } = data;
    const [part, showPart] = usePeekPart();
    const related = useRelatedOpen();
    const ids = useId();
    const tabsTop = useRef<HTMLDivElement>(null);
    const parts = tournamentParts(data);
    const current = parts.find(item => item.id === part)?.id;
    const shown = current ?? 'overview';
    /** Shows a part (none: the overview), going back up to the tabs first when the pane was scrolled past them. */
    const select = (next?: TournamentPart, focus = false) => {
        const top = tabsTop.current, body = top?.closest<HTMLElement>('.gk-drawer__body');
        if (top && body) body.scrollTop = Math.min(body.scrollTop, top.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop);
        showPart(next);
        if (focus) setTimeout(() => document.getElementById(`${ids}-${next ?? 'overview'}`)?.focus({ preventScroll: true }));
    };
    const item = asItem(data), fact = tournamentFact(item);
    const entry = useTournamentGate(data), { gate } = entry;
    // The step under the head says how my entry stands, the invitation, or when entries open or closed: the head does not repeat it.
    const stepSaysIt = gate.kind === 'entered' || gate.kind === 'answer' || (gate.kind === 'reason' && (gate.reason === 'not-open' || gate.reason === 'closed'));
    const shape = plannedShape(rules, detail.entryCap, item.entryCount);
    const dates = [...new Set([shortDate(item.start), shortDate(item.end)].filter(Boolean))].join(' – ');
    const banner = resolveMediaUrl(detail.bannerImageUrl);
    const organiser = organiserOf(detail), organiserName = host?.name ?? detail.hostClubName ?? detail.organizerName;
    const shapeLabel = parts.find(entry => entry.id === 'draw')?.label ?? null;
    const view = shown === 'draw' ? <ShapeView data={data} open={related} />
        : shown === 'matches' ? <TournamentMatches data={data} open={related} />
        : shown === 'teams' ? <TournamentTeams data={data} />
        : shown === 'about' ? <TournamentAbout data={data} />
        : <TournamentOverview data={data} open={related} select={next => select(next, true)} shapeLabel={shapeLabel} />;
    return (
        <DrawerFrame title={detail.name} page={{ to: `/tournaments/${detail.id}`, label: t('Tournament page') }}>
            <div className="gk-pane-top">
                <div className="gk-pane-cover">{banner && <MediaImage src={banner} alt="" />}</div>
                <header className="gk-pane-head">
                    <span className="gk-tpane-badge" aria-hidden="true">{shape ? <FormatGlyph kind={shape.kind} /> : <Trophy />}</span>
                    <div>
                        <h3>{detail.name}</h3>
                        <p>{[shape && t(shape.word), ...whatLabel(item)].filter(Boolean).join(' · ')}</p>
                        <p className="gk-faint">{[dates, placesLabel(item), feeLabel(rules)].filter(Boolean).join(' · ')}</p>
                        {/* The organiser drawer knows only organisers World lists (with a public tournament); any other opens its own page. */}
                        {organiserName && <p className="gk-tpane-by">{t('by')} {host
                            ? <button type="button" className="gk-pane-more" onClick={() => related(`organiser-${organiser.peek}`)}>{organiserName}</button>
                            : <Link className="gk-pane-more" to={organiser.kind === 'CLUB' ? `/clubs/${organiser.id}` : `/organizations/${organiser.id}`}>{organiserName}</Link>}</p>}
                    </div>
                </header>
                <div className="gk-tpane-actions">
                    {data.canManage && <ButtonLink size="sm" variant="primary" to={`/tournaments/${detail.id}/workspace`}>{t('Open workspace')}</ButtonLink>}
                    {host && <FollowHost host={host} />}
                    {!stepSaysIt && <Status tone={fact.tone}>{fact.label}</Status>}
                </div>
                <TournamentAction data={data} entry={entry} reload={() => { tournamentChanged(detail.id); reload(); }} />
                <div ref={tabsTop} className="gk-pane-parts">
                    <Tabs className="gk-pane-tabs" label={t('{name} parts', { name: detail.name })} idBase={ids} value={shown} onChange={next => select(next === 'overview' ? undefined : next as TournamentPart)}
                        items={[{ id: 'overview', label: t('Overview') }, ...parts.map(entry => ({ id: entry.id, label: t(entry.label) }))]} />
                    <div role="tabpanel" id={`${ids}-${shown}-panel`} aria-labelledby={`${ids}-${shown}`} className="gk-pane-panel">{view}</div>
                </div>
            </div>
        </DrawerFrame>
    );
}
