import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, Search } from 'lucide-react';
import { apiClient } from '../api/axiosConfig';

export const MyClubPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Ask the backend for my club
        apiClient.get('/clubs/my-club')
            .then(res => {
                if (res.status === 200 && res.data.clubId) {
                    // I have a club! Redirect me straight to my Command Center.
                    navigate(`/clubs/${res.data.clubId}`, { replace: true });
                } else {
                    // I got a 204 No Content. I don't have a club. Stop loading and show the screen.
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error("Failed to fetch my club", err);
                setLoading(false);
            });
    }, [navigate]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-emerald-500 h-[calc(100vh-56px)] bg-[#0f172a]">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-bold tracking-widest uppercase text-sm text-slate-500">Verifying Affiliation...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-56px)] bg-[#0f172a] p-6 text-center">
            <div className="w-24 h-24 bg-slate-800 rounded-sm flex items-center justify-center mb-6 border-2 border-slate-700 shadow-lg">
                <Building2 className="w-10 h-10 text-slate-500" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Currently Not in a Club</h2>
            <p className="text-slate-400 font-medium text-sm max-w-md mb-8">
                You are not assigned to an active roster. Join a team or register a new organization to access the Command Center.
            </p>
            <button
                onClick={() => navigate('/clubs')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-sm font-bold uppercase text-xs tracking-widest shadow-[2px_2px_0px_#020617] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2"
            >
                <Search className="w-4 h-4" /> Browse Database
            </button>
        </div>
    );
};