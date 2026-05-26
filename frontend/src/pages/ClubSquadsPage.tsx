import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { EntityHeaderBand, EntityPageLayout, EntitySection } from '../components/layout/EntityPageLayout';
import { SquadRosterTable, type SquadRosterGroup } from '../components/squads/SquadRosterTable';

interface ClubSquadHeader {
    id: number;
    name: string;
    type: string;
    addressText?: string;
    isOfficial: boolean;
}

interface SquadDto {
    id: number;
    clubId: number;
    name: string;
    category: string;
    gender: string;
}

export const ClubSquadsPage = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [club, setClub] = useState<ClubSquadHeader | null>(null);
    const [squads, setSquads] = useState<SquadDto[]>([]);
    const [groups, setGroups] = useState<SquadRosterGroup[]>([]);
    const [loadingClub, setLoadingClub] = useState(true);
    const [loadingRoster, setLoadingRoster] = useState(true);

    const selectedSquadId = Number(searchParams.get('squad'));
    const selectedSquad = useMemo(() => squads.find((squad) => squad.id === selectedSquadId) ?? squads[0] ?? null, [selectedSquadId, squads]);

    useEffect(() => {
        if (!id) return;
        setLoadingClub(true);
        Promise.all([apiClient.get(`/clubs/${id}`), apiClient.get(`/clubs/${id}/squads`)])
            .then(([clubResponse, squadsResponse]) => {
                setClub(clubResponse.data);
                setSquads(squadsResponse.data || []);
            })
            .catch((error) => {
                console.error('Failed to load squads page context', error);
                setClub(null);
                setSquads([]);
            })
            .finally(() => setLoadingClub(false));
    }, [id]);

    useEffect(() => {
        if (!selectedSquad) {
            setGroups([]);
            setLoadingRoster(false);
            return;
        }

        const nextSquadId = String(selectedSquad.id);
        if (searchParams.get('squad') !== nextSquadId) {
            setSearchParams({ squad: nextSquadId }, { replace: true });
            return;
        }

        setLoadingRoster(true);
        apiClient.get(`/clubs/${id}/squads/${selectedSquad.id}/roster`)
            .then((response) => setGroups(response.data || []))
            .catch((error) => {
                console.error('Failed to load squad roster', error);
                setGroups([]);
            })
            .finally(() => setLoadingRoster(false));
    }, [id, searchParams, selectedSquad, setSearchParams]);

    if (loadingClub) {
        return (
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center">
                <Loader2 className="h-9 w-9 animate-spin accent-primary" />
            </div>
        );
    }

    if (!club) {
        return (
            <div className="bg-base flex h-full min-h-[calc(100vh-var(--app-header-height))] items-center justify-center px-6">
                <div className="bg-surface border border-subtle px-8 py-10 text-center">
                    <h2 className="text-xl font-black uppercase tracking-[0.18em] text-primary">Club Not Found</h2>
                    <Link to="/clubs" className="mt-4 inline-flex text-sm font-black uppercase tracking-[0.16em] accent-primary">
                        Return To Clubs
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-base min-h-full">
            <EntityHeaderBand>
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
                    <div>
                        <Link to={`/clubs/${club.id}`} className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary">
                            <ChevronLeft className="h-4 w-4" />
                            Back To Club
                        </Link>
                        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] accent-primary">Squad Directory</p>
                        <h1 className="mt-2 flex items-center gap-2 text-3xl font-black uppercase tracking-tight text-primary">
                            {club.name}
                            {club.isOfficial && <ShieldCheck className="h-5 w-5 accent-primary" />}
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-black uppercase tracking-[0.18em] text-secondary">
                            <span>{club.type}</span>
                            {club.addressText && (
                                <>
                                    <span className="h-1 w-1 rounded-full bg-[color:var(--accent-muted)]" />
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 accent-primary" />
                                        {club.addressText}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="border border-subtle bg-base">
                        <div className="grid divide-y divide-[color:var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Squads</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{squads.length}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Selected</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{selectedSquad ? 'Active' : 'None'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Roster View</p>
                                <p className="mt-2 text-xl font-black uppercase tracking-tight accent-primary">Structured</p>
                            </div>
                        </div>
                    </div>
                </div>
            </EntityHeaderBand>

            <EntityPageLayout
                left={(
                    <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Squad Navigation" title="Club Units" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            {squads.length === 0 ? (
                                <div className="px-4 py-5 text-sm leading-6 text-secondary">No registered squads for this club yet.</div>
                            ) : (
                                squads.map((squad) => {
                                    const isActive = selectedSquad?.id === squad.id;
                                    return (
                                        <button
                                            key={squad.id}
                                            type="button"
                                            onClick={() => setSearchParams({ squad: String(squad.id) })}
                                            className={`flex w-full items-center justify-between gap-3 border-l-2 px-4 py-3 text-left transition-colors ${
                                                isActive ? 'border-accent-muted bg-elevated text-primary' : 'border-transparent text-secondary hover:bg-base hover:text-primary'
                                            }`}
                                        >
                                            <span>
                                                <span className="block text-[11px] font-black uppercase tracking-[0.16em]">{squad.name}</span>
                                                <span className="mt-1 block text-[11px] font-medium normal-case tracking-normal text-secondary">{squad.category} / {squad.gender}</span>
                                            </span>
                                            {isActive && <span className="h-px w-5 bg-[color:var(--accent-muted)]" aria-hidden="true" />}
                                        </button>
                                    );
                                })
                            )}
                        </EntitySection>

                        <EntitySection eyebrow="Club Record" title="Context" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
                                <span className="text-secondary">Club Type</span>
                                <span className="text-primary">{club.type}</span>
                            </div>
                            <div className="flex items-start justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em]">
                                <span className="text-secondary">Official</span>
                                <span className={club.isOfficial ? 'accent-primary' : 'text-primary'}>{club.isOfficial ? 'Yes' : 'No'}</span>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Location</p>
                                <p className="mt-2 text-sm leading-6 text-primary">{club.addressText || 'Not listed'}</p>
                            </div>
                        </EntitySection>
                    </div>
                )}
                center={(
                    squads.length === 0 ? (
                        <EntitySection eyebrow="Roster Surface" title="No Squads Registered" bodyClassName="px-5 py-10 text-center">
                            <p className="text-sm text-secondary">No registered squads for this club yet.</p>
                        </EntitySection>
                    ) : loadingRoster ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-8 w-8 animate-spin accent-primary" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <EntitySection
                                eyebrow="Roster Surface"
                                title={selectedSquad?.name ?? 'Squad Roster'}
                                description="Structured by football unit for fast scanning instead of card-heavy tiles."
                                bodyClassName="grid divide-y divide-[color:var(--border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
                            >
                                <div className="px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Category</p>
                                    <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{selectedSquad?.category || 'Unspecified'}</p>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Gender</p>
                                    <p className="mt-2 text-xl font-black uppercase tracking-tight text-primary">{selectedSquad?.gender || 'Unspecified'}</p>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-secondary">Groups</p>
                                    <p className="mt-2 text-xl font-black uppercase tracking-tight accent-primary">{groups.length}</p>
                                </div>
                            </EntitySection>

                            <SquadRosterTable groups={groups} />
                        </div>
                    )
                )}
                right={(
                    <div className="flex flex-col gap-4 xl:sticky xl:top-[calc(var(--app-header-height)+24px)]">
                        <EntitySection eyebrow="Utility Layer" title="Selected Squad" bodyClassName="divide-y divide-[color:var(--border-subtle)]">
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Name</p>
                                <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{selectedSquad?.name || 'No squad selected'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Category</p>
                                <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{selectedSquad?.category || 'Unspecified'}</p>
                            </div>
                            <div className="px-4 py-3">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-secondary">Gender</p>
                                <p className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-primary">{selectedSquad?.gender || 'Unspecified'}</p>
                            </div>
                        </EntitySection>

                        <EntitySection eyebrow="Actions" title="Club Navigation" bodyClassName="px-4 py-4">
                            <div className="flex flex-col gap-2">
                                <Link
                                    to={`/clubs/${club.id}`}
                                    className="inline-flex items-center justify-between gap-2 border border-subtle bg-base px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary"
                                >
                                    Back To Club
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        </EntitySection>
                    </div>
                )}
            />
        </div>
    );
};
