import { ButtonLink, EmptyNote, List } from '../../../../design/primitives';
import { formats } from '../../../matchExchange/api';
import { useWorldCopy } from '../../copy';
import { Crest } from '../../Crest';
import { ArrangementItem, FixtureItem, ListingItem } from '../../directories/matchItems';
import { codeLabel } from '../../format';
import { CompetitionRow, EventItemRow } from '../../rows';
import { useArrangements, useComingUp, useOpenCompetitions, useOpenMatches, useResults } from '../frontData';
import { Cluster, WorldField } from '../WorldField';
import { rowsFor, unique, when, type FieldProps } from './fieldProps';

/** Teams near the area looking for an opponent: a head coach's first reason to open World. */
export function OpenMatchesField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useOpenMatches(area);
    const items = [...(data.data?.items ?? [])].sort((a, b) => Date.parse(a.starts_at_iso) - Date.parse(b.starts_at_iso));
    const next = items[0];
    return (
        <WorldField id="matches" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={next ? `${t('Next')}: ${when(next.starts_at_iso, next.timezone)} · ${t(formats[next.format] ?? codeLabel(next.format))}` : undefined}
            all={{ label: t('All open matches'), to: '/world/matches?tab=exchange' }}>
            {items.length ? <List label={t('Teams looking for a match')}>{items.slice(0, rowsFor(side)).map(m => <ListingItem key={m.event_id} item={m} />)}</List>
                : <EmptyNote title={t('No open matches right now')} action={<ButtonLink size="sm" to="/world/matches/arrange">{t('Arrange a match')}</ButtonLink>}>{t('Teams post here when they need an opponent for a date.')}</EmptyNote>}
        </WorldField>
    );
}

/** Published matches and competitions near you in the next ten days. */
export function EventsField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useComingUp(area);
    const next = data.items[0];
    return (
        <WorldField id="events" side={side} count={data.data ? data.items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={next ? `${t('Next')}: ${when(next.startsAt)}` : t('Next 10 days')} all={{ label: t('All events'), to: data.all }}>
            {data.items.length ? <List label={t('Matches near you')}>{data.items.slice(0, rowsFor(side)).map(item => <EventItemRow key={`${item.kind}:${item.id}`} item={item} />)}</List>
                : <EmptyNote title={t('Nothing published near {city} in the next 10 days', { city: area.city })}>{t('Clubs and organisers publish matches and competitions here.')}</EmptyNote>}
        </WorldField>
    );
}

/** Leagues and cups taking entries now. */
export function CompetitionsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useOpenCompetitions();
    const items = data.data?.content ?? [];
    return (
        <WorldField id="competitions" side={side} count={data.data ? data.data.totalElements ?? items.length : null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={items[0]?.name} all={{ label: t('All competitions'), to: '/world/competitions?registration=OPEN' }}>
            {items.length ? <List label={t('Open for entries')}>{items.slice(0, rowsFor(side)).map(card => <CompetitionRow key={card.id} card={card} compact />)}</List>
                : <EmptyNote title={t('No competitions are taking entries')}>{t('New leagues and cups appear here when entries open.')}</EmptyNote>}
        </WorldField>
    );
}

/** Recently recorded results: opponents' form at a glance. */
export function ResultsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useResults();
    const items = data.data?.items ?? [];
    const clubs = unique(items.flatMap(m => [m.homeClubName, m.awayClubName]).filter((name): name is string => Boolean(name)), name => name).slice(0, 3);
    return (
        <WorldField id="results" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            thumb={clubs.length ? <Cluster>{clubs.map(name => <Crest key={name} name={name} size={30} />)}</Cluster> : undefined}
            hint={items[0]?.title} all={{ label: t('All results'), to: '/world/matches?period=HISTORY' }}>
            {items.length ? <List label={t('Latest results')}>{items.slice(0, rowsFor(side)).map(match => <FixtureItem key={match.id} item={match} />)}</List>
                : <EmptyNote title={t('No results recorded yet')} />}
        </WorldField>
    );
}

/** The friendlies this person is arranging: opponent, pitch and referee still to settle. */
export function ArrangementsField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useArrangements();
    const items = data.data?.items ?? [];
    return (
        <WorldField id="arrangements" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            hint={items[0] ? `${t('Next')}: ${when(items[0].starts_at_iso, items[0].timezone)}` : undefined}
            all={{ label: t('All your arrangements'), to: '/world/matches?tab=mine' }}>
            {items.length ? <List label={t('Your match arrangements')}>{items.slice(0, rowsFor(side)).map(m => <ArrangementItem key={m.event_id} item={m} />)}</List>
                : <EmptyNote title={t('Nothing being arranged')} action={<ButtonLink size="sm" to="/world/matches/arrange">{t('Arrange a match')}</ButtonLink>}>{t('Friendlies you arrange appear here until they are played.')}</EmptyNote>}
        </WorldField>
    );
}
