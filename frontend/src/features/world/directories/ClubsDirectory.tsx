import { Plus } from 'lucide-react';
import { ButtonLink } from '../../../design/primitives';
import { useAuth } from '../../../context/AuthContext';
import { fetchMapDiscovery } from '../../../api/map';
import type { ClubProfile } from '../../../components/discovery/clubDirectoryTypes';
import { fetchClubDirectory } from '../api';
import { ClubCard } from '../cards/ClubCard';
import { DirectoryPage } from '../directory/DirectoryPage';
import { first, type DirectorySource } from '../directory/types';
import { clubTypeLabel } from '../format';
import { useWorldSession } from '../worldSession';

const PAGE = 12;

const clubs: DirectorySource<ClubProfile> = {
    id: 'clubs',
    label: 'Clubs',
    noun: ['club', 'clubs'],
    searchLabel: 'Search clubs',
    searchPlaceholder: 'Search clubs by name or area',
    layout: 'cards',
    pageSize: PAGE,
    filters: [
        { kind: 'choice', key: 'type', label: 'Club type', primary: true, multi: true, options: [
            { value: 'ACADEMY', label: 'Academies' }, { value: 'SCHOOL', label: 'Football schools' }, { value: 'GRASSROOTS', label: 'Grassroots' },
            { value: 'AMATEUR', label: 'Amateur' }, { value: 'SEMI_PROFESSIONAL', label: 'Semi-professional' }, { value: 'PROFESSIONAL', label: 'Professional' }, { value: 'OTHER', label: 'Other' },
        ] },
        { kind: 'choice', key: 'joinPolicy', label: 'How to join', primary: true, multi: true, options: [
            { value: 'OPEN_TRIAL', label: 'Open trials' }, { value: 'APPLICATION_REQUIRED', label: 'Apply to join' }, { value: 'INVITE_ONLY', label: 'Invite only' },
        ] },
        { kind: 'text', key: 'city', label: 'City', placeholder: 'Any city' },
        { kind: 'text', key: 'country', label: 'Country', placeholder: 'Any country' },
    ],
    sorts: [{ value: 'MEMBER_COUNT', label: 'Most members' }, { value: 'NAME', label: 'Name A–Z' }, { value: 'NEWEST', label: 'Newest' }],
    async load(query, page, { signal }) {
        const params = new URLSearchParams();
        query.values.type?.forEach(value => params.append('type', value));
        query.values.joinPolicy?.forEach(value => params.append('joinPolicy', value));
        if (query.q) params.set('search', query.q);
        if (first(query, 'city')) params.set('city', first(query, 'city'));
        if (first(query, 'country')) params.set('country', first(query, 'country'));
        if (query.sort && query.sort !== 'NEWEST') params.set('sort', query.sort);
        params.set('page', String(page));
        params.set('size', String(PAGE));
        const result = await fetchClubDirectory(params, signal);
        return { items: result.content, total: result.totalElements, hasMore: page + 1 < result.totalPages };
    },
    key: club => String(club.id),
    Item: ({ item }) => <ClubCard club={item} />,
    // Directory records carry no coordinates; the map search places clubs by id.
    async loadPoints(query, { signal }) {
        const result = await fetchMapDiscovery({ lat: 41.7151, lng: 44.8271, type: ['CLUB'], query: query.q || undefined }, signal);
        return new Map(result.content.map(marker => [String(marker.entityId), { lat: marker.latitude, lng: marker.longitude }]));
    },
    point: (club, coords) => coords ? { id: String(club.id), ...coords, label: club.name, meta: [clubTypeLabel(club.type), club.cityName].filter(Boolean).join(' · '), tone: 'club', to: `/clubs/${club.id}` } : null,
    empty: { title: 'No clubs listed yet', body: 'Clubs appear here when they publish their profile.' },
};

export default function ClubsDirectory() {
    const { status } = useAuth();
    const { membership } = useWorldSession();
    return (
        <DirectoryPage
            title="Clubs"
            subtitle="Academies, football schools and community clubs. Compare how to join, fees and where they train."
            sources={[clubs]}
            actions={status === 'authenticated' && <>
                <ButtonLink variant="ghost" to="/clubs/following">Clubs you follow</ButtonLink>
                {membership?.canCreateClub && <ButtonLink to="/organizations/create?kind=CLUB"><Plus aria-hidden="true" />Create a club</ButtonLink>}
            </>}
        />
    );
}
