import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const OAuth2RedirectHandler = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');

        if (token) {
            // Store the JWT for future API requests
            localStorage.setItem('accessToken', token);
            navigate('/feed');
        } else {
            // If no token, something went wrong; go back to welcome
            navigate('/welcome');
        }
    }, [location, navigate]);

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-emerald-500 font-black tracking-widest uppercase text-xs">Initializing Session...</p>
        </div>
    );
};