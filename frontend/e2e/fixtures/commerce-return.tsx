import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import '../../src/i18n';
import '../../src/index.css';
import { StoreTab } from '../../src/components/workspace/tabs/StoreTab';
import { CampaignsTab } from '../../src/components/workspace/tabs/CampaignsTab';
import { JobsTab } from '../../src/components/workspace/tabs/JobsTab';
import { clearStoredAuth, setStoredAccessToken } from '../../src/utils/authStorage';

// Synthetic UI/client fixture only. All network requests are owned by the runner.
function selectAccount(id: number) {
    clearStoredAuth();
    setStoredAccessToken(`commerce-fixture-${id}`);
    localStorage.setItem('userId', String(id));
    window.dispatchEvent(new Event('gk-auth-changed'));
}
selectAccount(55001);
export function Page() {
    const { feature, club = '10' } = useParams();
    const [account, setAccount] = useState(55001);
    return <main className="workspace-light" style={{padding:16,maxWidth:1100,margin:'auto'}}>
        <p>Synthetic review: {account === 55001 ? 'coach@talanti.ge' : 'Other account'} · {club === '10' ? 'FC Dinamo Tbilisi Academy' : 'Other club'}</p>
        <nav aria-label="Review navigation" style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:20}}>
            {['Overview','Store','Campaigns','Jobs'].map(name => <Link key={name} to={`/clubs/${club}/${name}`}>{name} tab</Link>)}
            <Link to={`/clubs/${club === '10' ? '20' : '10'}/${feature}`}>Switch club</Link>
            <button onClick={() => {const next = account === 55001 ? 55002 : 55001;selectAccount(next);setAccount(next);}}>Switch account</button>
        </nav>
        {feature === 'Store' ? <StoreTab clubId={Number(club)}/> : feature === 'Campaigns' ? <CampaignsTab clubId={Number(club)}/> : feature === 'Jobs' ? <JobsTab clubId={Number(club)} currentUserId={account} canReviewAllApplications pendingKey={null}/> : <h1>Workspace overview</h1>}
    </main>;
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/clubs/10/Store']}><Routes><Route path="/clubs/:club/:feature" element={<Page/>}/></Routes></MemoryRouter>);
