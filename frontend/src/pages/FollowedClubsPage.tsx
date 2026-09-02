import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Loader2, MapPin, Search, Shield, Users } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';

interface FollowedClub {
    id: number;
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    cityName?: string | null;
    countryName?: string | null;
    followerCount?: number;
    memberCount?: number;
    isOfficial?: boolean;
    isFollowedByMe: boolean;
}

const initialsFrom = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'GK';

export const FollowedClubsPage = () => {
    const [clubs, setClubs] = useState<FollowedClub[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyClubId, setBusyClubId] = useState<number | null>(null);

    const loadClubs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get<{ content?: FollowedClub[] } | FollowedClub[]>('/clubs', {
                params: { page: 0, size: 100, sort: 'POPULARITY' }
            });
            const data = Array.isArray(response.data) ? response.data : response.data.content ?? [];
            setClubs(data.filter((club) => club.isFollowedByMe));
        } catch (requestError) {
            console.error('Failed to load followed clubs', requestError);
            setError('Your followed clubs could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadClubs();
    }, [loadClubs]);

    const visibleClubs = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return clubs;
        return clubs.filter((club) => `${club.name} ${club.cityName ?? ''} ${club.countryName ?? ''}`.toLowerCase().includes(query));
    }, [clubs, search]);

    const unfollow = async (clubId: number) => {
        setBusyClubId(clubId);
        try {
            await apiClient.post(`/clubs/${clubId}/follow`);
            setClubs((current) => current.filter((club) => club.id !== clubId));
        } catch (requestError) {
            console.error('Failed to unfollow club', requestError);
            setError('That club could not be unfollowed. Please try again.');
        } finally {
            setBusyClubId(null);
        }
    };

    return (
        <div className="mx-auto w-full max-w-5xl pb-10">
            <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">Your football network</p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Followed clubs</h1>
                    <p className="mt-1 text-sm text-[#8b8d94]">The clubs you chose to keep close, in one clear list.</p>
                </div>
                <Link to="/clubs" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/[0.08] px-4 text-xs font-bold text-emerald-400 hover:bg-emerald-500/[0.13]">
                    Browse more clubs <ArrowRight className="h-4 w-4" />
                </Link>
            </header>

            <div className="mt-5 flex items-center gap-3">
                <label className="relative block w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717a]" />
                    <span className="sr-only">Search followed clubs</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your clubs" className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#16181d] pl-10 pr-4 text-sm text-white outline-none placeholder:text-[#71717a] focus:border-emerald-500/50" />
                </label>
                {!loading && <span className="shrink-0 text-xs text-[#71717a]">{visibleClubs.length} club{visibleClubs.length === 1 ? '' : 's'}</span>}
            </div>

            {error && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
                    <span>{error}</span>
                    <button type="button" onClick={() => void loadClubs()} className="font-bold hover:underline">Try again</button>
                </div>
            )}

            {loading ? (
                <div className="flex min-h-56 items-center justify-center text-[#8b8d94]"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : visibleClubs.length === 0 ? (
                <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-[#121419] px-6 text-center">
                    <Shield className="h-9 w-9 text-emerald-400" />
                    <h2 className="mt-4 text-base font-bold text-white">{clubs.length === 0 ? 'No followed clubs yet' : 'No clubs match that search'}</h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-[#8b8d94]">{clubs.length === 0 ? 'Follow a club and it will appear here instead of sending you back to the full directory.' : 'Try a different club, city or country name.'}</p>
                    {clubs.length === 0 && <Link to="/clubs" className="mt-4 text-sm font-bold text-emerald-400 hover:underline">Find clubs to follow</Link>}
                </div>
            ) : (
                <section aria-label="Your followed clubs" className="mt-5 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#121419]">
                    {visibleClubs.map((club) => {
                        const logoUrl = resolveMediaUrl(club.logoUrl);
                        const location = [club.cityName, club.countryName].filter(Boolean).join(', ');
                        return (
                            <article key={club.id} className="flex flex-col gap-4 border-b border-white/[0.07] p-4 last:border-b-0 sm:flex-row sm:items-center">
                                <Link to={`/clubs/${club.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#24272d] text-sm font-bold text-[#d4d4d8] ring-1 ring-white/[0.08]">
                                        {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : initialsFrom(club.name)}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-sm font-bold text-white">{club.name}</span>
                                            {club.isOfficial && <Check className="h-4 w-4 shrink-0 rounded-full bg-emerald-500 p-0.5 text-black" aria-label="Official club" />}
                                        </span>
                                        {location && <span className="mt-1 flex items-center gap-1.5 text-xs text-[#8b8d94]"><MapPin className="h-3.5 w-3.5" /> {location}</span>}
                                        <span className="mt-2 flex items-center gap-4 text-[11px] text-[#71717a]">
                                            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {club.followerCount ?? 0} followers</span>
                                            <span>{club.memberCount ?? 0} members</span>
                                        </span>
                                    </span>
                                </Link>
                                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                                    <Link to={`/clubs/${club.id}`} className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[#2b3038] px-4 text-xs font-bold text-white hover:bg-[#363c46] sm:flex-none">View club</Link>
                                    <button type="button" onClick={() => void unfollow(club.id)} disabled={busyClubId === club.id} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] px-4 text-xs font-bold text-[#b8bbc2] hover:bg-white/[0.04] disabled:opacity-50 sm:flex-none">
                                        {busyClubId === club.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Following
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}
        </div>
    );
};
