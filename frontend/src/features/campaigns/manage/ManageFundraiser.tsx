import { ct, useCommerceCopy } from '../../store/copy';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Megaphone, Pencil, TrendingUp } from 'lucide-react';
import { Dialog } from '../../../design/Dialog';
import { Button, ButtonLink } from '../../../design/primitives';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { getAuthSessionId, isCurrentAuthSession } from '../../../utils/authStorage';
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
    useCommerceCopy();
    const location = useLocation();
    const asked = useManagesFundraisers(known === undefined ? campaign.clubId : null);
    const allowed = known ?? asked;
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [ending, setEnding] = useState(false);
    const mounted = useRef(false), pending = useRef(false);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    if (!allowed || campaign.status === 'ARCHIVED') return null;
    const back = { back: `${location.pathname}${location.search}`, backState: location.state };
    const live = campaign.status === 'PUBLISHED' || campaign.status === 'PAUSED';
    const change = async (status: CampaignState) => {
        if (pending.current) return;
        pending.current = true;
        const session = getAuthSessionId();
        const current = () => mounted.current && isCurrentAuthSession(session);
        setEnding(false); setBusy(true); setError('');
        try {
            // The manager must review a changed record before applying the earlier screen's action.
            const latest = await fetchManagedCampaign(campaign.clubId, campaign.id);
            if (!current()) return;
            if (latest.version !== campaign.version || latest.status !== campaign.status) {
                setError(ct('This fundraiser changed. Refresh and review it before trying again.'));
                return;
            }
            await changeCampaignState(campaign.clubId, latest, status);
            if (current()) onChanged();
        } catch (failure) { if (current()) setError(extractApiErrorMessage(failure, ct("The fundraiser could not be changed."))); }
        finally { pending.current = false; if (mounted.current) setBusy(false); }
    };
    return (
        <div className="gk-fund-manage" data-compact={compact || undefined} aria-label={ct("Manage {v0}", { v0: campaign.title })} role="group">
            {!compact && <span className="gk-fund-manage__label">{ct("You run this fundraiser")}</span>}
            <span className="gk-fund-manage__actions">
                {live && <ButtonLink size="sm" to={manageToolPath(campaign.id, 'report')} state={back}><TrendingUp aria-hidden="true" />{ct("Report progress")}</ButtonLink>}
                {campaign.publishedAt && <ButtonLink size="sm" variant="ghost" to={manageToolPath(campaign.id, 'update')} state={back}><Megaphone aria-hidden="true" />{ct("Post an update")}</ButtonLink>}
                <RowMenu name={campaign.title} disabled={busy}>
                    <Link className="cm-menu__item" to={manageToolPath(campaign.id, 'edit')} state={back}><Pencil aria-hidden="true" />{ct("Edit fundraiser")}</Link>
                    {campaign.status === 'PUBLISHED' && <button type="button" className="cm-menu__item" disabled={busy} onClick={() => void change('PAUSED')}>{ct("Pause")}</button>}
                    {campaign.status === 'PAUSED' && <button type="button" className="cm-menu__item" disabled={busy} onClick={() => void change('PUBLISHED')}>{ct("Resume")}</button>}
                    {live && <button type="button" className="cm-menu__item cm-menu__item--danger" disabled={busy} onClick={() => setEnding(true)}>{ct("End fundraiser")}</button>}
                </RowMenu>
            </span>
            {busy && <span className="gk-faint" role="status">{ct("Saving…")}</span>}
            {error && <span className="gk-fund-manage__error" role="alert">{error} <Button size="sm" variant="ghost" disabled={busy} onClick={onChanged}>{ct('Refresh')}</Button></span>}
            <Dialog open={ending} role="alertdialog" size="sm" title={ct("End this fundraiser?")} onClose={() => { if (!busy) setEnding(false); }}
                description={ct("“{v0}” and its updates stay public, but it cannot be resumed. Close the GoFundMe page too.", { v0: campaign.title })}
                footer={<><Button variant="ghost" disabled={busy} onClick={() => setEnding(false)}>{ct("Keep it running")}</Button><Button variant="danger" disabled={busy} onClick={() => void change('CLOSED')}>{ct("End fundraiser")}</Button></>} />
        </div>
    );
}
