import { useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Button, ButtonLink, Field, PageHeader } from '../../../design/primitives';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { StoreProductsPage } from '../../clubWorkspace/commerce/StoreProductsPage';
import { useWorldData } from '../../world/useWorldData';
import { fetchPlatformSeller, savePlatformSeller, type PlatformSeller } from './api';
import '../orders/orders.css';

function SellerForm({ initial, onReload }: { initial: PlatformSeller; onReload: () => void }) {
    const [input, setInput] = useState(initial), [saved, setSaved] = useState(''), [error, setError] = useState('');
    const [attempt, setAttempt] = useState<PlatformSeller | null>(null), [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const change = (field: keyof PlatformSeller, value: string) => { setInput(current => ({ ...current, [field]: value })); setSaved(''); };
    return <form className="store-orders" aria-label="GrassKickZ seller details" onSubmit={e => {
        e.preventDefault(); if (pending.current) return;
        const session = getAuthSessionId(), body = attempt ?? input;
        pending.current = true; setAttempt(body); setBusy(true); setError('');
        void savePlatformSeller(body, session).then(result => {
            if (isCurrentAuthSession(session)) { setInput(result); setAttempt(null); setSaved('Seller details saved.'); }
        }).catch(failure => { if (isCurrentAuthSession(session)) setError(extractApiErrorMessage(failure, 'Could not confirm seller details. Retry the same save or reload to review.')); })
            .finally(() => { pending.current = false; if (isCurrentAuthSession(session)) setBusy(false); });
    }}>
        <p>Add the actual seller’s public contact and collection/delivery arrangements before publishing real inventory.</p>
        <fieldset disabled={busy || !!attempt}>
            <Field label="Public seller email" htmlFor="platform-email"><input className="gk-input" id="platform-email" type="email" maxLength={254} value={input.contactEmail} onChange={e => change('contactEmail', e.target.value)} /></Field>
            <Field label="Public WhatsApp" htmlFor="platform-whatsapp"><input className="gk-input" id="platform-whatsapp" maxLength={40} value={input.whatsapp} onChange={e => change('whatsapp', e.target.value)} /></Field>
            <Field label="Seller website (HTTPS)" htmlFor="platform-website"><input className="gk-input" id="platform-website" type="url" maxLength={500} value={input.website} onChange={e => change('website', e.target.value)} /></Field>
            <Field label="Actual collection/delivery and contact arrangement" htmlFor="platform-arrangement"><textarea className="gk-input" id="platform-arrangement" maxLength={1000} value={input.arrangement} onChange={e => change('arrangement', e.target.value)} /></Field>
        </fieldset>
        {error && <p role="alert">{error}</p>}{saved && <p role="status">{saved}</p>}
        {error && !busy && <><p>Your edits stay here. Copy anything you want to keep before reopening the latest saved details.</p><Button onClick={onReload}>Reload saved seller details</Button></>}
        <Button type="submit" disabled={busy}>{attempt ? 'Retry same seller save' : 'Save seller details'}</Button>
    </form>;
}

export function PlatformStore() {
    const { status, sessionId } = useAuth();
    const seller = useWorldData(status === 'authenticated' ? `platform-seller:${sessionId}` : null, fetchPlatformSeller, 'Platform seller details are unavailable or access was removed.');
    return <section className="store-orders store-platform">
        <PageHeader title="GrassKickZ store administration" actions={<ButtonLink to="/store">Back to Store</ButtonLink>} />
        {seller.loading && <p role="status">Loading seller…</p>}
        {seller.error && <div role="alert">{seller.error}<Button onClick={seller.retry}>Reload seller</Button></div>}
        {seller.data && <><details open><summary>Seller contact and arrangement</summary><SellerForm key={sessionId} initial={seller.data} onReload={seller.retry} /></details><StoreProductsPage clubId={0} /></>}
        {status !== 'authenticated' && <ButtonLink to="/login?returnTo=%2Fstore%3Fview%3Dmanage">Sign in</ButtonLink>}
    </section>;
}
