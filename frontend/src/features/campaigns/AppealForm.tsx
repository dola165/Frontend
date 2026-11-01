import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, ButtonLink } from '../../design/primitives';
import { assertCurrentAuthSession, isCurrentAuthSession } from '../../utils/authStorage';
import { useOwnedDraft } from '../../utils/ownedDraft';
import { extractApiErrorMessage } from '../../utils/apiError';
import { CAMPAIGN_CATEGORIES, CURRENCIES, createClubCampaign, savePersonalCampaign, type Campaign, type CampaignInput } from './api';
import './fundraisingManagement.css';

const empty: CampaignInput = { title: '', summary: '', description: '', beneficiary: '', useOfFunds: '', category: 'EQUIPMENT', currency: 'GEL', goalAmount: null, reportedAmount: null, reportedNote: '', startsOn: null, endsOn: null, images: [], donateUrl: null };
type Draft = { input: CampaignInput; pending: { input: CampaignInput; request: string } | null };

/** One account-scoped form; an uncertain save keeps its exact request for recovery. */
export function AppealForm({ campaign, clubId, onSaved, onDirtyChange }: { campaign?: Campaign; clubId?: number; onSaved?: (campaign: Campaign) => void; onDirtyChange?: (dirty: boolean) => void }) {
    const { sessionId, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const initial = campaign ? Object.fromEntries(Object.keys(empty).map(key => [key, campaign[key as keyof Campaign]])) as CampaignInput : empty;
    if (campaign) initial.version = campaign.version;
    if (!clubId) initial.beneficiary = '';
    const { draft, change, reset } = useOwnedDraft<Draft>(`fundraising-${clubId ? 'club-' + clubId : campaign?.id ?? 'new'}`, { input: initial, pending: null });
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const input = draft.input;
    const dirty = JSON.stringify(input) !== JSON.stringify(initial) || draft.pending !== null;
    useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
    const edit = (patch: Partial<CampaignInput>) => change({ input: { ...input, ...patch } });
    const save = async () => {
        if (busy || !isAuthenticated) return;
        const pending = draft.pending ?? { input, request: crypto.randomUUID() };
        change({ pending }); setBusy(true); setError('');
        try {
            const saved = clubId ? await createClubCampaign(clubId, pending.input, pending.request)
                : await savePersonalCampaign(campaign?.id ?? null, pending.input, pending.request);
            assertCurrentAuthSession(sessionId);
            reset();
            if (onSaved) onSaved(saved);
            else navigate(clubId ? `/campaigns/${saved.id}/manage/overview` : `/campaigns?mine=${saved.id}`, { replace: true });
        } catch (failure) {
            if (!isCurrentAuthSession(sessionId)) return;
            const status = (failure as { response?: { status?: number } }).response?.status;
            if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) change({ pending: null });
            setError(extractApiErrorMessage(failure, 'The save could not be confirmed. Retry the same request to recover it.'));
        } finally { setBusy(false); }
    };
    return <form className="gk-appeal-form" onSubmit={event => { event.preventDefault(); void save(); }}>
        <p>{clubId ? 'One appeal, linked to its project automatically. No squads or operations setup is needed.' : 'An appeal for yourself, under your adult public profile. No club membership is needed. Your profile name is the beneficiary; photos and child records are never imported.'}</p>
        <fieldset disabled={busy || draft.pending !== null}>
            <label>Title<input required maxLength={120} value={input.title} onChange={e => edit({ title: e.target.value })} /></label>
            <label>Short summary<input maxLength={240} value={input.summary} onChange={e => edit({ summary: e.target.value })} /></label>
            <label>Why you need support<textarea maxLength={5000} rows={4} value={input.description} onChange={e => edit({ description: e.target.value })} /></label>
            {clubId && <label>Beneficiary<input maxLength={240} value={input.beneficiary} onChange={e => edit({ beneficiary: e.target.value })} /></label>}
            <label>How the funds will be used<textarea maxLength={2000} rows={2} value={input.useOfFunds} onChange={e => edit({ useOfFunds: e.target.value })} /></label>
            <div className="gk-appeal-form__row">
                <label>Cause<select value={input.category} onChange={e => edit({ category: e.target.value })}>{CAMPAIGN_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                <label>Currency<select value={input.currency} onChange={e => edit({ currency: e.target.value, reportedAmount: null, reportedNote: '', goalAmount: null })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label>
                <label>Target (optional)<input type="number" min="0.01" max="9999999999.99" step="0.01" value={input.goalAmount ?? ''} onChange={e => edit({ goalAmount: e.target.value ? Number(e.target.value) : null })} /></label>
            </div>
            {campaign && input.currency !== campaign.currency && <p>Enter the target again in {input.currency}. Earlier reports keep their currency in history; amounts are not converted.</p>}
            <div className="gk-appeal-form__row">
                <label>Reported total (optional)<input type="number" min="0" max="9999999999.99" step="0.01" value={input.reportedAmount ?? ''} onChange={e => edit({ reportedAmount: e.target.value ? Number(e.target.value) : null })} /></label>
                <label>What this report covers<input maxLength={1000} required={input.reportedAmount !== null} value={input.reportedNote} onChange={e => edit({ reportedNote: e.target.value })} /></label>
            </div>
            <p>Leave the total blank when nothing has been reported. A reported zero means zero. The report is dated when saved and is attributed to the organizer.</p>
            <div className="gk-appeal-form__row">
                <label>Starts (optional)<input type="date" value={input.startsOn ?? ''} onChange={e => edit({ startsOn: e.target.value || null })} /></label>
                <label>Ends (optional)<input type="date" value={input.endsOn ?? ''} onChange={e => edit({ endsOn: e.target.value || null })} /></label>
            </div>
        </fieldset>
        <p>Supporters can contact the organizer to arrange giving outside GrassKickZ. No payment, receipt or refund is recorded here.</p>
        {error && <p role="alert">{error}</p>}
        <div className="gk-appeal-actions"><Button type="submit" variant="primary" disabled={busy || !isAuthenticated}>{busy ? 'Saving…' : draft.pending ? 'Retry the same save' : campaign ? 'Save changes' : 'Save draft'}</Button>
            <ButtonLink to="/campaigns?mine=all">My appeals</ButtonLink>
            {campaign && !draft.pending && <Button type="button" onClick={() => { reset(); setError(''); }}>Use the loaded server version</Button>}
        </div>
        <div className="gk-appeal-actions"><ButtonLink to="/account?tab=security">Email confirmation</ButtonLink><ButtonLink to="/profile/me">My public profile</ButtonLink></div>
    </form>;
}
