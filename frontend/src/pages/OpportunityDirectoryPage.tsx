import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, HeartHandshake, Search, SlidersHorizontal } from 'lucide-react';
import { DiscoverySectionTabs } from '../components/discovery/DiscoverySectionTabs';
import { ClubLocationFilter } from '../components/discovery/ClubLocationFilter';
import { EMPTY_CLUB_REGION, type ClubLocationItem, type ClubRegionSelection } from '../components/discovery/clubLocationTypes';
import { fetchClubLocationOptions } from '../features/discovery/api';

interface OpportunityDirectoryPageProps {
    type: 'jobs' | 'campaigns';
}

const copy = {
    jobs: {
        eyebrow: 'Football opportunities',
        title: 'Jobs',
        subtitle: 'Coaching, staff and volunteer roles from clubs in one searchable directory.',
        search: 'Search roles, clubs or skills',
        Icon: BriefcaseBusiness,
        accent: 'text-fuchsia-300',
        border: 'focus:border-fuchsia-400/60',
        options: ['All roles', 'Coach', 'Club staff', 'Volunteer'],
        emptyTitle: 'The jobs directory is ready for club listings',
        emptyText: 'Open jobs will appear here as clubs publish them. The filters and shared navigation are ready for the call preview.'
    },
    campaigns: {
        eyebrow: 'Club and grassroots support',
        title: 'Campaigns',
        subtitle: 'Fundraisers and community campaigns presented with the same familiar discovery layout.',
        search: 'Search campaigns or clubs',
        Icon: HeartHandshake,
        accent: 'text-emerald-400',
        border: 'focus:border-emerald-500/60',
        options: ['All campaigns', 'Fundraising', 'Grassroots', 'Community'],
        emptyTitle: 'The campaigns directory is ready for listings',
        emptyText: 'Active campaigns will appear here as clubs publish them. This screen intentionally avoids invented campaign data.'
    }
} as const;

export const OpportunityDirectoryPage = ({ type }: OpportunityDirectoryPageProps) => {
    const page = copy[type];
    const Icon = page.Icon;
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<string>(page.options[0]);
    const [clubs, setClubs] = useState<ClubLocationItem[]>([]);
    const [region, setRegion] = useState<ClubRegionSelection>(EMPTY_CLUB_REGION);
    const filtersActive = useMemo(() => Boolean(search.trim() || category !== page.options[0] || region.country || region.city || region.clubId), [category, page.options, region, search]);

    useEffect(() => {
        void fetchClubLocationOptions().then(setClubs).catch(() => setClubs([]));
    }, []);

    return (
        <div className="min-h-[calc(100dvh-var(--app-header-height))] bg-transparent text-[color:var(--text-primary)]">
            <DiscoverySectionTabs />
            <header className="border-b border-[color:var(--theme-border)] pb-6 pt-1">
                <p className={`text-[10px] font-bold uppercase tracking-[0.16em] ${page.accent}`}>{page.eyebrow}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">{page.title}</h1>
                <p className="mt-1 max-w-2xl text-sm text-[color:var(--text-secondary)]">{page.subtitle}</p>
                <label className="relative mt-5 block w-full">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--text-muted)]" />
                    <span className="sr-only">{page.search}</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={page.search} className={`h-12 w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] pl-12 pr-4 text-sm font-medium text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:ring-2 focus:ring-[#16a34a]/15 ${page.border}`} />
                </label>
            </header>

            <div className="mt-5 grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
                <aside aria-label={`${page.title} filters`} className="h-fit overflow-hidden rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] shadow-[var(--theme-shadow)] lg:sticky lg:top-[calc(var(--app-header-height)+20px)]">
                    <div className="flex items-start justify-between gap-3 border-b border-[color:var(--theme-border)] bg-[#16a34a]/10 px-4 py-4">
                        <div>
                            <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.1em] text-[color:var(--text-primary)]"><SlidersHorizontal className="h-4 w-4 text-[#168a4b] dark:text-[#6ee7a0]" /> Filter campaigns</span>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">Choose a campaign type, country, city or club.</p>
                        </div>
                        {filtersActive && <button type="button" onClick={() => { setSearch(''); setRegion(EMPTY_CLUB_REGION); setCategory(page.options[0]); }} className="shrink-0 rounded-lg border border-[#16a34a]/25 px-2.5 py-1.5 text-xs font-bold text-[#168a4b] hover:bg-[#16a34a]/10 dark:text-[#6ee7a0]">Clear</button>}
                    </div>

                    <fieldset className="px-4 py-4">
                        <legend className="mb-3 text-xs font-extrabold uppercase tracking-[0.12em] text-[color:var(--text-secondary)]">Campaign type</legend>
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                            {page.options.map((option) => (
                                <label key={option} className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${category === option ? 'border-[#16a34a]/45 bg-[#16a34a]/10 font-bold text-[color:var(--text-primary)]' : 'border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--theme-border)] hover:bg-[color:var(--theme-surface-inset)] hover:text-[color:var(--text-primary)]'}`}>
                                    <input type="radio" name="campaign-category" value={option} checked={category === option} onChange={() => setCategory(option)} className="sr-only" />
                                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${category === option ? 'border-[#16a34a]' : 'border-[color:var(--theme-border-strong)]'}`}>{category === option && <span className="h-2 w-2 rounded-full bg-[#16a34a]" />}</span>
                                    {option}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <div className="border-t border-[color:var(--theme-border)] p-3">
                        <ClubLocationFilter items={clubs} value={region} onChange={setRegion} label="Location and club" defaultOpen />
                    </div>
                </aside>

                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface)] px-6 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--theme-surface-inset)]"><Icon className={`h-6 w-6 ${page.accent}`} /></span>
                    <h2 className="mt-4 text-base font-bold text-[color:var(--text-primary)]">{page.emptyTitle}</h2>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-[color:var(--text-secondary)]">{page.emptyText}</p>
                    {type === 'campaigns' && <p className="mt-3 text-xs text-[color:var(--text-muted)]">Fundraiser data remains intentionally disconnected until the next product decision.</p>}
                </div>
            </div>
        </div>
    );
};
