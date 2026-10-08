import { EmptyState } from '../components/ui/EmptyState';
import { MediaImage } from '../components/ui/MediaImage';
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
            const response = await apiClient.get<FollowedClub[]>('/clubs/followed');
            setClubs(response.data);
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
            <header className="flex flex-col gap-4 border-b border-[var(--theme-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent-primary)]">Your football network</p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">Followed clubs</h1>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">The clubs you chose to keep close, in one clear list.</p>
                </div>
                <Link to="/clubs" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[color:var(--color-accent)]/35 bg-[color:var(--color-accent)]/[0.08] px-4 text-xs font-bold text-[var(--accent-primary)] hover:bg-[color:var(--color-accent)]/[0.13]">
                    Browse more clubs <ArrowRight className="h-4 w-4" />
                </Link>
            </header>

            <div className="mt-5 flex items-center gap-3">
                <label className="relative block w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <span className="sr-only">Search followed clubs</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your clubs" className="h-11 w-full rounded-xl border border-[var(--theme-border)] bg-[var(--bg-surface)] pl-10 pr-4 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[color:var(--color-accent)]/50" />
                </label>
                {!loading && <span className="shrink-0 text-xs text-[var(--text-secondary)]">{visibleClubs.length} club{visibleClubs.length === 1 ? '' : 's'}</span>}
            </div>

            {error && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 px-4 py-3 text-xs text-[color:var(--color-danger)]">
                    <span>{error}</span>
                    <button type="button" onClick={() => void loadClubs()} className="font-bold hover:underline">Try again</button>
                </div>
            )}

            {loading ? (
                <div className="flex min-h-56 items-center justify-center text-[var(--text-secondary)]"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : visibleClubs.length === 0 ? (
                <div className="mt-6"><EmptyState icon={Shield} title={clubs.length === 0 ? 'No followed clubs yet' : 'No clubs match that search'} description={clubs.length === 0 ? 'Follow the clubs you care about to keep their profiles and updates close. Your collection will grow here.' : 'Try a different club, city or country name.'} action={clubs.length === 0 ? {label:'Find clubs to follow',to:'/clubs'} : {label:'Clear search',onClick:()=>setSearch('')}}/></div>
            ) : (
                <section aria-label="Your followed clubs" className="mt-5 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--bg-surface)]">
                    {visibleClubs.map((club) => {
                        const logoUrl = resolveMediaUrl(club.logoUrl);
                        const location = [club.cityName, club.countryName].filter(Boolean).join(', ');
                        return (
                            <article key={club.id} className="flex flex-col gap-4 border-b border-[var(--theme-border)] p-4 last:border-b-0 sm:flex-row sm:items-center">
                                <Link to={`/clubs/${club.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                                    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-inset)] text-sm font-bold text-[var(--text-secondary)] ring-1 ring-[color:var(--color-border)]/[0.08]">
                                        {logoUrl ? <MediaImage src={logoUrl} alt="" className="h-full w-full object-cover" /> : initialsFrom(club.name)}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2">
                                            <span className="truncate text-sm font-bold text-[var(--text-primary)]">{club.name}</span>
                                            {club.isOfficial && <Check className="h-4 w-4 shrink-0 rounded-full bg-[color:var(--color-accent)] p-0.5 text-[var(--color-on-accent)]" aria-label="Official club" />}
                                        </span>
                                        {location && <span className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><MapPin className="h-3.5 w-3.5" /> {location}</span>}
                                        <span className="mt-2 flex items-center gap-4 text-[11px] text-[var(--text-secondary)]">
                                            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {club.followerCount ?? 0} followers</span>
                                            <span>{club.memberCount ?? 0} members</span>
                                        </span>
                                    </span>
                                </Link>
                                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                                    <Link to={`/clubs/${club.id}`} className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[var(--color-surface)] px-4 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--color-inset)] sm:flex-none">View club</Link>
                                    <button type="button" onClick={() => void unfollow(club.id)} disabled={busyClubId === club.id} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[color:var(--color-border)]/[0.1] px-4 text-xs font-bold text-[var(--color-muted)] hover:bg-[color:var(--color-ink)]/[0.04] disabled:opacity-50 sm:flex-none">
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
