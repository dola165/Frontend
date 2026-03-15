import { useState, useEffect } from 'react';
import { apiClient } from '../../../api/axiosConfig';
import { ShieldCheck, Loader2 } from 'lucide-react';

interface ClubRosterDto { id: number; name: string; position: string; number: number; status: string; avatar: string; }

export const TabTeams = ({ clubId }: { clubId: number }) => {
    const [roster, setRoster] = useState<ClubRosterDto[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get(`/clubs/${clubId}/roster`)
            .then(res => setRoster(res.data))
            .catch(err => console.error("Failed to load roster", err))
            .finally(() => setLoading(false));
    }, [clubId]);

    if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

    if (roster.length === 0) return (
        <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-black rounded-lg p-10 shadow-lg text-center">
            <h3 className="font-black text-slate-900 dark:text-white text-lg uppercase tracking-wide">No Active Personnel</h3>
            <p className="text-slate-500 font-medium text-sm">The roster for this organization is currently empty.</p>
        </div>
    );

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roster.map(player => (
                <div key={player.id} className="bg-white dark:bg-[#1e293b] border-2 border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden group hover:border-emerald-500 transition-colors cursor-pointer">
                    <div className="h-40 bg-slate-200 dark:bg-slate-800 relative">
                        <img src={player.avatar || `https://i.pravatar.cc/300?u=${player.id}`} alt={player.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white font-black text-xs px-2 py-1 rounded-md">{player.position}</div>
                        <div className="absolute -bottom-6 left-4 w-12 h-12 bg-white dark:bg-slate-900 rounded-lg border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center font-black text-lg text-slate-900 dark:text-white shadow-lg z-10">
                            {player.number}
                        </div>
                    </div>
                    <div className="pt-8 pb-4 px-4">
                        <h4 className="font-black text-slate-900 dark:text-white text-lg leading-tight flex items-center gap-1.5">{player.name} {player.status === 'VERIFIED' && <ShieldCheck className="w-4 h-4 text-emerald-500" />}</h4>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Active</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};