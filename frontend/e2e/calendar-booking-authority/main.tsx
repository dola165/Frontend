/* eslint-disable react-refresh/only-export-components -- Standalone contained runtime-test entry. */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import '../../src/i18n';
import '../../src/index.css';
import '../../src/features/squadCommunication/squad-schedule.css';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { StadiumProfilePage } from '../../src/pages/StadiumProfilePage';
import { SquadScheduleTab } from '../../src/features/squadCommunication/page/SquadScheduleTab';
import { overview, type SquadOverview } from '../../src/features/squadCommunication/api';
import { setStoredAccessToken, setStoredUserId } from '../../src/utils/authStorage';

declare global { interface Window { __cg2: { actor: number; token: string; path: string } } }
// Supplied only by MAIN's private runtime fixture, using JWTs from the actual test JwtService.
setStoredUserId(window.__cg2.actor); setStoredAccessToken(window.__cg2.token);
history.replaceState(null, '', window.__cg2.path);

function Origin() {
    const { id } = useParams(), { user, isBootstrapping, sessionId } = useAuth();
    const [value, setValue] = useState<SquadOverview | null>(null), [error, setError] = useState(false);
    useEffect(() => {
        if (!user || !id) return;
        const c = new AbortController();
        void overview(Number(id), c.signal).then(v => { if (!c.signal.aborted) setValue(v); })
            .catch(() => { if (!c.signal.aborted) setError(true); });
        return () => c.abort();
    }, [id, user, sessionId]);
    if (isBootstrapping) return <p role="status">Checking origin account…</p>;
    if (!user || error) return <p role="alert">Origin unavailable under current authority.</p>;
    return value ? <SquadScheduleTab space={value}/> : <p role="status">Loading authorized origin…</p>;
}
createRoot(document.getElementById('root')!).render(<AuthProvider><BrowserRouter><Routes>
    <Route path="/stadiums/:organizationId" element={<StadiumProfilePage/>}/>
    <Route path="/squads/:id" element={<Origin/>}/>
</Routes></BrowserRouter></AuthProvider>);
