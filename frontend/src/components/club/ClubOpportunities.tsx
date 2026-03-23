import { Link } from 'react-router-dom';
import { Briefcase, DollarSign, ExternalLink, Heart, Users } from 'lucide-react';
import type { ClubOpportunity, ClubProfile } from '../../pages/ClubProfilePage.tsx';

interface ClubOpportunitiesProps {
    club: ClubProfile | null;
    onOpenModule?: () => void;
    showOpportunityBoard?: boolean;
}

export const ClubOpportunities = ({ club, onOpenModule, showOpportunityBoard = true }: ClubOpportunitiesProps) => {
    const groupedByType = new Map<string, ClubOpportunity[]>();
    (club?.opportunities || []).forEach((opportunity) => {
        const existing = groupedByType.get(opportunity.type) || [];
        groupedByType.set(opportunity.type, [...existing, opportunity]);
    });

    const getOpportunityStyling = (type: string) => {
        switch (type) {
            case 'FUNDRAISING':
                return { icon: DollarSign, label: 'Fundraising/Grassroots', emptyLabel: 'No active fundraiser', colors: 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' };
            case 'JOB':
                return { icon: Briefcase, label: 'Job Opportunities', emptyLabel: 'No open club roles', colors: 'border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-500/20' };
            case 'VOLUNTEER':
                return { icon: Users, label: 'Volunteer Opportunities', emptyLabel: 'No volunteer call-outs', colors: 'border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-500/20' };
            case 'WISHLIST':
                return { icon: Heart, label: 'Wish List', emptyLabel: 'No wishlist items', colors: 'border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20' };
            default:
                return { icon: ExternalLink, label: 'Other', emptyLabel: 'No listings', colors: 'border-slate-500/30 bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-500 hover:bg-slate-100' };
        }
    };

    const orderedTypes = ['FUNDRAISING', 'JOB', 'VOLUNTEER', 'WISHLIST'];

    return (
        <aside className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4 lg:sticky lg:top-24">
            {showOpportunityBoard && (
                <div className="theme-surface theme-border rounded-lg border-2 p-4 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2 border-b theme-border pb-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" /> Opportunities
                    </h3>
                    <div className="flex flex-col gap-3">
                        {orderedTypes.map((type) => {
                            const { icon: Icon, colors, label, emptyLabel } = getOpportunityStyling(type);
                            const matches = groupedByType.get(type) || [];
                            const primaryOpportunity = matches[0];

                            if (!primaryOpportunity) {
                                return (
                                    <div
                                        key={type}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all shadow-sm opacity-90 ${colors}`}
                                    >
                                        <Icon className="w-5 h-5 shrink-0" />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-left leading-tight">{label}</span>
                                            <span className="text-[10px] uppercase tracking-wider opacity-80">{emptyLabel}</span>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <a
                                    key={type}
                                    href={primaryOpportunity.externalLink || '#'}
                                    target={primaryOpportunity.externalLink ? '_blank' : undefined}
                                    rel={primaryOpportunity.externalLink ? 'noopener noreferrer' : undefined}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all hover:-translate-y-0.5 shadow-sm ${colors}`}
                                >
                                    <Icon className="w-5 h-5 shrink-0" />
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-bold text-left leading-tight truncate">{primaryOpportunity.title || label}</span>
                                        <span className="text-[10px] uppercase tracking-wider opacity-80">
                                            {label}
                                            {matches.length > 1 ? ` · ${matches.length} active` : ''}
                                        </span>
                                    </div>
                                    {primaryOpportunity.externalLink && <ExternalLink className="w-4 h-4 ml-auto shrink-0 opacity-70" />}
                                </a>
                            );
                        })}
                    </div>
                    {onOpenModule && (
                        <button
                            onClick={onOpenModule}
                            className="mt-4 w-full rounded-sm border-2 border-slate-900 bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-900 shadow-[4px_4px_0px_0px_#020617] transition-all hover:bg-slate-200 active:translate-y-0.5 active:shadow-none dark:border-slate-900 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                        >
                            Open Opportunity Board
                        </button>
                    )}
                </div>
            )}

            <div className="theme-surface theme-border rounded-lg border-2 p-4 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 border-b theme-border pb-2">
                    Club Stats
                </h3>
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Members</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-500">{club?.memberCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Followers</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">{club?.followerCount || 0}</span>
                    </div>
                    {!!club?.trustedByClubs?.length && (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Trust Signal</p>
                            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-200">
                                Trusted by{' '}
                                {club.trustedByClubs.map((trustedClub, index) => (
                                    <span key={trustedClub.clubId}>
                                        <Link
                                            to={`/clubs/${trustedClub.clubId}`}
                                            className="font-black text-emerald-700 underline decoration-emerald-500/40 underline-offset-4 transition-colors hover:text-emerald-500 dark:text-emerald-400"
                                        >
                                            {trustedClub.clubName}
                                        </Link>
                                        {index < club.trustedByClubs.length - 1 ? ', ' : ''}
                                    </span>
                                ))}
                            </p>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Status</span>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">{club?.statusLabel || (club?.isOfficial ? 'Verified' : 'Unverified')}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};
