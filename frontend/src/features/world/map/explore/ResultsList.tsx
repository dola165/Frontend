import { useId } from 'react';
import { BadgeCheck, CalendarDays, Flag, LandPlot, Shield, Trophy } from 'lucide-react';
import { Badge, Button, EmptyNote, List, ListRow, Skeleton } from '../../../../design/primitives';
import { plural } from '../../format';
import { SORTS, type ExploreQuery, type PlaceTone } from './exploreQuery';
import { distanceLabel, typeLabel, type PlaceRecord } from './records';
import type { Discovery } from './useDiscovery';
import './explore.css';

const ICON: Record<PlaceTone, typeof Shield> = { club: Shield, venue: LandPlot, match: CalendarDays, trial: Flag, competition: Trophy };
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const weekdayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** Dated places lead with their time, like a fixture line; others with their kind. */
export function PlaceLead({ record }: { record: PlaceRecord }) {
    const at = record.startsAt ? new Date(record.startsAt) : null;
    // A date without a time (a competition's first day) leads with the day instead of a clock.
    const timed = Boolean(record.startsAt?.includes('T')) && !/T00:00(:00)?/.test(record.startsAt ?? '');
    if (at && !Number.isNaN(at.getTime())) return (
        <span className="gk-map-when" data-tone={record.tone}>
            <b className="gk-num">{timed ? timeFormat.format(at) : dateFormat.format(at)}</b>
            <small>{timed ? dayFormat.format(at).replace(',', '') : weekdayFormat.format(at)}</small>
        </span>
    );
    const Icon = ICON[record.tone];
    return <span className="gk-map-glyph" data-tone={record.tone}><Icon aria-hidden="true" /></span>;
}

function trailFor(record: PlaceRecord) {
    if (record.opportunity) return <Badge tone={record.opportunity.availability === 'WAITLIST' ? 'warning' : 'accent'}>{record.opportunity.availability === 'WAITLIST' ? 'Waiting list' : 'Taking players'}</Badge>;
    if (record.openChallenge) return <Badge tone="warning">Needs opponent</Badge>;
    if (record.joinPolicy === 'OPEN_TRIAL') return <Badge tone="accent">Open trials</Badge>;
    if (record.groups?.length) return <Badge tone="accent">{plural(record.groups.length, 'group', 'groups')}</Badge>;
    return null;
}

/** The places in the search, in sync with the map: hovering or focusing a row lights its point. */
export function ResultsList({ query, discovery, coverage, selectedKey, onSelect, onHover, onWiden }: {
    query: ExploreQuery; discovery: Discovery; coverage: string; selectedKey: string | null;
    onSelect: (record: PlaceRecord) => void; onHover: (key: string | null) => void; onWiden: () => void;
}) {
    const sortId = useId();
    const { records } = discovery;
    const filtered = query.activeFilters.length > 0 || Boolean(query.q);
    return (
        <div className="gk-map-results">
            <div className="gk-map-results__head">
                <p role="status" className="gk-map-results__count">
                    {discovery.loading ? 'Searching…' : discovery.error ? 'Search did not finish' : <><strong className="gk-num">{records.length}</strong> {records.length === 1 ? 'place' : 'places'} · {coverage}</>}
                </p>
                <label className="gk-map-results__sort" htmlFor={sortId}>
                    <span className="gk-visually-hidden">Sort results</span>
                    <select id={sortId} className="gk-input" value={query.sort} onChange={event => query.setSort(event.target.value)}>
                        {SORTS.map(sort => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
                    </select>
                </label>
            </div>
            {discovery.loading ? (
                <div role="status" aria-label="Loading places">
                    {Array.from({ length: 6 }, (_, index) => <div key={index} className="gk-map-skeleton-row"><Skeleton height={40} width={40} /><div><Skeleton height={15} width="55%" /><Skeleton height={12} width="75%" /></div></div>)}
                </div>
            ) : discovery.error ? (
                <div className="gk-notice gk-notice--danger gk-map-results__notice" role="alert">
                    <span className="gk-world-grow">{discovery.error}</span>
                    <Button size="sm" onClick={discovery.retry}>Try again</Button>
                </div>
            ) : !records.length ? (
                <EmptyNote title={filtered ? 'Nothing matches this search here' : 'No places in this area yet'}
                    action={filtered ? <Button size="sm" onClick={query.clearFilters}>Clear filters</Button> : <Button size="sm" onClick={onWiden}>Search a wider area</Button>}>
                    {filtered ? 'Remove a filter, or move the map and search this area.' : 'Zoom out or move the map, then search this area.'}
                </EmptyNote>
            ) : (
                <>
                    <List label="Places on the map">
                        {records.map(record => (
                            <ListRow key={record.key} current={record.key === selectedKey} onClick={() => onSelect(record)} onHover={active => onHover(active ? record.key : null)}
                                lead={<PlaceLead record={record} />}
                                title={<span className="gk-world-row-title"><span>{record.title}</span>{record.verified && <BadgeCheck className="gk-world-verified" aria-label="Verified" />}</span>}
                                meta={[typeLabel(record), record.opportunity ? record.subtitle : record.city || record.address, distanceLabel(record.distanceKm)].filter(Boolean).join(' · ')}
                                trail={trailFor(record)} />
                        ))}
                    </List>
                    {(discovery.canLoadMore || discovery.limited) && (
                        <div className="gk-map-results__more">
                            {discovery.canLoadMore
                                ? <Button onClick={discovery.loadMore} disabled={discovery.loadingMore}>{discovery.loadingMore ? 'Loading…' : 'Show more places'}</Button>
                                : <p className="gk-faint">More places exist here. Zoom in or narrow the filters to see them.</p>}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
