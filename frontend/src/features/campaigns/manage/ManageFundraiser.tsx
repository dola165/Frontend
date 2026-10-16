import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Megaphone, Pencil, TrendingUp } from 'lucide-react';
import { Dialog } from '../../../design/Dialog';
import { Button, ButtonLink } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { RowMenu } from '../../clubWorkspace/commerce/RowMenu';
import { changeCampaignState, fetchManagedCampaign, type Campaign, type CampaignState } from '../api';
import { manageToolPath, useManagesFundraisers } from './manageAccess';
import '../../clubWorkspace/commerce/commerce.css';

/**
 * The organiser's entrance to one fundraiser, wherever it shows: Report progress and Post an update in view, Edit,
 * Pause or Resume and End behind More. Each tool opens for this campaign and comes back here; the state changes happen
 * in place (End asks first). Renders nothing for anyone who does not run the club's fundraisers; a list that already
 * knows passes `allowed` and saves asking for every card.
 */
export function ManageFundraiser({ campaign, onChanged, compact, allowed: known }: { campaign: Campaign; onChanged: () => void; compact?: boolean; allowed?: boolean }) {
    const location = useLocation();
    const asked = useManagesFundraisers(known === undefined ? campaign.clubId : null);
    const allowed = known ?? asked;
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [ending, setEnding] = useState(false);
    if (!allowed || campaign.status === 'ARCHIVED') return null;
    const back = { back: `${location.pathname}${location.search}`, backState: location.state };
    const live = campaign.status === 'PUBLISHED' || campaign.status === 'PAUSED';
    const change = async (status: CampaignState) => {
        if (busy) return;
        setEnding(false); setBusy(true); setError('');
        try {
            // The public page may be older than the manager's copy: change the latest version.
            const latest = await fetchManagedCampaign(campaign.clubId, campaign.id);
            await changeCampaignState(campaign.clubId, latest, status);
            onChanged();
        } catch (failure) { setError(extractApiErrorMessage(failure, 'The fundraiser could not be changed.')); }
        finally { setBusy(false); }
    };
    return (
        <div className="gk-fund-manage" data-compact={compact || undefined} aria-label={`Manage ${campaign.title}`} role="group">
            {!compact && <span className="gk-fund-manage__label">You run this fundraiser</span>}
            <span className="gk-fund-manage__actions">
                {live && <ButtonLink size="sm" to={manageToolPath(campaign.id, 'report')} state={back}><TrendingUp aria-hidden="true" />Report progress</ButtonLink>}
                {campaign.publishedAt && <ButtonLink size="sm" variant="ghost" to={manageToolPath(campaign.id, 'update')} state={back}><Megaphone aria-hidden="true" />Post an update</ButtonLink>}
                <RowMenu name={campaign.title} disabled={busy}>
                    <Link className="cm-menu__item" to={manageToolPath(campaign.id, 'edit')} state={back}><Pencil aria-hidden="true" />Edit fundraiser</Link>
                    {campaign.status === 'PUBLISHED' && <button type="button" className="cm-menu__item" disabled={busy} onClick={() => void change('PAUSED')}>Pause</button>}
                    {campaign.status === 'PAUSED' && <button type="button" className="cm-menu__item" disabled={busy} onClick={() => void change('PUBLISHED')}>Resume</button>}
                    {live && <button type="button" className="cm-menu__item cm-menu__item--danger" disabled={busy} onClick={() => setEnding(true)}>End fundraiser</button>}
                </RowMenu>
            </span>
            {busy && <span className="gk-faint" role="status">Saving…</span>}
            {error && <span className="gk-fund-manage__error" role="alert">{error}</span>}
            <Dialog open={ending} role="alertdialog" size="sm" title="End this fundraiser?" onClose={() => { if (!busy) setEnding(false); }}
                description={`“${campaign.title}” and its updates stay public, but it cannot be resumed. Close the GoFundMe page too.`}
                footer={<><Button variant="ghost" disabled={busy} onClick={() => setEnding(false)}>Keep it running</Button><Button variant="danger" disabled={busy} onClick={() => void change('CLOSED')}>End fundraiser</Button></>} />
        </div>
    );
}
