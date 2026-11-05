import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNavigationCapability } from '../../context/useNavigationCapability';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, PageHeader } from '../../design/primitives';
import { assertCurrentAuthSession, isCurrentAuthSession } from '../../utils/authStorage';
import { useOwnedDraft } from '../../utils/ownedDraft';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useWorldData } from '../world/useWorldData';
import { campaignPhase, fetchFundraisingClubs, fetchPersonalCampaign, fetchPersonalCampaigns, movePersonalCampaign, postPersonalUpdate, type Campaign } from './api';
import { AppealForm } from './AppealForm';
import { CampaignHistory } from './CampaignHistory';
import './fundraisingManagement.css';

export function StartFundraiser() {
    const { sessionId } = useAuth();
    const [params, setParams] = useSearchParams();
    // Personal appeals are held back in release 17 until the server switches them on.
    const own = useNavigationCapability('fundraising.personal');
    const clubId = Number(params.get('club') ?? params.get('clubId'));
    const personal = own === true && params.get('for') === 'me';
    const clubs = useWorldData(!personal ? `${sessionId}:fundraising-clubs` : null, fetchFundraisingClubs);
    if (own === false && params.get('for') === 'me') return <Navigate to="/campaigns/new" replace />;
    return <GkRoot className="gk-appeal-manage"><PageFrame width="profile"><PageHeader title="Start a fundraiser" actions={own && <ButtonLink to="/campaigns?mine=all">My appeals</ButtonLink>} />
        {personal || clubId > 0 ? <AppealForm key={`${sessionId}:${personal ? 'me' : clubId}`} clubId={personal ? undefined : clubId} /> : <>
            {own && <><p>Who is raising the funds?</p><div className="gk-appeal-actions"><Button onClick={() => setParams({ for: 'me' })}>For myself</Button></div></>}
            <h2>For a club</h2>{clubs.loading ? <p role="status">Loading your clubs…</p> : clubs.error ? <EmptyNote title="Your clubs could not load" action={<Button onClick={clubs.retry}>Retry</Button>} />
                : clubs.data?.map(c => <div className="gk-appeal-actions" key={c.id}><Button onClick={() => setParams({ club: String(c.id) })}>{c.name}</Button></div>)}
            <ButtonLink to="/projects">Open club projects</ButtonLink>
        </>}
    </PageFrame></GkRoot>;
}

export function PersonalFundraising() {
    const { sessionId, isAuthenticated } = useAuth();
    const [params] = useSearchParams();
    const id = Number(params.get('mine'));
    const detail = useWorldData(isAuthenticated && id > 0 ? `${sessionId}:appeal:${id}` : null, signal => fetchPersonalCampaign(id, signal));
    const list = useWorldData(isAuthenticated && !(id > 0) ? `${sessionId}:appeals` : null, fetchPersonalCampaigns);
    const result = id > 0 ? detail : list;
    return <GkRoot className="gk-appeal-manage"><PageFrame width="profile"><PageHeader title={id > 0 ? 'Manage your appeal' : 'My personal appeals'} actions={<><ButtonLink to="/campaigns">Public fundraisers</ButtonLink><ButtonLink to="/campaigns/new?for=me">New appeal</ButtonLink></>} />
        {!isAuthenticated ? <EmptyNote title="Sign in to manage your appeals" action={<ButtonLink to="/login">Sign in</ButtonLink>} />
            : result.error ? <EmptyNote title="Your appeals could not load" action={<Button onClick={result.retry}>Retry</Button>}>{result.error}</EmptyNote>
                : result.loading ? <p role="status">Loading…</p>
                    : detail.data ? <PersonalAppeal key={`${sessionId}:${id}:${detail.data.version}`} campaign={detail.data} reload={detail.retry} />
                        : list.data?.length ? <ul className="gk-appeal-list">{list.data.map(c => <li key={c.id}><ButtonLink to={`/campaigns?mine=${c.id}`}>{c.title} · {campaignPhase(c.status)}</ButtonLink></li>)}</ul>
                            : <EmptyNote title="No personal appeal yet" action={<ButtonLink to="/campaigns/new?for=me">Start an appeal</ButtonLink>} />}
    </PageFrame></GkRoot>;
}

function PersonalAppeal({ campaign: c, reload }: { campaign: Campaign; reload: () => void }) {
    const { sessionId, isAuthenticated } = useAuth();
    const { draft, change, reset } = useOwnedDraft(`fundraising-command-${c.id}`, { pending: null as null | { request: string; state?: string; title?: string; body?: string; version: number; consent: boolean } });
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [consent, setConsent] = useState(false);
    const [dirty, setDirty] = useState(false);
    const update = useOwnedDraft(`fundraising-news-${c.id}`, { title: '', body: '' });
    const run = async (state?: string) => {
        if (busy || !isAuthenticated) return;
        const pending = draft.pending ?? { request: crypto.randomUUID(), state, title: update.draft.title, body: update.draft.body, version: c.version, consent };
        change({ pending }); setBusy(true); setError('');
        try {
            if (pending.state) await movePersonalCampaign(c.id, pending.version, pending.state, pending.consent, pending.request);
            else await postPersonalUpdate(c.id, pending.version, pending.title!, pending.body!, pending.request);
            assertCurrentAuthSession(sessionId); reset(); if (!pending.state) update.reset(); reload();
        } catch (failure) {
            if (!isCurrentAuthSession(sessionId)) return;
            assertCurrentAuthSession(sessionId);
            const status = (failure as { response?: { status?: number } }).response?.status;
            if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) change({ pending: null });
            setError(extractApiErrorMessage(failure, 'The change could not be confirmed. Retry the same request.'));
        } finally { setBusy(false); }
    };
    const frozen = busy || draft.pending !== null;
    return <>
        {c.publicationRestricted && <p role="alert">Publication is restricted. Changes remain private until a platform administrator lifts the restriction.</p>}
        <h2>{c.title}</h2><p>{campaignPhase(c.status)} · version {c.version}</p>
        <p>Paused and closed appeals remain public history. Taking an appeal off the site removes its public page and all public listings.</p>
        <div className="gk-appeal-actions">{c.publishedAt && c.status !== 'ARCHIVED' && !c.publicationRestricted && <ButtonLink to={`/campaigns/${c.id}`}>View public page</ButtonLink>}<Button onClick={reload} disabled={busy}>Reload latest</Button></div>
        {c.status !== 'ARCHIVED' && <>
            {!frozen && <AppealForm campaign={c} onSaved={reload} onDirtyChange={setDirty} />}
            {dirty && <p>Save your changes before publishing the appeal.</p>}
            {(c.status === 'DRAFT' || c.status === 'PAUSED') && <label className="gk-appeal-consent"><input type="checkbox" checked={consent} disabled={frozen} onChange={e => setConsent(e.target.checked)} />I am the adult beneficiary. This appeal contains no child's private information, and supporters may contact me to arrange giving.</label>}
            <div className="gk-appeal-actions">
                {(c.status === 'DRAFT' || c.status === 'PAUSED') && <Button disabled={frozen || !consent || c.publicationRestricted || dirty} onClick={() => void run('PUBLISHED')}>Publish</Button>}
                {c.status === 'PUBLISHED' && <Button disabled={frozen} onClick={() => void run('PAUSED')}>Pause</Button>}
                {(c.status === 'PUBLISHED' || c.status === 'PAUSED') && <Button disabled={frozen} onClick={() => void run('CLOSED')}>Close appeal</Button>}
                <Button disabled={frozen} onClick={() => void run('ARCHIVED')}>Take off the site</Button>
            </div>
            {c.publishedAt && <form className="gk-appeal-form" onSubmit={e => { e.preventDefault(); void run(); }}><h3>Public update</h3><fieldset disabled={frozen}>
                <label>Update title<input required maxLength={120} value={update.draft.title} onChange={e => update.change({ title: e.target.value })} /></label>
                <label>Message<textarea required maxLength={3000} value={update.draft.body} onChange={e => update.change({ body: e.target.value })} /></label>
                <Button type="submit" disabled={frozen}>Post update</Button></fieldset></form>}
        </>}
        {draft.pending && <Button disabled={busy} onClick={() => void run()}>Retry the same change</Button>}
        {error && <p role="alert">{error}</p>}
        <CampaignHistory campaign={c} />
    </>;
}
