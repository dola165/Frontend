import { useLocation } from 'react-router-dom';
import { Avatar, ButtonLink, EmptyNote, List } from '../../../../design/primitives';
import { buildLoginRedirectPath } from '../../../../utils/authRedirect';
import { plural, useWorldCopy } from '../../copy';
import { PersonItemRow } from '../../directories/peopleItems';
import { PersonRow } from '../../rows';
import { usePeopleNearby, useReferees, useSpecialists } from '../frontData';
import { Cluster, WorldField } from '../WorldField';
import { rowsFor, type FieldProps } from './fieldProps';

const ROLE_WORDS: Record<string, [string, string]> = { REFEREE: ['referee', 'referees'], COACH: ['coach', 'coaches'], AGENT: ['agent', 'agents'], SPECIALIST: ['specialist', 'specialists'], CLUB_STAFF: ['club staff', 'club staff'] };
const faces = (people: { id: number; fullName: string; avatarUrl: string | null }[]) => people.length
    ? <Cluster>{people.slice(0, 3).map(person => <Avatar key={person.id} src={person.avatarUrl} name={person.fullName} size={30} />)}</Cluster> : undefined;

/** Ways in for someone signed out: people are visible to members only. */
function SignIn() {
    const t = useWorldCopy();
    const location = useLocation();
    return <EmptyNote title={t('Coaches, referees and specialists')} action={<ButtonLink size="sm" variant="primary" to={buildLoginRedirectPath(location.pathname, location.search, location.hash)}>{t('Sign in')}</ButtonLink>}>{t('Sign in to find people by role and area.')}</EmptyNote>;
}

/** Coaches, referees, agents and specialists from outside the person's own club. */
export function PeopleField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = usePeopleNearby(area);
    const roles = Object.entries(data.items.reduce<Record<string, number>>((all, person) => ({ ...all, [person.role]: (all[person.role] ?? 0) + 1 }), {}))
        .sort((a, b) => b[1] - a[1]).map(([role, count]) => plural(count, ...(ROLE_WORDS[role] ?? [role.toLowerCase(), `${role.toLowerCase()}s`]) as [string, string]));
    return (
        <WorldField id="people" side={side} thumb={faces(data.items)} count={data.data && !data.searchOnly ? data.items.length : null}
            loading={data.loading} error={data.error} onRetry={data.retry} hint={roles.slice(0, 3).join(' · ') || undefined}
            all={data.signedIn ? { label: t('All people'), to: '/world/people' } : undefined}>
            {!data.signedIn ? <SignIn />
                : data.items.length ? <List label={t('People to know')}>{data.items.slice(0, rowsFor(side)).map(person => <PersonRow key={person.id} person={person} compact />)}</List>
                    : <EmptyNote title={t('Find people by name')} action={<ButtonLink size="sm" to="/world/people">{t('Search people')}</ButtonLink>} />}
        </WorldField>
    );
}

/** Referees who take matches, with the formats they cover and their terms. */
export function RefereesField({ side }: FieldProps) {
    const t = useWorldCopy();
    const data = useReferees();
    const items = data.data?.items ?? [];
    return (
        <WorldField id="referees" side={side} count={data.data?.total ?? null} loading={data.loading} error={data.error} onRetry={data.retry}
            thumb={faces(items.map(referee => ({ id: referee.user_id, fullName: referee.full_name, avatarUrl: null })))}
            hint={items.length ? `${plural(items.filter(referee => referee.accepts_volunteer).length, 'volunteer')} · ${plural(items.filter(referee => referee.accepts_paid).length, 'paid', 'paid')}` : undefined}
            all={{ label: t('All referees'), to: '/world/people?role=REFEREE' }}>
            {items.length ? <List label={t('Referees')}>{items.slice(0, rowsFor(side)).map(referee => <PersonItemRow key={referee.user_id} item={{ kind: 'referee', referee }} />)}</List>
                : <EmptyNote title={t('No referees listed yet')} />}
        </WorldField>
    );
}

/** Physios, fitness and nutrition specialists, psychologists and video analysts near you. */
export function SpecialistsField({ area, side }: FieldProps) {
    const t = useWorldCopy();
    const data = useSpecialists(area);
    const items = data.data?.searchOnly ? [] : data.data?.items ?? [];
    const signedIn = data.loading || data.data !== undefined || Boolean(data.error);
    const professions = [...new Set(items.map(person => person.profession).filter((value): value is string => Boolean(value)))];
    return (
        <WorldField id="specialists" side={side} thumb={faces(items)} count={data.data && !data.data.searchOnly ? items.length : null}
            loading={data.loading} error={data.error} onRetry={data.retry} hint={professions.slice(0, 3).join(' · ') || undefined}
            all={{ label: t('All specialists'), to: '/world/people?role=SPECIALIST' }}>
            {!signedIn ? <SignIn />
                : items.length ? <List label={t('Specialists')}>{items.slice(0, rowsFor(side)).map(person => <PersonRow key={person.id} person={person} compact />)}</List>
                    : <EmptyNote title={t('No specialists listed in {city} yet', { city: area.city })} action={<ButtonLink size="sm" to="/world/people?role=SPECIALIST">{t('Search specialists')}</ButtonLink>} />}
        </WorldField>
    );
}
