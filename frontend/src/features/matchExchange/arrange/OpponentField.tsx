import { useState } from 'react';
import { Avatar, Button, Field, Skeleton } from '../../../design/primitives';
import { Combobox } from '../../../design/Combobox';
import { useSearch } from '../../../design/useSearch';
import type { PublicSquad } from '../../clubs/publicJourney';
import type { ClubSearchResult } from '../../tournaments/domain';
import { searchClubs } from './api';
import { ChoiceChips } from './ChoiceChips';
import type { Opponent } from './matchPlan';

interface Load<T> { data: T | undefined; loading: boolean; error: string; retry: () => void }

/** The club to invite, found by name, then the squad of theirs we would like to play. */
export function OpponentField({ opponent, onOpponent, ownClubId, squads, targetSquadId, onTargetSquad, suggestedSquadId, error }: {
    opponent: Opponent | null; onOpponent: (value: Opponent | null) => void; ownClubId: number | null;
    squads: Load<PublicSquad[]>; targetSquadId: number; onTargetSquad: (id: number) => void; suggestedSquadId: number; error?: string;
}) {
    const [query, setQuery] = useState('');
    const results = useSearch(query, (q, signal) => searchClubs(q, signal));
    const clubs = results.items.filter(club => club.id !== ownClubId);
    const city = (club: ClubSearchResult) => club.cityName ?? club.city ?? '';

    if (!opponent) return (
        <Field label="Opponent" htmlFor="arrange-opponent" error={error} hint="Type at least two letters of the club’s name or town.">
            <Combobox id="arrange-opponent" label="Clubs" query={query} onQuery={setQuery} items={clubs} itemKey={club => club.id}
                status={results.status} placeholder="Search clubs" emptyText={`No club matches “${query.trim()}”.`} errorText="Club search is unavailable. Try again in a moment."
                renderItem={club => <>
                    <Avatar src={club.logoUrl} name={club.name} size={32} square />
                    <span className="gk-arrange__option-text"><strong>{club.name}</strong>{city(club) && <span>{city(club)}</span>}</span>
                </>}
                onSelect={club => { onOpponent({ id: club.id, name: club.name, logoUrl: club.logoUrl, city: city(club) || null }); setQuery(''); }} />
        </Field>
    );

    const choices = [...(squads.data ?? []).map(squad => ({ value: squad.id, label: squad.name })), { value: 0, label: 'Let them choose' }];
    return (
        <div className="gk-field">
            <span className="gk-field__label" id="arrange-opponent-label">Opponent</span>
            <div className="gk-arrange__picked" aria-labelledby="arrange-opponent-label">
                <Avatar src={opponent.logoUrl} name={opponent.name} size={40} square />
                <span className="gk-arrange__option-text"><strong>{opponent.name}</strong>{opponent.city && <span>{opponent.city}</span>}</span>
                <Button size="sm" variant="ghost" onClick={() => onOpponent(null)} aria-label={`Choose a different club instead of ${opponent.name}`}>Change</Button>
            </div>
            <span className="gk-field__label gk-arrange__sublabel" id="arrange-their-squad">Their squad</span>
            {squads.loading ? <Skeleton height={44} width="60%" />
                : squads.error ? <p className="gk-notice gk-notice--danger" role="alert">{opponent.name}’s squads could not load. <Button size="sm" onClick={squads.retry}>Try again</Button></p>
                    : <>
                        <ChoiceChips labelledBy="arrange-their-squad" choices={choices} value={targetSquadId} onChange={onTargetSquad} invalid={Boolean(error)} />
                        {error && <span className="gk-field__error" role="alert">{error}</span>}
                        {!error && <span className="gk-field__hint">{targetSquadId < 0 ? 'Choose the squad you want to play, or let them choose.'
                            : targetSquadId === 0 ? `${opponent.name} picks the squad when they accept.`
                                : `Only this squad can accept.${targetSquadId === suggestedSquadId ? ' Matched to your squad’s age group.' : ''}`}</span>}
                    </>}
        </div>
    );
}
