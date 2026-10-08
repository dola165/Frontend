import { CommerceDraftScope, CommerceDraftNotice } from '../CommerceDraftScope';
import { useCommerceDraftState, useClearCommerceForm } from '../commerceDraftState';
import { MediaImage } from '../../ui/MediaImage';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, ImagePlus, Trash2 } from 'lucide-react';
import { EditorChecklist, EditorDiscardPrompt, EditorSection, WorkspaceEditor } from '../editor/WorkspaceEditor';
import { apiClient } from '../../../api/axiosConfig';
import {
    fetchManagedCampaigns,
    fetchManagedCampaign,
    createCampaign,
    editCampaign,
    changeCampaignState,
    postCampaignUpdate,
    CAMPAIGN_CATEGORIES,
    CURRENCIES,
    campaignPhase,
    campaignDate,
    campaignMoney,
    type Campaign,
    type CampaignInput,
    type CampaignState,
} from '../../../features/campaigns/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import '../../../features/store/store.css';
import '../../../features/campaigns/campaigns.css';
const button = 'store-cart-link';
const CampaignsTabContent = ({ clubId }: { clubId: number }) => {
    const clearForm = useClearCommerceForm();
    const [actionError, setActionError] = useCommerceDraftState('actionError', '');
    const [items, setItems] = useState<Campaign[] | null>(null),
        [error, setError] = useState(''),
        [message, setMessage] = useCommerceDraftState("message", ''),
        [reload, setReload] = useCommerceDraftState("reload", 0);
    const [editing, setEditing] = useCommerceDraftState<Campaign | 'new' | null>("editing", null),
        [updates, setUpdates] = useCommerceDraftState<Campaign | null>("updates", null),
        [busy, setBusy] = useCommerceDraftState("busy", false),
        [formError, setFormError] = useCommerceDraftState("formError", '');
    const [confirm, setConfirm] = useState<{ campaign: Campaign; status: CampaignState } | null>(null),
        [showArchived, setShowArchived] = useState(false);
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
        };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        let current = true;
        setError('');
        void fetchManagedCampaigns(clubId, controller.signal)
            .then((data) => {
                if (current) setItems(data);
            })
            .catch((e) => {
                if (current) setError(extractApiErrorMessage(e, 'Campaigns could not load.'));
            });
        return () => {
            current = false;
            controller.abort();
        };
    }, [clubId, reload]);
    const replace = (campaign: Campaign) =>
        setItems((current) =>
            current ? current.map((c) => (c.id === campaign.id ? campaign : c)) : [campaign],
        );
    const transition = async (campaign: Campaign, status: CampaignState) => {
        if (busy) return;
        setBusy(true);
        setActionError('');
        setError('');
        setMessage('');
        try {
            const result = await changeCampaignState(clubId, campaign, status);
            if (active.current) {
                replace(result);
                setConfirm(null);
            }
            setMessage(`Campaign ${status === 'PUBLISHED' ? 'published' : status.toLowerCase()}.`);
            setReload(n => n + 1);
        } catch (e) {
            setActionError(extractApiErrorMessage(e, 'The campaign could not be changed.'));
        } finally {
            setBusy(false);
        }
    };
    return (
        <section className="store-page campaigns-page campaign-workspace space-y-5">
            <header className="store-heading">
                <div>
                    <p className="store-eyebrow">Make your club's next chapter possible</p>
                    <h2 className="text-2xl font-bold">Club Campaigns</h2>
                    <p className="store-subtitle">
                        Create projects, explain their purpose and keep your community informed.
                    </p>
                </div>
                <Link className={button} to={`/clubs/${clubId}/campaigns?state=ALL`}>
                    View club campaigns
                </Link>
            </header>
            <p className="store-notice">
                <span className="store-notice-dot" />
                Online contributions are not available yet. Reported funds are shown as your club's own
                figures.
            </p>
            <div className="campaign-actions">
                <button
                    className="job-action"
                    disabled={busy || !!editing || !!updates}
                    onClick={() => {
                        setEditing('new');
                        setFormError('');
                    }}
                >
                    Create campaign
                </button>
                <button
                    className={button}
                    disabled={busy || !!editing || !!updates}
                    onClick={() => { setActionError(''); setReload((n) => n + 1); }}
                >
                    Refresh campaigns
                </button>
                <label className="store-hint">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                    />{' '}
                    Include archived
                </label>
            </div>
            {(error || actionError) && <p role="alert">{error || actionError}</p>}
            {message && <p role="status">{message}</p>}
            {!items ? (
                !error && <p role="status">Loading campaigns...</p>
            ) : (
                <div className="space-y-3">
                    {items.filter((c) => showArchived || c.status !== 'ARCHIVED').length === 0 && (
                        <p>No campaigns here yet. Start with a draft.</p>
                    )}
                    {items
                        .filter((c) => showArchived || c.status !== 'ARCHIVED')
                        .map((c) => (
                            <article key={c.id} className="campaign-management-row">
                                <div>
                                    <h3>{c.title}</h3>
                                    <span className="campaign-phase">{campaignPhase(c.phase)}</span>
                                    {c.publishedAt && c.status !== 'ARCHIVED' && (
                                        <Link className="ml-3 underline text-sm" to={`/campaigns/${c.id}`}>
                                            View campaign
                                        </Link>
                                    )}
                                </div>
                                {c.status !== 'ARCHIVED' && (
                                    <>
                                        <button
                                            className={button}
                                            disabled={busy || !!editing || !!updates}
                                            aria-label={`Edit ${c.title}`}
                                            onClick={() => {
                                                setEditing(c);
                                                setFormError('');
                                                setMessage('');
                                            }}
                                        >
                                            Edit
                                        </button>
                                        {['DRAFT', 'PAUSED'].includes(c.status) && (
                                            <button
                                                className={button}
                                                disabled={busy || !!editing || !!updates}
                                                onClick={() => void transition(c, 'PUBLISHED')} aria-label={`${c.status === 'DRAFT' ? 'Publish' : 'Resume'} ${c.title}`}>{c.status === 'DRAFT' ? 'Publish' : 'Resume'}</button>
                                        )}
                                        {c.status === 'PUBLISHED' && (
                                            <button
                                                className={button}
                                                disabled={busy || !!editing || !!updates}
                                                aria-label={`Pause ${c.title}`} onClick={() => void transition(c, 'PAUSED')}
                                            >
                                                Pause
                                            </button>
                                        )}
                                        {['PUBLISHED', 'PAUSED'].includes(c.status) && (
                                            <button
                                                className={button}
                                                disabled={busy || !!editing || !!updates}
                                                aria-label={`Close ${c.title}`} onClick={() => setConfirm({ campaign: c, status: 'CLOSED' })}
                                            >
                                                Close
                                            </button>
                                        )}
                                        {c.publishedAt && (
                                            <button
                                                className={button}
                                                disabled={busy || !!editing || !!updates}
                                                aria-label={`Updates for ${c.title}`}
                                                onClick={async () => {
                                                    setBusy(true);
                                                    setError('');
                                                    try {
                                                        const latest = await fetchManagedCampaign(
                                                            clubId,
                                                            c.id,
                                                        );
                                                        if (active.current) {
                                                            replace(latest);
                                                            setUpdates(latest);
                                                            setFormError('');
                                                        }
                                                    } catch (e) {
                                                        if (active.current)
                                                            setError(
                                                                extractApiErrorMessage(
                                                                    e,
                                                                    'Updates could not load.',
                                                                ),
                                                            );
                                                    } finally {
                                                        setBusy(false);
                                                    }
                                                }}
                                            >
                                                Updates
                                            </button>
                                        )}
                                        <button
                                            className={button}
                                            disabled={busy || !!editing || !!updates}
                                            aria-label={`Archive ${c.title}`} onClick={() => setConfirm({ campaign: c, status: 'ARCHIVED' })}
                                        >
                                            Archive
                                        </button>
                                    </>
                                )}
                            </article>
                        ))}
                </div>
            )}
            {confirm && (
                <div
                    className="campaign-confirmation"
                    role="group"
                    aria-label={`Confirm ${confirm.status.toLowerCase()}`}
                >
                    <p>
                        {confirm.status === 'ARCHIVED'
                            ? `Archive “${confirm.campaign.title}”? Its public page and updates will become unavailable.`
                            : `Close “${confirm.campaign.title}”? Its public page and updates will remain available, but the campaign cannot be resumed.`}
                    </p>
                    <div className="campaign-actions mt-3">
                        <button
                            className="job-action"
                            disabled={busy}
                            onClick={() => void transition(confirm.campaign, confirm.status)}
                        >
                            Confirm {confirm.status === 'ARCHIVED' ? 'archive' : 'close'}
                        </button>
                        <button className={button} disabled={busy} onClick={() => setConfirm(null)}>
                            Keep campaign
                        </button>
                    </div>
                </div>
            )}
            {editing && (
                <CampaignForm
                    key={editing === 'new' ? 'new' : editing.id}
                    campaign={editing === 'new' ? null : editing}
                    saving={busy}
                    error={formError}
                    onCancel={() => { clearForm(); setEditing(null); }}
                    onSubmit={async (input) => {
                        if (busy) return;
                        setBusy(true);
                        setFormError('');
                        setMessage('');
                        try {
                            const saved =
                                editing === 'new'
                                    ? await createCampaign(clubId, input)
                                    : await editCampaign(clubId, editing.id, input);
                            if (active.current) {
                                if (editing === 'new') setItems((current) => [saved, ...(current ?? [])]);
                                else replace(saved);
                            }
                            clearForm(); setEditing(null);
                            setMessage('Campaign saved.'); setReload(n => n + 1);
                        } catch (e) {
                            setFormError(extractApiErrorMessage(e, 'Could not save the campaign.'));
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            )}
            {updates && (
                <CampaignUpdateForm
                    key={updates.id}
                    campaign={updates}
                    saving={busy}
                    error={formError}
                    onCancel={() => { clearForm(); setUpdates(null); }}
                    onSubmit={async (title, body) => {
                        if (busy) return;
                        setBusy(true);
                        setFormError('');
                        setMessage('');
                        try {
                            const saved = await postCampaignUpdate(clubId, updates, title, body);
                            if (active.current) {
                                replace(saved);
                            }
                            clearForm(); setUpdates(null);
                            setMessage('Campaign update published.'); setReload(n => n + 1);
                        } catch (e) {
                            setFormError(extractApiErrorMessage(e, 'The update could not be published.'));
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            )}
        </section>
    );
};
export const CampaignForm = ({ campaign, saving, error, onCancel, onSubmit }: {
    campaign: Campaign | null;
    saving: boolean;
    error: string;
    onCancel: () => void;
    onSubmit: (input: CampaignInput) => Promise<void>;
}) => {
    const [title, setTitle] = useCommerceDraftState("form:title", campaign?.title ?? ''),
        [summary, setSummary] = useCommerceDraftState("form:summary", campaign?.summary ?? ''),
        [description, setDescription] = useCommerceDraftState("form:description", campaign?.description ?? ''),
        [beneficiary, setBeneficiary] = useCommerceDraftState("form:beneficiary", campaign?.beneficiary ?? ''),
        [useOfFunds, setUseOfFunds] = useCommerceDraftState("form:useOfFunds", campaign?.useOfFunds ?? '');
    const [category, setCategory] = useCommerceDraftState("form:category", campaign?.category ?? 'COMMUNITY'),
        [currency, setCurrency] = useCommerceDraftState("form:currency", campaign?.currency ?? 'GEL'),
        [goal, setGoal] = useCommerceDraftState("form:goal", campaign?.goalAmount?.toString() ?? ''),
        [reported, setReported] = useCommerceDraftState("form:reported", campaign?.reportedAmount?.toString() ?? ''),
        [note, setNote] = useCommerceDraftState("form:note", campaign?.reportedNote ?? '');
    const [start, setStart] = useCommerceDraftState("form:start", campaign?.startsOn ?? ''),
        [end, setEnd] = useCommerceDraftState("form:end", campaign?.endsOn ?? ''),
        [images, setImages] = useCommerceDraftState("form:images", campaign?.images ?? []),
        [uploading, setUploading] = useCommerceDraftState("form:uploading", false),
        [uploadError, setUploadError] = useCommerceDraftState("form:uploadError", ''),
        [discard, setDiscard] = useState(false);
    const draft = !campaign || campaign.status === 'DRAFT';
    return <WorkspaceEditor
        title={campaign ? 'Edit campaign' : 'New campaign draft'} eyebrow="Club campaigns / Campaign editor" accent="campaign" formLabel="Campaign editor"
        description="Tell your community what you want to make possible, who it will help and how their support will be used. Start with a title and build the story from there."
        backLabel="Back to campaigns" saving={saving} disabled={saving || uploading} saveLabel="Save campaign"
        footerNote={draft ? 'Your campaign stays a draft until you publish it from the campaign list.' : 'Saving updates this campaign. Its current publication status stays the same.'}
        onRequestClose={() => setDiscard(true)}
        onSubmit={event => {
            event.preventDefault();
            if (saving || uploading) return;
            void onSubmit({
                version: campaign?.version, title: title.trim(), summary, description, beneficiary, useOfFunds,
                category, currency, goalAmount: goal === '' ? null : Number(goal),
                reportedAmount: reported === '' ? null : Number(reported), reportedNote: note,
                startsOn: start || null, endsOn: end || null, images,
            });
        }}
        feedback={(error || uploading || uploadError) && <>{error && <p role="alert">{error} Your edits have been kept. If another manager changed this campaign, copy your edits before reopening its latest version.</p>}{uploading && <p role="status">Uploading photo...</p>}{uploadError && <p role="alert">{uploadError}</p>}</>}
        confirmation={discard && <EditorDiscardPrompt label="Discard campaign edits" disabled={saving || uploading} onKeepEditing={() => setDiscard(false)} onDiscard={onCancel}/>}
        preview={<>
            <section className="workspace-editor__preview" aria-label="Campaign preview">
                <div className="workspace-editor__preview-label"><span>Campaign preview</span><span>Unsaved</span></div>
                <div className="workspace-editor__preview-image workspace-editor__preview-image--landscape">{images[0] ? <MediaImage src={resolveMediaUrl(images[0])} alt="Campaign cover preview"/> : <><Flag size={32} strokeWidth={1.3} aria-hidden="true"/><span>Your campaign cover appears here</span></>}</div>
                <div className="workspace-editor__preview-body">
                    <span className="workspace-editor__badge">{CAMPAIGN_CATEGORIES.find(c => c.value === category)?.label ?? 'Community projects'}</span>
                    <h4>{title.trim() || 'Your next club project'}</h4>
                    <p className="workspace-editor__preview-description">{summary.trim() || 'A short, clear summary helps people understand why this project matters.'}</p>
                    {beneficiary.trim() && <p>For: {beneficiary}</p>}
                    {goal && Number(goal) > 0 ? <p className="workspace-editor__preview-price">{campaignMoney(Number(goal), currency)} goal</p> : <p>No funding target set</p>}
                    {(start || end) && <p>{start ? `Starts ${campaignDate(start)}` : 'No start date'}{end ? ` · Ends ${campaignDate(end)}` : ''}</p>}
                </div>
                <p className="workspace-editor__preview-footnote">{draft ? 'Draft — only visible to your club managers.' : `Current status: ${campaignPhase(campaign.phase)}. Changes appear after saving.`}</p>
            </section>
            <EditorChecklist items={[
                { label: 'A campaign title', complete: !!title.trim() },
                { label: 'A short summary', complete: !!summary.trim() },
                { label: 'The purpose of the campaign', complete: !!description.trim() },
                { label: 'Who will benefit', complete: !!beneficiary.trim() },
                ...(goal ? [{ label: 'How the funding goal will be used', complete: !!useOfFunds.trim() }] : []),
            ]}>Save a draft after adding a title. Complete these details before publishing. Photos help tell the story but are optional.</EditorChecklist>
        </>}
    >
        <EditorSection number="01" title="Tell the story" description="Make the purpose easy to understand at a glance, then explain why it matters.">
            <label className="workspace-editor__field"><span>Campaign title<span className="workspace-editor__required" aria-hidden="true">*</span></span><input autoFocus aria-label="Campaign title" required maxLength={120} placeholder="For example: A new pitch for our youth teams" value={title} onChange={e => setTitle(e.target.value)}/></label>
            <label className="workspace-editor__field"><span>Short summary<span className="workspace-editor__count" aria-hidden="true">{summary.length}/240</span></span><textarea aria-label="Short summary" rows={2} maxLength={240} placeholder="Explain the project in one or two sentences." value={summary} onChange={e => setSummary(e.target.value)}/></label>
            <label className="workspace-editor__field"><span>Campaign purpose<span className="workspace-editor__count" aria-hidden="true">{description.length}/5000</span></span><textarea aria-label="Campaign purpose" rows={6} maxLength={5000} placeholder="What will change for your club or community? Explain the need, your plan and the difference it will make." value={description} onChange={e => setDescription(e.target.value)}/></label>
            <label className="workspace-editor__field">Who benefits<input maxLength={240} value={beneficiary} onChange={e => setBeneficiary(e.target.value)} placeholder="For example: the club's U14 girls team"/></label>
            <label className="workspace-editor__field">Category<select value={category} onChange={e => setCategory(e.target.value)}>{CAMPAIGN_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        </EditorSection>
        <EditorSection number="02" title="Funding & timing" description="Set a target if your project needs one, and give your community a clear plan.">
            <div className="workspace-editor__row">
                <label className="workspace-editor__field">Funding goal (optional)<input type="number" min="0.01" max="9999999999.99" step="0.01" placeholder="No target" value={goal} onChange={e => setGoal(e.target.value)}/></label>
                <label className="workspace-editor__field">Currency<select value={currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></label>
            </div>
            <label className="workspace-editor__field">How funds will be used<textarea rows={4} maxLength={2000} placeholder="For example: kit for 24 players, training equipment and tournament travel." value={useOfFunds} onChange={e => setUseOfFunds(e.target.value)}/></label>
            <p className="workspace-editor__hint">A funding goal needs an explanation of how it will be used before the campaign can be published.</p>
            <div className="workspace-editor__row">
                <label className="workspace-editor__field">Start date (optional)<input type="date" value={start} onChange={e => setStart(e.target.value)}/></label>
                <label className="workspace-editor__field">End date (optional)<input type="date" min={start || undefined} value={end} onChange={e => setEnd(e.target.value)}/></label>
            </div>
        </EditorSection>
        <EditorSection number="03" title="Campaign photos" description="Show the people, place or project behind your campaign. The first image becomes the cover.">
            {images.length > 0 && <div className="workspace-editor__photos">{images.map((url, index) => <div key={index} className="workspace-editor__photo"><MediaImage src={resolveMediaUrl(url)} alt={`Campaign photo ${index + 1}`}/><div><span>{index === 0 ? 'Cover photo' : `Photo ${index + 1}`}</span><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => setImages(current => current.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true"/></button></div></div>)}</div>}
            {images.length < 8 && <div className="workspace-editor__upload"><ImagePlus size={22} aria-hidden="true"/><label className="workspace-editor__field">Add campaign photo (up to 8)<input type="file" accept="image/*" onChange={async event => {
                const element = event.currentTarget, file = element.files?.[0]; if (!file) return;
                setUploading(true); setUploadError('');
                try {
                    const data = new FormData(); data.append('file', file);
                    const response = await apiClient.post<{ url: string }>('/media/upload', data, { params: { context: 'campaign' } });
                    setImages(current => [...current, response.data.url]);
                } catch (e) { setUploadError(extractApiErrorMessage(e, 'Photo upload failed.')); }
                finally { setUploading(false); element.value = ''; }
            }}/></label><p className="workspace-editor__hint">Choose a photo that helps people understand your project. {images.length} of 8 photos added.</p></div>}
        </EditorSection>
        <EditorSection number="04" title="Funds already received" description="Optionally report genuine funds your club has received outside GrassKickZ.">
            <details className="workspace-editor__details" open={reported !== '' || undefined}>
                <summary>Report funds received outside GrassKickZ (optional)</summary>
                <div className="workspace-editor__details-body">
                    <p className="workspace-editor__hint">Only enter funds your club has actually received. These figures will be labelled as club-reported and unverified by GrassKickZ. Leave blank if you are not reporting an amount.</p>
                    <label className="workspace-editor__field">Club-reported amount<input type="number" min="0" max="9999999999.99" step="0.01" placeholder="0.00" value={reported} onChange={e => setReported(e.target.value)}/></label>
                    <label className="workspace-editor__field"><span>Explanation of reported funds{reported !== '' && <span className="workspace-editor__required" aria-hidden="true">*</span>}</span><textarea aria-label="Explanation of reported funds" required={reported !== ''} rows={3} maxLength={1000} placeholder="Where did the funds come from, and when were they received?" value={note} onChange={e => setNote(e.target.value)}/></label>
                </div>
            </details>
        </EditorSection>
    </WorkspaceEditor>;
};
function CampaignUpdateForm({
    campaign,
    saving,
    error,
    onCancel,
    onSubmit,
}: {
    campaign: Campaign;
    saving: boolean;
    error: string;
    onCancel: () => void;
    onSubmit: (title: string, body: string) => Promise<void>;
}) {
    const [title, setTitle] = useCommerceDraftState('form:updateTitle', ''),
        [body, setBody] = useCommerceDraftState('form:updateBody', ''),
        [discard, setDiscard] = useState(false);
    return (
        <section className="campaign-editor space-y-4">
            <h3 className="text-xl font-bold">Updates: {campaign.title}</h3>
            {campaign.updates.map((update) => (
                <article key={update.id} className="campaign-update">
                    <p className="store-hint">{campaignDate(update.createdAt)}</p>
                    <h4>{update.title}</h4>
                    <p className="store-description">{update.body}</p>
                </article>
            ))}
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!saving) void onSubmit(title.trim(), body.trim());
                }}
            >
                {error && <p role="alert">{error} Your update draft has been kept.</p>}
                <fieldset disabled={saving}>
                    <label className="store-field">
                        Update title
                        <input
                            required
                            maxLength={120}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </label>
                    <label className="store-field">
                        Update message
                        <textarea
                            required
                            rows={5}
                            maxLength={3000}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                        />
                    </label>
                </fieldset>
                <div className="campaign-actions">
                    <button className="job-action" disabled={saving}>
                        Publish update
                    </button>
                    <button
                        className={button}
                        type="button"
                        disabled={saving}
                        onClick={() => (title || body ? setDiscard(true) : onCancel())}
                    >
                        Close updates
                    </button>
                </div>
                {discard && (
                    <div className="campaign-confirmation">
                        <p>Discard this unsaved update?</p>
                        <button type="button" className={button} onClick={() => setDiscard(false)}>
                            Keep writing
                        </button>
                        <button type="button" className={button} disabled={saving} onClick={() => { if (!saving) onCancel(); }}>
                            Discard update
                        </button>
                    </div>
                )}
            </form>
        </section>
    );
}

export const CampaignsTab = (props: Parameters<typeof CampaignsTabContent>[0]) => <CommerceDraftScope clubId={props.clubId} feature="CampaignsTab"><CommerceDraftNotice/><CampaignsTabContent {...props}/></CommerceDraftScope>;
