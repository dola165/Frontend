import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import '../../src/i18n';
import '../../src/index.css';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { AuthSessionBoundary } from '../../src/context/AuthSessionBoundary';
import { apiClient } from '../../src/api/axiosConfig';
import { StoreTab } from '../../src/components/workspace/tabs/StoreTab';
import { CampaignsTab } from '../../src/components/workspace/tabs/CampaignsTab';
import { JobsTab } from '../../src/components/workspace/tabs/JobsTab';
const token = (account: string) => 'review.' + btoa(JSON.stringify({ sub: account, version: 1 })) + '.fixture';
function Account() {
    const auth = useAuth(); const [renewal, setRenewal] = useState('');
    return <header className="flex flex-wrap items-center gap-5 border-b p-5">
        <output aria-label="Account">{auth.status}:{auth.user?.fullName ?? '-'}</output>
        <button onClick={() => void auth.loginWithAccessToken(token('Alpha'))}>Sign in Alpha</button>
        <button onClick={() => void auth.loginWithAccessToken(token('Bravo'))}>Sign in Bravo</button>
        <button disabled={!auth.isAuthenticated} onClick={() => void auth.logout()}>Sign out</button>
        <button onClick={async () => { setRenewal('Renewing'); await apiClient.get('/review-expired'); setRenewal('Renewed'); }}>Renew session</button>
        <output>{renewal}</output>
    </header>;
}
function Workspace() {
    const auth = useAuth(); const { feature } = useParams();
    if (!auth.isAuthenticated) return <p>Sign in to open the workspace.</p>;
    return <main className="workspace-light" style={{ padding: 24, maxWidth: 1100, margin: 'auto' }}>
        <nav className="mb-6 flex gap-6">{['Overview', 'Store', 'Campaigns', 'Jobs'].map(name => <Link key={name} to={'/' + name}>{name} tab</Link>)}</nav>
        {feature === 'Store' ? <StoreTab clubId={10} /> : feature === 'Campaigns' ? <CampaignsTab clubId={10} />
            : feature === 'Jobs' ? <JobsTab clubId={10} currentUserId={auth.user!.id} canReviewAllApplications pendingKey={null} /> : <h1>Workspace overview</h1>}
    </main>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/Store']}><AuthProvider><Account />
    <AuthSessionBoundary><Routes><Route path="/:feature" element={<Workspace />} /></Routes></AuthSessionBoundary>
</AuthProvider></MemoryRouter>);
