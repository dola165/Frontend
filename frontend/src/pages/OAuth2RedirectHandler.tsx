import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { completedAuthDestination, getAuthFlow, requiredAccountStep } from '../utils/authRedirect';

export const OAuth2RedirectHandler = () => {
    const navigate = useNavigate();
    const { status, user } = useAuth();

    useEffect(() => {
        // The provider restores the callback cookie once. Starting another
        // bootstrap here can repeatedly retire an absent session and remount.
        if (status === 'bootstrapping') return;
        if (status !== 'authenticated' || !user) {
            navigate('/login', { replace: true });
            return;
        }
        const requiredStep = requiredAccountStep(user);
        const flow = getAuthFlow();
        navigate(requiredStep ?? completedAuthDestination(user, flow.nextPath), { replace: true });
    }, [status, user, navigate]);

    return (
        <div role="status" className="min-h-screen flex flex-col items-center justify-center bg-[color:var(--color-page)]">
            <div aria-hidden="true" className="w-10 h-10 border-2 border-[color:var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-[color:var(--color-accent)] font-semibold tracking-widest uppercase text-xs">Initializing Secure Session...</p>
        </div>
    );
};
