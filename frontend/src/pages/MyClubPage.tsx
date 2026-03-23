import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, PlusCircle } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';
import { CreateClubModal } from '../components/club/CreateClubModal';

interface ClubMembershipContext {
    hasClubMembership: boolean;
    canCreateClub: boolean;
    clubId?: number | null;
    clubName?: string | null;
    myRole?: string | null;
}

export const MyClubPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [membershipContext, setMembershipContext] = useState<ClubMembershipContext | null>(null);
    const [isCreateClubOpen, setIsCreateClubOpen] = useState(false);

    useEffect(() => {
        apiClient.get<ClubMembershipContext>('/clubs/my-membership-context')
            .then((response) => {
                setMembershipContext(response.data);
                if (response.data?.clubId) {
                    navigate(`/clubs/${response.data.clubId}`, { replace: true });
                    return;
                }
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, [navigate]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-emerald-500 h-[calc(100vh-56px)] bg-[#0f172a]">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-bold tracking-widest uppercase text-sm text-slate-500">Verifying Clearance...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] bg-[#0f172a] p-6 text-center">
            <div className="w-24 h-24 bg-slate-800 rounded-sm flex items-center justify-center mb-6 border-2 border-slate-700 shadow-lg">
                <Building2 className="w-10 h-10 text-slate-500" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Club Operations Hub</h2>
            <p className="text-slate-400 font-medium text-sm max-w-md mb-8">
                {membershipContext?.canCreateClub
                    ? 'You are not attached to a club yet. Create one now and GrassKickZ will route players and partner clubs to your new profile immediately.'
                    : 'You are not attached to a club leadership workspace from this account yet.'}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
                {membershipContext?.canCreateClub && (
                    <button
                        onClick={() => setIsCreateClubOpen(true)}
                        className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-sm font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-1 active:shadow-none transition-all"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Create Club
                    </button>
                )}
                <button
                    onClick={() => navigate('/clubs')}
                    className="bg-slate-100 hover:bg-white text-slate-900 px-6 py-3 rounded-sm font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-1 active:shadow-none transition-all"
                >
                    Browse Clubs
                </button>
            </div>

            <CreateClubModal
                isOpen={isCreateClubOpen}
                onClose={() => setIsCreateClubOpen(false)}
                onCreated={(clubId) => navigate(`/clubs/${clubId}`)}
            />
        </div>
    );
};
