import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';

export const MyClubPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Ask the backend for my club AND my user role simultaneously
        Promise.all([
            apiClient.get('/clubs/my-club').catch(() => ({ data: null, status: 204 })),
            apiClient.get('/users/me').catch(() => ({ data: null }))
        ]).then(([clubRes, userRes]) => {

            if (clubRes.status === 200 && clubRes.data?.clubId) {
                // Perfect Scenario: The database knows exactly which club I manage
                navigate(`/clubs/${clubRes.data.clubId}`, { replace: true });
            }
            else if (userRes.data?.role === 'CLUB_ADMIN') {
                // MVP DEMO FALLBACK: I am a coach, but the DB 'club_memberships' table is empty.
                // Force route me to Club #1 so I can demo the Command Center!
                navigate(`/clubs/1`, { replace: true });
            }
            else {
                // I am genuinely a fan/player who has no business here
                setLoading(false);
            }
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
            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Clearance Denied</h2>
            <p className="text-slate-400 font-medium text-sm max-w-md mb-8">
                You are not assigned as an administrator to an active roster. Join a team's staff or register a new organization to access the Command Center.
            </p>
            <button
                onClick={() => navigate('/clubs')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-sm font-black uppercase text-xs tracking-widest shadow-[4px_4px_0px_0px_#020617] active:translate-y-1 active:shadow-none transition-all"
            >
                Browse Global Database
            </button>
        </div>
    );
};