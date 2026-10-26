import { promptEmailConfirmation } from '../components/auth/emailConfirmationPrompt';
import { ct, useCommerceCopy } from '../features/store/copy';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { CommerceDraftScope } from '../components/workspace/CommerceDraftScope';
import { useClearCommerceForm, useCommerceDraftState } from '../components/workspace/commerceDraftState';
import { Button, ButtonLink, EmptyNote, Field, GkRoot, PageFrame, PageHeader, Skeleton } from '../design/primitives';
import { campaignMoney, editCampaign, fetchCampaign, fetchManagedCampaign, postCampaignUpdate, type Campaign, type CampaignInput } from '../features/campaigns/api';
import { useFundraiserAccess, type FundraiserTool } from '../features/campaigns/manage/manageAccess';
import { CampaignForm } from '../features/clubWorkspace/commerce/CampaignForm';
import { CampaignUpdates } from '../features/clubWorkspace/commerce/CampaignUpdates';
import { useWorldData } from '../features/world/useWorldData';
import { extractApiErrorMessage } from '../utils/apiError';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';
import '../features/clubWorkspace/commerce/commerce.css';

const TOOLS: FundraiserTool[] = ['report', 'update', 'edit'];
/** Everything the manager's editor sends, from the campaign as it is now, so one change keeps the rest. */
const inputOf = (campaign: Campaign): CampaignInput => ({
    version: campaign.version, title: campaign.title, summary: campaign.summary, description: campaign.description, beneficiary: campaign.beneficiary, useOfFunds: campaign.useOfFunds,
    category: campaign.category, currency: campaign.currency, goalAmount: campaign.goalAmount, reportedAmount: campaign.reportedAmount, reportedNote: campaign.reportedNote,
    startsOn: campaign.startsOn, endsOn: campaign.endsOn, images: campaign.images,
});

/** Reporting what came in: the amount the club has received so far and where it came from, nothing else. */
function ReportProgress({ campaign, saving, error, backLabel, onCancel, onSubmit }: { campaign: Campaign; saving: boolean; error: string; backLabel: string; onCancel: () => void; onSubmit: (amount: number, note: string) => void }) {
    useCommerceCopy();
    const [amount, setAmount] = useCommerceDraftState('form:reported', campaign.reportedAmount?.toString() ?? '');
    const [note, setNote] = useCommerceDraftState('form:note', campaign.reportedNote ?? '');
    const value = Number(amount), valid = amount !== '' && value >= 0 && note.trim().length > 0;
    return <PageFrame className="cw-page cm-page">
        <div className="cm-editor__back"><Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}><ArrowLeft aria-hidden="true" />{backLabel}</Button></div>
        <PageHeader title={ct("Report progress")} subtitle={campaign.title} />
        <form className="gk-panel cm-section" aria-label={ct("Report progress")} onSubmit={event => { event.preventDefault(); if (valid && !saving) onSubmit(value, note.trim()); }}>
            <header className="cm-section__head"><h2 className="gk-panel__title">{ct("Raised so far")}</h2><p className="cm-hint">{ct("Only what the club has received, on GoFundMe and elsewhere. Supporters see it as reported by the club, not checked by GrassKickZ.")}</p></header>
            <div className="cm-section__body">
                {error && <p className="gk-notice gk-notice--danger" role="alert">{error}{ct(" Your figures are kept.")}</p>}
                <fieldset disabled={saving} className="cm-editor__fields cm-fieldset">
                    <Field label={ct("Amount ({v0})", { v0: campaign.currency })} htmlFor="report-amount" hint={campaign.goalAmount ? ct("Goal {v0}", { v0: campaignMoney(campaign.goalAmount, campaign.currency) }) : undefined}>
                        <input id="report-amount" className="gk-input" type="number" inputMode="decimal" autoFocus required min="0" max="9999999999.99" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></Field>
                    <Field label={ct("Where it came from")} htmlFor="report-note" hint={ct("For example: GoFundMe total on 16 October, plus cash at the summer tournament.")}><textarea id="report-note" className="gk-input" required rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} /></Field>
                </fieldset>
                <div className="cm-editor__actions">
                    <Button disabled={saving} onClick={onCancel}>{ct("Cancel")}</Button>
                    <Button type="submit" variant="primary" disabled={saving || !valid}>{saving ? ct("Saving…") : ct("Save progress")}</Button>
                </div>
            </div>
        </form>
    </PageFrame>;
}

/** One tool for one campaign, opened from its page or the club's catalogue, and back there when done or cancelled. */
function Tool({ tool, campaign, backLabel, onDone }: { tool: FundraiserTool; campaign: Campaign; backLabel: string; onDone: (message?: string) => void }) {
    useCommerceCopy();
    const clearForm = useClearCommerceForm();
    const [saving, setSaving] = useState(false), [error, setError] = useState('');
    const run = async (save: () => Promise<unknown>, message: string, fallback: string) => {
        if (saving) return;
        setSaving(true); setError('');
        try { await save(); clearForm(); onDone(message); }
        catch (failure) { if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, fallback)); }
        finally { setSaving(false); }
    };
    const cancel = () => { clearForm(); onDone(); };
    if (tool === 'update') return <CampaignUpdates campaign={campaign} saving={saving} error={error} backLabel={backLabel} onCancel={cancel}
        onSubmit={(title, body) => run(() => postCampaignUpdate(campaign.clubId, campaign, title, body), ct("Update published"), ct("The update could not be published."))} />;
    if (tool === 'edit') return <CampaignForm campaign={campaign} saving={saving} error={error} backLabel={backLabel} onCancel={cancel}
        onSubmit={input => run(() => editCampaign(campaign.clubId, campaign.id, input), ct("Fundraiser saved"), ct("Could not save the fundraiser."))} />;
    return <ReportProgress campaign={campaign} saving={saving} error={error} backLabel={backLabel} onCancel={cancel}
        onSubmit={(amount, note) => void run(() => editCampaign(campaign.clubId, campaign.id, { ...inputOf(campaign), reportedAmount: amount, reportedNote: note }), ct("Progress reported"), ct("The progress could not be saved."))} />;
}

export const FundraiserManagePage = () => {
    useCommerceCopy();
    const { id, tool: toolParam } = useParams();
    const [params] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const campaignId = Number(id), valid = Number.isSafeInteger(campaignId) && campaignId > 0;
    const tool = TOOLS.find(item => item === toolParam);
    const from = (location.state ?? {}) as { back?: string; backState?: unknown };
    const hint = Number(params.get("club"));
    const hintClubId = Number.isSafeInteger(hint) && hint > 0 ? hint : undefined;
    const back = from.back ?? (hintClubId ? `/clubs/${hintClubId}/workspace?tab=campaigns` : `/campaigns/${campaignId}`);
    const backLabel = back.startsWith(`/campaigns/${campaignId}`) ? ct("Back to the fundraiser") : ct("Back to fundraisers");
    const shown = useWorldData(valid && !hintClubId ? `fundraiser:${campaignId}` : null, signal => fetchCampaign(campaignId, signal), ct("This fundraiser is unavailable or could not be loaded."));
    const clubId = hintClubId ?? shown.data?.clubId;
    const access = useFundraiserAccess(clubId);
    const allowed = access.allowed;
    // The manager's own copy: the latest version, and drafts the public page does not show.
    const managed = useWorldData(clubId && allowed ? `managed-campaign:${clubId}:${campaignId}` : null, signal => fetchManagedCampaign(clubId!, campaignId, signal), ct("This fundraiser could not be opened for editing."));
    const done = (message?: string) => { if (message) toast.success(message); navigate(back, { replace: true, state: from.backState }); };
    const body = !valid || !tool ? <EmptyNote title={ct("This fundraiser is unavailable")} action={<ButtonLink to="/campaigns">{ct("Fundraising")}</ButtonLink>}>{ct("The link does not point to a fundraiser tool.")}</EmptyNote>
        : shown.error ? <EmptyNote title={ct("This fundraiser could not be opened")} action={<Button onClick={shown.retry}>{ct("Try again")}</Button>}>{shown.error}</EmptyNote>
        : shown.loading || access.loading || (allowed && managed.loading) ? <div aria-busy="true"><Skeleton height={34} width={320} /><Skeleton height={220} /></div>
        : access.error ? <EmptyNote title={ct("Staff access could not be checked")} action={<Button onClick={access.retry}>{ct("Retry club check")}</Button>}>{access.error}</EmptyNote>
        : !allowed ? <EmptyNote title={ct("Only the club’s staff can manage this fundraiser")} action={<ButtonLink to="/campaigns">{ct("Fundraising")}</ButtonLink>} />
        : managed.error || !managed.data ? <EmptyNote title={ct("This fundraiser could not be opened")} action={<Button size="sm" onClick={managed.retry}>{ct("Try again")}</Button>}>{managed.error}</EmptyNote>
        : <div className="gk-fund-tool" data-tool={tool}><CommerceDraftScope clubId={managed.data.clubId} feature={`Fundraiser:${campaignId}`}><Tool tool={tool} campaign={managed.data} backLabel={backLabel} onDone={done} /></CommerceDraftScope></div>;
    return (
        <GkRoot className="gk-store gk-page" data-market="fundraising">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}>
                    <Link to="/campaigns">{ct("Fundraising")}</Link>
                    {shown.data && <><span aria-hidden="true">/</span><Link to={`/campaigns/${campaignId}`}>{shown.data.title}</Link><span aria-hidden="true">/</span><span>{ct("Manage")}</span></>}
                </nav>
                {body}
            </PageFrame>
        </GkRoot>
    );
};
