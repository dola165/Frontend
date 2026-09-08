import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clearAuthFlow, completedAuthDestination, getAuthFlow, requiredAccountStep } from '../utils/authRedirect';

export const OAuth2RedirectHandler = () => {
    const navigate = useNavigate();
    const { bootstrapSession } = useAuth();

    useEffect(() => {
        let active = true;

        const initializeSession = async () => {
            try {
                const authenticatedUser = await bootstrapSession();
                if (!active) {
                    return;
                }

                if (!authenticatedUser) {
                    navigate('/login');
                    return;
                }

                const requiredStep = requiredAccountStep(authenticatedUser);
                if (requiredStep) {
                    navigate(requiredStep, { replace: true });
                    return;
                }
                const flow = getAuthFlow();
                const destination = completedAuthDestination(authenticatedUser, flow.nextPath);
                clearAuthFlow();
                navigate(destination, { replace: true });
            } catch (err) {
                console.error("OAuth2 Session initialization failed:", err);
                if (active) {
                    navigate('/login');
                }
            }
        };

        void initializeSession();

        return () => {
            active = false;
        };
    }, [bootstrapSession, navigate]);

    return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-emerald-500 font-semibold tracking-widest uppercase text-xs">Initializing Secure Session...</p>
        </div>
    );
};
