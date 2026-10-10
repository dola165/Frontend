import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, HeartHandshake, Pencil, Plus } from 'lucide-react';
import { CommerceDraftScope } from '../../../components/workspace/CommerceDraftScope';
import { useClearCommerceForm, useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { MediaImage } from '../../../components/ui/MediaImage';
import { Dialog } from '../../../design/Dialog';
import { Badge, Button, ButtonLink, EmptyNote, PageFrame, PageHeader, SearchInput, Skeleton, type BadgeTone } from '../../../design/primitives';
import { campaignDate, campaignMoney, campaignPhase, changeCampaignState, createCampaign, editCampaign, fetchManagedCampaign, fetchManagedCampaigns, postCampaignUpdate,
    type Campaign, type CampaignState } from '../../campaigns/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { CampaignForm } from './CampaignForm';
import { campaignCategory } from './labels';
import { CampaignUpdates } from './CampaignUpdates';
import { RowMenu } from './RowMenu';
import '../../clubOperations/records/records.css';
import './commerce.css';

const FILTERS = [['ALL', 'All campaigns'], ['PUBLISHED', 'Published'], ['DRAFT', 'Drafts'], ['PAUSED', 'Paused'], ['CLOSED', 'Closed']] as const;
const phaseTone = (phase: string): BadgeTone => ({ Active: 'accent', 'Starts soon': 'info', Paused: 'warning' } as Record<string, BadgeTone>)[phase] ?? 'neutral';
const progress = (campaign: Campaign) => campaign.goalAmount ? Math.min(100, Math.max(0, (campaign.reportedAmount ?? 0) / campaign.goalAmount * 100)) : 0;

/** The club's fundraising campaigns: write and publish them, post updates, pause, close or archive (asked first). */
function ClubCampaigns({ clubId }: { clubId: number }) {
    const clearForm = useClearCommerceForm();
    const [query, setQuery] = useState(''), [filter, setFilter] = useState('ALL'), [showArchived, setShowArchived] = useState(false);
    const [items, setItems] = useState<Campaign[] | null>(null), [error, setError] = useState('');
    const [actionError, setActionError] = useCommerceDraftState('actionError', '');
    const [message, setMessage] = useCommerceDraftState('message', '');
    const [reload, setReload] = useCommerceDraftState('reload', 0);
    const [editing, setEditing] = useCommerceDraftState<Campaign | 'new' | null>('editing', null);
    const [updates, setUpdates] = useCommerceDraftState<Campaign | null>('updates', null);
    const [busy, setBusy] = useCommerceDraftState('busy', false);
    const [formError, setFormError] = useCommerceDraftState('formError', '');
    const [confirm, setConfirm] = useState<{ campaign: Campaign; status: CampaignState } | null>(null), [pendingLabel, setPendingLabel] = useState('');
    const active = useRef(true);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    useEffect(() => {
        const controller = new AbortController();
        let current = true;
        setError('');
        void fetchManagedCampaigns(clubId, controller.signal).then(data => { if (current) setItems(data); })
            .catch(failure => { if (current) setError(extractApiErrorMessage(failure, 'Campaigns could not load.')); });
        return () => { current = false; controller.abort(); };
    }, [clubId, reload]);
    const replace = (campaign: Campaign) => setItems(current => current ? current.map(item => item.id === campaign.id ? campaign : item) : [campaign]);
    const transition = async (campaign: Campaign, status: CampaignState) => {
        if (busy) return;
        // A confirmed close or archive closes its dialog at once; the pending change shows on the page.
        setConfirm(null); setBusy(true); setActionError(''); setError(''); setMessage('');
        try {
            const result = await changeCampaignState(clubId, campaign, status);
            if (active.current) replace(result);
            setMessage(`Campaign ${status === 'PUBLISHED' ? 'published' : status.toLowerCase()}.`);
            setReload(n => n + 1);
        } catch (failure) { setActionError(extractApiErrorMessage(failure, 'The campaign could not be changed.')); }
        finally { setBusy(false); }
    };
    const openUpdates = async (campaign: Campaign) => {
        if (busy) return;
        setBusy(true); setPendingLabel('Loading updates…'); setError(''); setActionError(''); setMessage('');
        try { const latest = await fetchManagedCampaign(clubId, campaign.id); if (active.current) replace(latest); setUpdates(latest); setFormError(''); }
        catch (failure) { setActionError(extractApiErrorMessage(failure, 'Updates could not load.')); }
        finally { setBusy(false); setPendingLabel(''); }
    };
    const locked = busy || !!editing || !!updates;
    const available = (items ?? []).filter(campaign => showArchived || campaign.status !== 'ARCHIVED');
    const visible = available.filter(campaign => (filter === 'ALL' || campaign.status === filter) && `${campaign.title} ${campaign.category}`.toLowerCase().includes(query.toLowerCase()));
    const create = () => { setEditing('new'); setFormError(''); };

    let body;
    if (!items) body = error ? null : <div className="gk-panel cm-list" role="status" aria-label="Loading campaigns"><div className="cm-skeletons">{[0, 1].map(i => <Skeleton key={i} height={72} />)}</div></div>;
    else if (!visible.length) body = <div className="gk-panel cm-list">{items.length
        ? <EmptyNote title="No campaigns match these filters" action={<Button size="sm" onClick={() => { setQuery(''); setFilter('ALL'); }}>Clear filters</Button>}>Try another status or search.</EmptyNote>
        : <EmptyNote title="No campaigns yet">Explain the project, who benefits and how supporters can help. A new campaign starts as a draft.</EmptyNote>}</div>;
    else body = <div className="gk-panel cm-list"><ul className="gk-list" aria-label="Campaigns">{visible.map(campaign => {
        const archived = campaign.status === 'ARCHIVED', phase = campaignPhase(archived ? 'ARCHIVED' : campaign.phase || campaign.status);
        return <li key={campaign.id}><div className="gk-list-row cm-row cm-row--campaign">
            <span className="cm-thumb cm-thumb--wide" aria-hidden="true">{campaign.images?.[0] ? <MediaImage src={resolveMediaUrl(campaign.images[0])} alt="" /> : <HeartHandshake />}</span>
            <span className="gk-list-row__main">
                <h3 className="cm-row__title">{campaign.title}</h3>
                <span className="gk-list-row__meta">{[campaignCategory(campaign.category) ?? 'Campaign', campaign.endsOn ? `Until ${campaignDate(campaign.endsOn)}` : 'No end date'].join(' · ')}</span>
                <span className="cm-row__message cm-row__clamp">{campaign.summary || 'No summary yet.'}</span>
                <span className="cm-funding">
                    <span>{campaign.reportedAmount === null
                        ? <>{campaign.goalAmount ? <>Goal <strong className="gk-num">{campaignMoney(campaign.goalAmount, campaign.currency)}</strong> · </> : null}No funds reported yet</>
                        : <><strong className="gk-num">{campaignMoney(campaign.reportedAmount, campaign.currency)}</strong> {campaign.goalAmount ? `of ${campaignMoney(campaign.goalAmount, campaign.currency)} ` : ''}reported by the club</>}</span>
                    {campaign.goalAmount && campaign.reportedAmount !== null ? <span className="cm-progress" role="img" aria-label={`${Math.round(progress(campaign))}% of the goal reported`}><i style={{ width: `${progress(campaign)}%` }} /></span> : null}
                </span>
            </span>
            <span className="cm-row__trail">
                <Badge tone={phaseTone(phase)}>{phase}</Badge>
                {campaign.publishedAt && !archived && <Link className="cm-link" to={`/campaigns/${campaign.id}`}>View campaign</Link>}
                {!archived && <>
                    <Button size="sm" aria-label={`Edit ${campaign.title}`} disabled={locked} onClick={() => { setEditing(campaign); setFormError(''); setMessage(''); }}><Pencil aria-hidden="true" />Edit</Button>
                    <RowMenu name={campaign.title} disabled={locked}>
                        {['DRAFT', 'PAUSED'].includes(campaign.status) && <button type="button" className="cm-menu__item" disabled={locked} aria-label={`${campaign.status === 'DRAFT' ? 'Publish' : 'Resume'} ${campaign.title}`} onClick={() => void transition(campaign, 'PUBLISHED')}>{campaign.status === 'DRAFT' ? 'Publish campaign' : 'Resume campaign'}</button>}
                        {campaign.status === 'PUBLISHED' && <button type="button" className="cm-menu__item" disabled={locked} aria-label={`Pause ${campaign.title}`} onClick={() => void transition(campaign, 'PAUSED')}>Pause campaign</button>}
                        {campaign.publishedAt && <button type="button" className="cm-menu__item" disabled={locked} aria-label={`Updates for ${campaign.title}`} onClick={() => void openUpdates(campaign)}>Post an update</button>}
                        {['PUBLISHED', 'PAUSED'].includes(campaign.status) && <button type="button" className="cm-menu__item" disabled={locked} aria-label={`Close ${campaign.title}`} onClick={() => setConfirm({ campaign, status: 'CLOSED' })}>Close campaign</button>}
                        <button type="button" className="cm-menu__item cm-menu__item--danger" disabled={locked} aria-label={`Archive ${campaign.title}`} onClick={() => setConfirm({ campaign, status: 'ARCHIVED' })}><Archive aria-hidden="true" />Archive campaign</button>
                    </RowMenu>
                </>}
            </span>
        </div></li>;
    })}</ul></div>;

    const archiving = confirm?.status === 'ARCHIVED';
    return <>
        <PageFrame className="cw-page cm-page" hidden={!!editing || !!updates}>
            <PageHeader title="Campaigns" subtitle="Fundraising projects with a clear story, a goal and progress updates."
                actions={<><ButtonLink variant="ghost" to={`/clubs/${clubId}/campaigns?state=ALL`}>View public campaigns</ButtonLink>
                    <Button variant="primary" disabled={locked} onClick={create}><Plus aria-hidden="true" />Create campaign</Button></>} />
            <div className="gk-stack">
                <p className="gk-notice">Online contributions are not available yet. Amounts you report are shown as your club’s own figures.</p>
                {items && items.length > 0 && <div className="rec-toolbar">
                    <SearchInput className="rec-toolbar__search" aria-label="Search campaigns" placeholder="Search campaigns" value={query} onChange={event => setQuery(event.target.value)} />
                    <select className="gk-input" aria-label="Filter by status" value={filter} onChange={event => setFilter(event.target.value)}>
                        {FILTERS.map(([value, label]) => <option key={value} value={value}>{label} ({available.filter(campaign => value === 'ALL' || campaign.status === value).length})</option>)}</select>
                    <label className="cm-check"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Include archived</label>
                    <span className="rec-toolbar__count" role="status">{visible.length} {visible.length === 1 ? 'campaign' : 'campaigns'}</span>
                    <Button size="sm" variant="ghost" disabled={locked} onClick={() => { setActionError(''); setReload(n => n + 1); }}>Refresh</Button>
                </div>}
                {error && <div className="gk-notice gk-notice--danger"><span role="alert">{error}</span><Button size="sm" onClick={() => setReload(n => n + 1)}>Try again</Button></div>}
                {actionError && <p className="gk-notice gk-notice--danger" role="alert">{actionError}</p>}
                {busy && !editing && !updates && <p className="gk-notice" role="status">{pendingLabel || 'Saving your change…'}</p>}
                {message && <p className="gk-notice" role="status">{message}</p>}
                {body}
            </div>
        </PageFrame>
        <Dialog open={confirm !== null} role="alertdialog" size="sm" title={archiving ? 'Archive campaign?' : 'Close campaign?'} onClose={() => { if (!busy) setConfirm(null); }}
            description={confirm ? archiving ? `“${confirm.campaign.title}” and its updates will no longer be public.` : `“${confirm.campaign.title}” and its updates stay public, but the campaign cannot be resumed.` : undefined}
            footer={<><Button variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Keep campaign</Button>
                <Button variant="danger" disabled={busy} onClick={() => confirm && void transition(confirm.campaign, confirm.status)}>{archiving ? 'Confirm archive' : 'Confirm close'}</Button></>} />
        {editing && <CampaignForm key={editing === 'new' ? 'new' : editing.id} campaign={editing === 'new' ? null : editing} saving={busy} error={formError}
            onCancel={() => { clearForm(); setEditing(null); }}
            onSubmit={async input => {
                if (busy) return;
                setBusy(true); setFormError(''); setMessage('');
                try {
                    const saved = editing === 'new' ? await createCampaign(clubId, input) : await editCampaign(clubId, editing.id, input);
                    if (active.current) { if (editing === 'new') setItems(current => [saved, ...(current ?? [])]); else replace(saved); }
                    clearForm(); setEditing(null); setMessage('Campaign saved.'); setReload(n => n + 1);
                } catch (failure) { setFormError(extractApiErrorMessage(failure, 'Could not save the campaign.')); }
                finally { setBusy(false); }
            }} />}
        {updates && <CampaignUpdates key={updates.id} campaign={updates} saving={busy} error={formError}
            onCancel={() => { clearForm(); setUpdates(null); }}
            onSubmit={async (title, text) => {
                if (busy) return;
                setBusy(true); setFormError(''); setMessage('');
                try {
                    const saved = await postCampaignUpdate(clubId, updates, title, text);
                    if (active.current) replace(saved);
                    clearForm(); setUpdates(null); setMessage('Campaign update published.'); setReload(n => n + 1);
                } catch (failure) { setFormError(extractApiErrorMessage(failure, 'The update could not be published.')); }
                finally { setBusy(false); }
            }} />}
    </>;
}

export const ClubCampaignsPage = ({ clubId }: { clubId: number }) => <CommerceDraftScope clubId={clubId} feature="CampaignsTab"><ClubCampaigns clubId={clubId} /></CommerceDraftScope>;
