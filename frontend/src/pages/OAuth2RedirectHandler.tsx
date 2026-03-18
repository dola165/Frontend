import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/axiosConfig'; // Or raw axios if interceptors interfere

export const OAuth2RedirectHandler = () => {
    const navigate = useNavigate();

    useEffect(() => {

        apiClient.post('/auth/refresh')
            .then(async (res) => {
                localStorage.setItem('accessToken', res.data.accessToken);

                try {
                    // Check if the user has completed their profile
                    const meRes = await apiClient.get('/users/me');
                    if (meRes.data.userType === 'FAN') {
                        navigate('/onboarding');
                    } else {
                        navigate('/feed');
                    }
                } catch (e) {
                    navigate('/feed'); // Fallback
                }
            })
            .catch(err => {
                console.error("OAuth2 Session initialization failed:", err);
                navigate('/login');
            });
    }, [navigate]);

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-emerald-500 font-black tracking-widest uppercase text-xs">Initializing Secure Session...</p>
        </div>
    );
};