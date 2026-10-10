import { fetchTournament } from '../../tournaments/api';
import { fetchClubProfile } from '../api';
import { wt } from '../copy';
import type { ScopeFilter } from '../directory/types';

const id = (value: string) => (/^[1-9]\d*$/.test(value) ? Number(value) : null);

/** One club, from a link: the chip carries the club's name. */
export const clubScope = (key: string): ScopeFilter => ({
    kind: 'scope', key, label: 'One club',
    name: (value, signal) => (id(value) ? fetchClubProfile(id(value)!, signal).then(club => club.name) : Promise.resolve(null)),
});

/** One competition, from a link: the chip carries the competition's name. */
export const competitionScope = (key: string): ScopeFilter => ({
    kind: 'scope', key, label: 'One competition',
    name: value => (id(value) ? fetchTournament(id(value)!).then(competition => competition.name) : Promise.resolve(null)),
});

/** A filter a link carries that this list cannot apply: shown as "City: Batumi" so it can be removed. */
export const valueScope = (key: string, label: string): ScopeFilter => ({
    kind: 'scope', key, label, name: async value => `${wt(label)}: ${value === 'true' ? wt('Yes') : value}`,
});
