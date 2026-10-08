import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import '../../src/i18n';
import '../../src/index.css';
import '../../src/styles/product-identity.css';
import { JevAdvice } from '../../src/features/jev/JevAdvice';
import { ReportPost } from '../../src/features/jev/ReportPost';
import { ContentReportsPanel } from '../../src/features/jev/ContentReportsPanel';
function Fixture() {
    const [category, setCategory] = useState('OTHER'), [kind, setKind] = useState('POSITION');
    return <main style={{ maxWidth: 760, padding: 20, margin: 'auto', color: '#f4f4f5' }}>
        <h1 style={{ fontSize: 28 }}>GrassKickZ · Assistance</h1>
        <section><h2>Club role listing</h2><p>U14 goalkeeper coach · {category}</p>
            <JevAdvice kind="listing" endpoint="/jev/listings/7" input={{ title: 'U14 goalkeeper coach', description: 'Paid weekend coaching. Experience required.', category, engagement: 'VOLUNTEER' }} onApply={setCategory} /></section>
        <section><h2>Career entry</h2><p>Coaching diploma · {kind}</p><JevAdvice kind="career" endpoint="/jev/career" input={{ title: 'Coaching diploma', description: 'Completed coaching course' }} onApply={setKind} /></section>
        <section><h2>Public post</h2><p>Weekend training update</p><ReportPost postId={10} /></section>
        <ContentReportsPanel />
    </main>;
}
document.body.style.background='#0f1117';
document.documentElement.classList.add('dark');
createRoot(document.getElementById('root')!).render(<MemoryRouter><Fixture /></MemoryRouter>);
