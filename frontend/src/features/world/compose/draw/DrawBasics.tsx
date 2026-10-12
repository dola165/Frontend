import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button, Field } from '../../../../design/primitives';
import { Segmented } from '../../../../design/Tabs';
import { apiClient } from '../../../../api/axiosConfig';
import { ages } from '../../../matchExchange/api';
import { structures, type CompetitionRules, type Family, type Structure } from '../../../competitions/api';
import { ageCutoffFor, playedAt, usualSeasonPolicy } from '../../../tournaments/create/drawDraft';
import { CupGlyph, FestivalGlyph, GroupsGlyph, LadderGlyph, LeagueGlyph } from '../../../tournaments/shape/FormatGlyph';
import { FORMAT_WORD } from '../../../tournaments/shape/shapeOf';
import type { TournamentParticipantScope } from '../../../tournaments/domain';
import { useWorldCopy } from '../../copy';
import { codeLabel } from '../../format';
import type { useDrawRoom } from './useDrawRoom';
import '../../directory/pickers.css';

type Room = ReturnType<typeof useDrawRoom>;
const FAMILY_OF: Record<Structure, Family> = Object.fromEntries(Object.entries(structures).flatMap(([family, list]) => list.map(structure => [structure, family]))) as Record<Structure, Family>;
FAMILY_OF.SWISS = 'LEAGUE';
const TILES: { structure: Structure; Icon: typeof LeagueGlyph }[] = [
    { structure: 'ROUND_ROBIN', Icon: LeagueGlyph }, { structure: 'KNOCKOUT', Icon: CupGlyph }, { structure: 'GROUPS_KNOCKOUT', Icon: GroupsGlyph },
    { structure: 'ROTATION', Icon: FestivalGlyph }, { structure: 'LADDER', Icon: LadderGlyph },
];
const MORE: Structure[] = ['HOME_AWAY', 'SWISS', 'SPLIT_LEAGUE', 'KING_OF_PITCH'];

/** Who organises it: the one organisation chosen when there is only one, else a choice; with none, setting one up comes first. */
export function OrganiserQuestion({ room, onCreateOrganiser }: { room: Room; onCreateOrganiser: () => void }) {
    const t = useWorldCopy();
    const { creatable, organizerId, organisations, hostClubs, draft, update } = room;
    if (organisations.loading) return <p className="gk-faint">{t('Loading…')}</p>;
    if (organisations.error) return <p className="gk-step__error" role="alert">{organisations.error} <button type="button" className="gk-step__reload" onClick={organisations.retry}>{t('Try again')}</button></p>;
    if (!creatable.length) return (
        <div className="gk-draw__empty" data-field="organiser" tabIndex={-1}>
            <p>{t('A tournament is run by an organisation. Set one up first; this draft is kept.')}</p>
            <Button size="sm" variant="primary" onClick={onCreateOrganiser}>{t('Set up your organisation')}</Button>
        </div>
    );
    const chosen = creatable.find(organisation => organisation.id === organizerId);
    return <>
        {creatable.length > 1 ? <div className="gk-step__row" role="group" aria-label={t('Organiser')} data-field="organiser">
            {creatable.map(organisation => <button key={organisation.id} type="button" className="gk-chip" aria-pressed={organisation.id === organizerId} onClick={() => update({ organizerId: organisation.id, hostClubId: null })}>{organisation.displayName}</button>)}
        </div> : <p className="gk-draw__chosen" data-field="organiser" tabIndex={-1}>{chosen?.displayName}</p>}
        {(hostClubs.data?.length ?? 0) > 0 && <Field label={t('Hosted at a club')} htmlFor="draw-host" hint={t('Shown as the host on its page; its ground is not booked by this.')}>
            <select id="draw-host" className="gk-input" value={draft.hostClubId ?? ''} onChange={event => update({ hostClubId: event.target.value ? Number(event.target.value) : null })}>
                <option value="">{t('No host club')}</option>
                {hostClubs.data!.map(club => <option key={club.clubId} value={club.clubId}>{club.clubName}</option>)}
            </select>
        </Field>}
    </>;
}

/** Who plays: the age group (and the date ages count from), players per side, the game and the level. */
export function PlayersQuestion({ room }: { room: Room }) {
    const t = useWorldCopy();
    const { draft: { rules, startDate }, updateRules } = room;
    const year = Number(startDate.slice(0, 4)) || new Date().getFullYear();
    return <div className="gk-draw__grid">
        <Field label={t('Age group')} htmlFor="draw-age">
            <select id="draw-age" className="gk-input" value={rules.ageGroup} onChange={event => { const age = event.target.value; updateRules({ ...playedAt(age), ageGroup: age, ageCutoff: ageCutoffFor(age, year), playingLevel: age === 'SENIOR' || age === 'VETERANS' ? 'COMPETITIVE' : 'DEVELOPMENT' }); }}>
                {ages.map(age => <option key={age} value={age}>{codeLabel(age)}</option>)}
            </select>
        </Field>
        <div className="gk-field">
            <span className="gk-field__label" id="draw-side-label">{t('Players per side')}</span>
            <div className="gk-step__row" role="group" aria-labelledby="draw-side-label">
                {[5, 7, 9, 11].map(side => <button key={side} type="button" className="gk-chip" aria-pressed={rules.sideSize === side} onClick={() => updateRules({ sideSize: side })}>{side}v{side}</button>)}
                <input aria-label={t('Another number of players')} className="gk-input gk-draw__narrow" type="number" min={3} max={11} value={rules.sideSize} onChange={event => updateRules({ sideSize: Number(event.target.value) })} />
            </div>
        </div>
        <Field label={t('Game')} htmlFor="draw-discipline">
            <select id="draw-discipline" className="gk-input" value={rules.discipline} onChange={event => updateRules({ discipline: event.target.value as CompetitionRules['discipline'] })}>
                {Object.entries({ ASSOCIATION: 'Association football', FUTSAL: 'Futsal', BEACH: 'Beach soccer', WALKING: 'Walking football', OTHER: 'Other ruleset' }).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
            </select>
        </Field>
        <Field label={t('Level')} htmlFor="draw-level">
            <select id="draw-level" className="gk-input" value={rules.playingLevel} onChange={event => updateRules({ playingLevel: event.target.value })}>
                {['DEVELOPMENT', 'RECREATIONAL', 'COMPETITIVE', 'ELITE'].map(level => <option key={level} value={level}>{codeLabel(level)}</option>)}
            </select>
        </Field>
    </div>;
}

/** The format as picture tiles (the rarer ones in a list), and how many teams it takes. */
export function FormatQuestion({ room }: { room: Room }) {
    const t = useWorldCopy();
    const { draft, update } = room;
    const choose = (structure: Structure) => {
        const family = FAMILY_OF[structure];
        // The usual wording follows the format unless the organiser wrote their own.
        const seasonPolicy = draft.rules.seasonPolicy === usualSeasonPolicy(draft.rules.family) ? usualSeasonPolicy(family) : draft.rules.seasonPolicy;
        update({ rules: { ...draft.rules, family, structure, standings: family !== 'FESTIVAL' || draft.rules.standings, seasonPolicy } });
    };
    const teams = (value: number) => update({ entryCap: Math.max(2, Math.min(32, value)) });
    return <>
        <div className="gk-pick-tiles gk-draw__tiles" role="group" aria-label={t('Format')}>
            {TILES.map(({ structure, Icon }) => <button key={structure} type="button" className="gk-pick-tiles__tile" aria-pressed={draft.rules.structure === structure} onClick={() => choose(structure)}>
                <Icon aria-hidden="true" /><span>{t(FORMAT_WORD[structure])}</span>
            </button>)}
        </div>
        <Field label={t('Another format')} htmlFor="draw-more-format">
            <select id="draw-more-format" className="gk-input gk-draw__half" value={MORE.includes(draft.rules.structure) ? draft.rules.structure : ''} onChange={event => event.target.value && choose(event.target.value as Structure)}>
                <option value="">{t('One of the above')}</option>
                {MORE.map(structure => <option key={structure} value={structure}>{t(FORMAT_WORD[structure])}</option>)}
            </select>
        </Field>
        <div className="gk-field" data-field="entryCap" tabIndex={-1}>
            <span className="gk-field__label" id="draw-teams-label">{t('Teams')}</span>
            <div className="gk-draw__stepper" role="group" aria-labelledby="draw-teams-label">
                <Button size="sm" variant="ghost" aria-label={t('Fewer teams')} onClick={() => teams(draft.entryCap - 1)}><Minus aria-hidden="true" /></Button>
                <output aria-live="polite">{draft.entryCap}</output>
                <Button size="sm" variant="ghost" aria-label={t('More teams')} onClick={() => teams(draft.entryCap + 1)}><Plus aria-hidden="true" /></Button>
                {[4, 8, 16].map(count => <button key={count} type="button" className="gk-chip" aria-pressed={draft.entryCap === count} onClick={() => teams(count)}>{count}</button>)}
            </div>
            <span className="gk-field__hint">{t('Once full, entries join the waiting list.')}</span>
        </div>
    </>;
}

type Venue = { id: number; displayName: string; city?: string };
/** A published ground for the tournament, searched by name; to be agreed when none. */
function VenueField({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
    const t = useWorldCopy();
    const [query, setQuery] = useState('');
    const [venues, setVenues] = useState<Venue[]>([]);
    useEffect(() => {
        const abort = new AbortController();
        const timer = setTimeout(() => void apiClient.get<{ content: Venue[] }>('/venues', { signal: abort.signal, params: { q: query, size: 24 } }).then(result => setVenues(result.data.content)).catch(() => undefined), 200);
        return () => { clearTimeout(timer); abort.abort(); };
    }, [query]);
    return <Field label={t('Ground')} htmlFor="draw-venue" hint={t('Its public place; each match books its pitch separately.')}>
        <div className="gk-draw__venue">
            <input type="search" className="gk-input" aria-label={t('Search grounds')} placeholder={t('Search grounds')} value={query} onChange={event => setQuery(event.target.value)} />
            <select id="draw-venue" className="gk-input" value={value ?? ''} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
                <option value="">{t('To be agreed')}</option>
                {venues.map(venue => <option key={venue.id} value={venue.id}>{[venue.displayName, venue.city].filter(Boolean).join(' · ')}</option>)}
            </select>
        </div>
    </Field>;
}

/** When and where: the first and last day (the organiser's own clock), the ground, and the place for searches. */
export function WhenQuestion({ room }: { room: Room }) {
    const t = useWorldCopy();
    const { draft, update, updateRules } = room;
    return <>
        <div className="gk-draw__grid">
            <Field label={t('Starts')} htmlFor="draw-start"><input id="draw-start" data-field="startDate" type="datetime-local" className="gk-input" value={draft.startDate} onChange={event => update({ startDate: event.target.value })} /></Field>
            <Field label={t('Ends')} htmlFor="draw-end"><input id="draw-end" data-field="endDate" type="datetime-local" className="gk-input" min={draft.startDate} value={draft.endDate} onChange={event => update({ endDate: event.target.value })} /></Field>
        </div>
        <VenueField value={draft.venueId} onChange={venueId => update({ venueId })} />
        <details className="gk-draw__more">
            <summary><span className="gk-field__label">{t('Place for searches')}</span><span className="gk-field__hint">{[draft.rules.city, draft.rules.country, draft.rules.timezone].join(' · ')}</span></summary>
            <div className="gk-draw__grid">
                <Field label={t('City')} htmlFor="draw-city"><input id="draw-city" className="gk-input" maxLength={120} value={draft.rules.city} onChange={event => updateRules({ city: event.target.value })} /></Field>
                <Field label={t('Country')} htmlFor="draw-country"><input id="draw-country" className="gk-input" maxLength={100} value={draft.rules.country} onChange={event => updateRules({ country: event.target.value })} /></Field>
                <Field label={t('Time zone')} htmlFor="draw-zone"><input id="draw-zone" className="gk-input" maxLength={80} value={draft.rules.timezone} onChange={event => updateRules({ timezone: event.target.value })} /></Field>
            </div>
        </details>
    </>;
}

/** Who enters: clubs, squads or players on their own (only adults; a youth tournament takes club or squad entries). */
export function ScopeQuestion({ room }: { room: Room }) {
    const t = useWorldCopy();
    const { draft, update } = room;
    const youth = /^U\d+$/.test(draft.rules.ageGroup) && Number(draft.rules.ageGroup.slice(1)) <= 18;
    const items: { id: TournamentParticipantScope; label: string }[] = [{ id: 'CLUB', label: t('Clubs') }, { id: 'SQUAD', label: t('Squads') }, ...(youth ? [] : [{ id: 'PLAYER' as const, label: t('Players') }])];
    return <div data-field="scope" tabIndex={-1}>
        <Segmented label={t('Who enters')} value={draft.scope} onChange={scope => update({ scope })} items={items} />
        <p className="gk-field__hint">{youth ? t('Youth tournaments take club or squad entries; players enter on their own only as adults.')
            : draft.scope === 'PLAYER' ? t('Players enter themselves; you make the teams.') : draft.scope === 'SQUAD' ? t('A club enters one of its squads, named when it enters.') : t('A club enters; it may name the team that plays.')}</p>
    </div>;
}
