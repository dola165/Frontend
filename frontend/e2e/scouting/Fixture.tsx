import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { LayoutGrid, Users } from 'lucide-react';
import { GkRoot } from '../../src/design/primitives';
import { WorkspaceShell } from '../../src/design/workspace/WorkspaceShell';
import { Scouting } from '../../src/features/scouting/Scouting';
import { AdmissionInquiryPage } from '../../src/features/admissions/applicant/AdmissionInquiryPage';
import { MoreTools } from '../../src/features/clubOffice/MoreTools';
import type { Bootstrap } from '../../src/features/clubOperations/api';
import '../../src/styles/theme.css';
import '../../src/design/tokens.css';
const query = new URLSearchParams(location.search);
document.documentElement.classList.toggle('dark', query.get('theme') === 'dark');
localStorage.setItem('gk-session-id', 'synthetic-scout');
export function Fixture() {
    const navigate = useNavigate();
    const reference = query.has('reference');
    return <GkRoot className="gk-page"><Routes>
        <Route path="/admissions/inquiries/:inquiryId" element={<AdmissionInquiryPage />} />
        <Route path="/profile/:id" element={<><h1>Synthetic public profile</h1><button onClick={() => navigate(-1)}>Return to record</button></>} />
        <Route path="*" element={<WorkspaceShell label="Club office" storageKey="synthetic-scouting"
        context={{ name: 'FC Dinamo Tbilisi Academy', role: 'Scout · synthetic fixture', back: { label: 'Club page', to: '/reference' } }}
        primary={[{ id: 'staff', label: 'Staff', icon: Users }]}
        quiet={[{ id: 'tools', label: 'More tools', icon: LayoutGrid }]} active="tools" onSelect={() => navigate('/?reference=1')} canvas>
        {reference ? <MoreTools clubId={1} states={new Map([['scouting', 'open'], ['tryouts', 'open'], ['club-approaches', 'open']])}
            boot={{ settings: { enabled_modules: [] } } as unknown as Bootstrap} leader={false} onSquads={false} admin={null} />
            : <Scouting clubId={1} sessionId="synthetic-scout" />}
    </WorkspaceShell>} /></Routes></GkRoot>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Fixture /></BrowserRouter>);
