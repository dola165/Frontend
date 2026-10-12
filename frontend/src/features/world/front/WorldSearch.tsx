import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { List, ListRow, Panel, SearchInput, Skeleton } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { buildLoginRedirectPath } from '../../../utils/authRedirect';
import { fetchVenues } from '../../venues/api';
import { browseCompetitions } from '../../competitions/api';
import { getMatchHistory } from '../../matchHistory/api';
import { searchTryouts } from '../../tryouts/api';
import { fetchClubDirectory, fetchPeople } from '../api';
import { anyOf, useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { clubTypeLabel, codeLabel, fixtureDay, fixtureTime, shortDate } from '../format';
import { PersonRow } from '../rows';
import { useWorldData } from '../useWorldData';

interface Hit { key: string; to: string; row: ReactNode }
interface Group { id: string; title: string; all: string; hits: Hit[] | null; note?: ReactNode }

const settled = <T,>(result: PromiseSettledResult<T>) => (result.status === 'fulfilled' ? result.value : null);
const DEBOUNCE = 250;

/**
 * Search across World, in the page header: the best few clubs, people, venues, competitions and matches,
 * dropping down over the page, each with a way into its directory. Enter opens the first result of exactly what was typed: if the results
 * on screen belong to older text, it searches the new text first and opens its first result.
 */
export function WorldSearch() {
    const t = useWorldCopy();
    const root = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(true);
    const { status, sessionId } = useAuth();
    const navigate = useNavigate();
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    // Text Enter was pressed for while its results were still on the way.
    const enterFor = useRef<string | null>(null);
    useEffect(() => {
        const timer = window.setTimeout(() => setQ(text.trim()), DEBOUNCE);
        return () => window.clearTimeout(timer);
    }, [text]);
    const signedIn = status === 'authenticated';
    const search = useWorldData(q.length >= 2 ? `world-search:${signedIn}:${q}` : null, async signal => {
        const clubParams = new URLSearchParams({ search: q, page: '0', size: '4', sort: 'MEMBER_COUNT' });
        const [clubs, venues, competitions, people, matches, trials] = await Promise.allSettled([
            fetchClubDirectory(clubParams, signal),
            fetchVenues({ q, page: 0, size: 3, durationMinutes: 60 }, signal),
            browseCompetitions(new URLSearchParams({ q, page: '0', size: '3' }), signal),
            signedIn ? fetchPeople({ q, size: 4 }, sessionId, signal) : Promise.resolve(null),
            signedIn ? getMatchHistory(new URLSearchParams({ period: 'UPCOMING', q, page: '0', size: '3' }).toString(), signal, sessionId) : Promise.resolve(null),
            searchTryouts({ q, status: 'OPEN', page: 0, size: 3 }, signal),
        ]);
        return { clubs: settled(clubs), venues: settled(venues), competitions: settled(competitions), people: settled(people), matches: settled(matches), trials: settled(trials) };
    });
    const query = encodeURIComponent(q);
    const groups: Group[] = search.data ? [
        { id: 'clubs', title: 'Clubs', all: `/world/clubs?q=${query}`, hits: search.data.clubs?.content.map(club => ({ key: `c${club.id}`, to: `/clubs/${club.id}`, row: <ListRow to={`/clubs/${club.id}`} lead={<Crest src={club.logoUrl} name={club.name} size={32} />} title={club.name} meta={[t(clubTypeLabel(club.type)), club.cityName].filter(Boolean).join(' · ')} /> })) ?? null },
        { id: 'people', title: 'People', all: `/world/people?q=${query}`, hits: signedIn ? search.data.people?.items.map(person => ({ key: `p${person.id}`, to: `/profile/${person.id}`, row: <PersonRow person={person} compact /> })) ?? null : [],
            note: signedIn ? undefined : <Link className="gk-section__action" to={buildLoginRedirectPath('/world', '', '')}>{t('Sign in to search people')}</Link> },
        { id: 'venues', title: 'Venues', all: `/world/venues?q=${query}`, hits: search.data.venues?.content.map(venue => ({ key: `v${venue.id}`, to: `/stadiums/${venue.id}`, row: <ListRow to={`/stadiums/${venue.id}`} lead={<Crest src={venue.logoUrl} name={venue.displayName} size={32} />} title={venue.displayName} meta={venue.addressText || venue.city} /> })) ?? null },
        { id: 'competitions', title: 'Tournaments', all: `/world/tournaments?tab=all&q=${query}`, hits: search.data.competitions?.content.map(card => ({ key: `t${card.id}`, to: `/tournaments/${card.id}`, row: <ListRow to={`/tournaments/${card.id}`} lead={<Crest src={card.bannerImageUrl} name={card.name} size={32} />} title={card.name} meta={[shortDate(card.startDate), card.hostClubName || card.organizerName].filter(Boolean).join(' · ')} /> })) ?? null },
        { id: 'trials', title: 'Trials', all: `/world/opportunities?tab=trials&q=${query}`, hits: search.data.trials?.items.map(trial => ({ key: `r${trial.id}`, to: `/tryouts/${trial.id}`, row: <ListRow to={`/tryouts/${trial.id}`} lead={<span className="gk-world-search__when gk-num">{fixtureTime(trial.tryoutDate)}<small>{fixtureDay(trial.tryoutDate)}</small></span>} title={trial.title} meta={[trial.clubName, codeLabel(trial.ageGroup)].filter(Boolean).join(' · ')} /> })) ?? null },
        ...(signedIn ? [{ id: 'matches', title: 'Matches', all: `/world/matches?q=${query}`, hits: search.data.matches?.items.map(match => ({ key: `m${match.id}`, to: match.detailPath, row: <ListRow to={match.detailPath} lead={<span className="gk-world-search__when gk-num">{fixtureTime(match.startsAt)}<small>{fixtureDay(match.startsAt)}</small></span>} title={match.homeClubName && match.awayClubName ? `${match.homeClubName} v ${match.awayClubName}` : match.title} meta={match.locationName ?? undefined} /> })) ?? null }] : []),
    ] : [];
    const firstHit = groups.flatMap(group => group.hits ?? [])[0];
    const empty = groups.filter(group => !group.note && group.hits?.length === 0);
    const failed = groups.filter(group => !group.note && group.hits === null);

    // Enter pressed before the results caught up: open the first result once they are for that text.
    const ready = search.data !== undefined;
    useEffect(() => {
        if (enterFor.current === null || enterFor.current !== q || !ready) return;
        enterFor.current = null;
        if (firstHit) navigate(firstHit.to);
    }, [q, ready, firstHit, navigate]);
    const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') { setOpen(false); enterFor.current = null; }
        if (event.key !== 'Enter') return;
        const wanted = text.trim();
        if (wanted.length < 2) return;
        if (wanted === q && ready) { if (firstHit) navigate(firstHit.to); return; }
        enterFor.current = wanted;
        setQ(wanted);
    };
    const active = open && text.trim().length >= 2;
    // Results drop down over the page; a click elsewhere folds them away and the text stays.
    useEffect(() => {
        if (!active) return;
        const away = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, [active]);
    const count = groups.reduce((sum, group) => sum + (group.hits?.length ?? 0), 0);
    return (
        <div ref={root} className="gk-world-search" data-open={active || undefined}>
            <SearchInput className="gk-world-search__input" value={text} onChange={event => { setText(event.target.value); setOpen(true); enterFor.current = null; }} onKeyDown={onKey} onFocus={() => setOpen(true)} maxLength={120}
                placeholder={t('Search clubs, people, venues, matches…')} aria-label={t('Search GrassKickZ World')} aria-describedby="world-search-status" />
            <p id="world-search-status" className="gk-visually-hidden" role="status">
                {active ? search.loading ? t('Searching…') : t('{count} results. Press Enter to open the first.', { count }) : ''}
            </p>
            {active && (
                <div className="gk-world-search__results" aria-label={t('Search results')}>
                    {(search.loading || !search.data ? ['clubs', 'people', 'venues', 'competitions'] : []).map(id => (
                        <Panel key={id} flush><div className="gk-world-search__loading"><Skeleton height={14} width="30%" /><Skeleton height={36} /><Skeleton height={36} /></div></Panel>
                    ))}
                    {groups.filter(group => group.note || group.hits?.length).map(group => (
                        <Panel key={group.id} flush title={t(group.title)} action={group.hits?.length ? <Link className="gk-section__action" to={group.all}>{t('See all')}</Link> : undefined}>
                            {group.note ? <p className="gk-world-search__note">{group.note}</p>
                                : <List label={t(group.title)}>{group.hits!.map(hit => <Fragment key={hit.key}>{hit.row}</Fragment>)}</List>}
                        </Panel>
                    ))}
                    {search.data && (empty.length > 0 || failed.length > 0) && (
                        <p className="gk-world-search__none">
                            {empty.length > 0 && <>{t('No {things} match “{q}”.', { things: anyOf(empty.map(group => t(group.title).toLowerCase())), q })} </>}
                            {failed.length > 0 && t('{things} could not be searched.', { things: anyOf(failed.map(group => t(group.title))) })}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
