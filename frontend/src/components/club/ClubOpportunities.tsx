import { DollarSign, Briefcase, Users, Heart, ExternalLink } from 'lucide-react';
import type {ClubOpportunity, ClubProfile} from "../../pages/ClubProfilePage.tsx";


interface ClubOpportunitiesProps {
    club: ClubProfile | null;
}

export const ClubOpportunities = ({ club }: ClubOpportunitiesProps) => {

    // Helper to render the right icon and colors based on the enum type
    const getOpportunityStyling = (type: string) => {
        switch(type) {
            case 'FUNDRAISING': return { icon: DollarSign, colors: 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' };
            case 'JOB': return { icon: Briefcase, colors: 'border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-500/20' };
            case 'VOLUNTEER': return { icon: Users, colors: 'border-purple-500/30 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-500 hover:bg-purple-100 dark:hover:bg-purple-500/20' };
            case 'WISHLIST': return { icon: Heart, colors: 'border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20' };
            default: return { icon: ExternalLink, colors: 'border-slate-500/30 bg-slate-50 dark:bg-slate-500/10 text-slate-700 dark:text-slate-500 hover:bg-slate-100' };
        }
    };

    return (
        <aside className="w-full lg:w-[320px] shrink-0 flex flex-col gap-4">
            <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-4 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" /> Opportunities
                </h3>
                <div className="flex flex-col gap-3">

                    {/* STRICT FIX: Dynamically render the array returned from the backend */}
                    {club?.opportunities && club.opportunities.length > 0 ? (
                        club.opportunities.map((opp: ClubOpportunity) => {
                            const { icon: Icon, colors } = getOpportunityStyling(opp.type);
                            return (
                                <a key={opp.id} href={opp.externalLink} target="_blank" rel="noopener noreferrer"
                                   className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all hover:-translate-y-0.5 shadow-sm ${colors}`}>
                                    <Icon className="w-5 h-5 shrink-0" />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-left leading-tight">{opp.title}</span>
                                        <span className="text-[10px] uppercase tracking-wider opacity-80">{opp.type}</span>
                                    </div>
                                </a>
                            );
                        })
                    ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic text-center py-2">No active opportunities.</p>
                    )}

                </div>
            </div>

            {/* Stats Widget */}
            <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-4 shadow-lg dark:shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Club Stats</h3>
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Members</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-500">{club?.memberCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Followers</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white">{club?.followerCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">Status</span>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">{club?.isOfficial ? 'Verified' : 'Unverified'}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};