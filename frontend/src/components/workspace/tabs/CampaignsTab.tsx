import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
    type Campaign,
    type CampaignInput,
    type CampaignState,
} from '../../../features/campaigns/api';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import '../../../features/store/store.css';
import '../../../features/campaigns/campaigns.css';
const button = 'store-cart-link';
export const CampaignsTab = ({ clubId }: { clubId: number }) => {
    const [items, setItems] = useState<Campaign[] | null>(null),
        [error, setError] = useState(''),
        [message, setMessage] = useState(''),
        [reload, setReload] = useState(0);
    const [editing, setEditing] = useState<Campaign | 'new' | null>(null),
        [updates, setUpdates] = useState<Campaign | null>(null),
        [busy, setBusy] = useState(false),
        [formError, setFormError] = useState('');
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
        setError('');
        setMessage('');
        try {
            const result = await changeCampaignState(clubId, campaign, status);
            if (active.current) {
                replace(result);
                setConfirm(null);
                setMessage(`Campaign ${status === 'PUBLISHED' ? 'published' : status.toLowerCase()}.`);
            }
        } catch (e) {
            if (active.current) setError(extractApiErrorMessage(e, 'The campaign could not be changed.'));
        } finally {
            if (active.current) setBusy(false);
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
                    onClick={() => setReload((n) => n + 1)}
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
            {error && <p role="alert">{error}</p>}
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
                                                        if (active.current) setBusy(false);
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
                    onCancel={() => setEditing(null)}
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
                                setEditing(null);
                                setMessage('Campaign saved.');
                            }
                        } catch (e) {
                            if (active.current)
                                setFormError(extractApiErrorMessage(e, 'Could not save the campaign.'));
                        } finally {
                            if (active.current) setBusy(false);
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
                    onCancel={() => setUpdates(null)}
                    onSubmit={async (title, body) => {
                        if (busy) return;
                        setBusy(true);
                        setFormError('');
                        setMessage('');
                        try {
                            const saved = await postCampaignUpdate(clubId, updates, title, body);
                            if (active.current) {
                                replace(saved);
                                setUpdates(null);
                                setMessage('Campaign update published.');
                            }
                        } catch (e) {
                            if (active.current)
                                setFormError(extractApiErrorMessage(e, 'The update could not be published.'));
                        } finally {
                            if (active.current) setBusy(false);
                        }
                    }}
                />
            )}
        </section>
    );
};
export const CampaignForm = ({
    campaign,
    saving,
    error,
    onCancel,
    onSubmit,
}: {
    campaign: Campaign | null;
    saving: boolean;
    error: string;
    onCancel: () => void;
    onSubmit: (input: CampaignInput) => Promise<void>;
}) => {
    const [title, setTitle] = useState(campaign?.title ?? ''),
        [summary, setSummary] = useState(campaign?.summary ?? ''),
        [description, setDescription] = useState(campaign?.description ?? ''),
        [beneficiary, setBeneficiary] = useState(campaign?.beneficiary ?? ''),
        [useOfFunds, setUseOfFunds] = useState(campaign?.useOfFunds ?? '');
    const [category, setCategory] = useState(campaign?.category ?? 'COMMUNITY'),
        [currency, setCurrency] = useState(campaign?.currency ?? 'GEL'),
        [goal, setGoal] = useState(campaign?.goalAmount?.toString() ?? ''),
        [reported, setReported] = useState(campaign?.reportedAmount?.toString() ?? ''),
        [note, setNote] = useState(campaign?.reportedNote ?? '');
    const [start, setStart] = useState(campaign?.startsOn ?? ''),
        [end, setEnd] = useState(campaign?.endsOn ?? ''),
        [images, setImages] = useState(campaign?.images ?? []),
        [uploading, setUploading] = useState(false),
        [uploadError, setUploadError] = useState(''),
        [discard, setDiscard] = useState(false);
    return (
        <form
            className="campaign-editor space-y-4"
            aria-label="Campaign editor"
            onSubmit={(e) => {
                e.preventDefault();
                if (saving || uploading) return;
                void onSubmit({
                    version: campaign?.version,
                    title: title.trim(),
                    summary,
                    description,
                    beneficiary,
                    useOfFunds,
                    category,
                    currency,
                    goalAmount: goal === '' ? null : Number(goal),
                    reportedAmount: reported === '' ? null : Number(reported),
                    reportedNote: note,
                    startsOn: start || null,
                    endsOn: end || null,
                    images,
                });
            }}
        >
            <h3 className="text-xl font-bold">{campaign ? 'Edit campaign' : 'New campaign draft'}</h3>
            <p className="store-hint">
                Save a draft at any time after adding a title. Before publishing, explain the purpose,
                beneficiary and how any funding goal will be used.
            </p>
            {error && (
                <p role="alert">
                    {error} Your edits have been kept. If another manager changed this campaign, copy your
                    edits before reopening its latest version.
                </p>
            )}
            <fieldset disabled={saving || uploading}>
                <label className="store-field">
                    Campaign title
                    <input
                        autoFocus
                        required
                        maxLength={120}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </label>
                <label className="store-field">
                    Short summary
                    <textarea
                        rows={2}
                        maxLength={240}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                    />
                </label>
                <label className="store-field">
                    Campaign purpose
                    <textarea
                        rows={5}
                        maxLength={5000}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </label>
                <label className="store-field">
                    Who benefits
                    <input
                        maxLength={240}
                        value={beneficiary}
                        onChange={(e) => setBeneficiary(e.target.value)}
                        placeholder="For example: the club's U14 girls team"
                    />
                </label>
                <div className="campaign-fields">
                    <label className="store-field">
                        Category
                        <select value={category} onChange={(e) => setCategory(e.target.value)}>
                            {CAMPAIGN_CATEGORIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="store-field">
                        Currency
                        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                            {CURRENCIES.map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </select>
                    </label>
                    <label className="store-field">
                        Funding goal (optional)
                        <input
                            type="number"
                            min="0.01"
                            max="9999999999.99"
                            step="0.01"
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                        />
                    </label>
                    <label className="store-field">
                        Start date (optional)
                        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                    </label>
                    <label className="store-field">
                        End date (optional)
                        <input
                            type="date"
                            min={start || undefined}
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                        />
                    </label>
                </div>
                <label className="store-field">
                    How funds will be used
                    <textarea
                        rows={3}
                        maxLength={2000}
                        value={useOfFunds}
                        onChange={(e) => setUseOfFunds(e.target.value)}
                    />
                </label>
                <details>
                    <summary className="font-bold cursor-pointer">
                        Report funds received outside GrassKickZ (optional)
                    </summary>
                    <p className="store-hint">
                        Only enter funds your club has actually received. These figures will be labelled as
                        club-reported and unverified by GrassKickZ. Leave blank if you are not reporting an
                        amount.
                    </p>
                    <label className="store-field mt-3">
                        Club-reported amount
                        <input
                            type="number"
                            min="0"
                            max="9999999999.99"
                            step="0.01"
                            value={reported}
                            onChange={(e) => setReported(e.target.value)}
                        />
                    </label>
                    <label className="store-field mt-3">
                        Explanation of reported funds
                        <textarea
                            required={reported !== ''}
                            rows={3}
                            maxLength={1000}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </label>
                </details>
                <div className="campaign-actions">
                    {images.map((url, index) => (
                        <div key={index}>
                            <img
                                className="h-24 w-36 object-cover rounded"
                                src={resolveMediaUrl(url)}
                                alt={`Campaign photo ${index + 1}`}
                            />
                            <button
                                className={button}
                                type="button"
                                onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                            >
                                Remove photo {index + 1}
                            </button>
                        </div>
                    ))}
                </div>
                {images.length < 8 && (
                    <label className="store-field">
                        Add campaign photo (up to 8)
                        <input
                            type="file"
                            accept="image/*"
                            onChange={async (event) => {
                                const element = event.currentTarget,
                                    file = element.files?.[0];
                                if (!file) return;
                                setUploading(true);
                                setUploadError('');
                                try {
                                    const data = new FormData();
                                    data.append('file', file);
                                    const response = await apiClient.post<{ url: string }>(
                                        '/media/upload',
                                        data,
                                        { params: { context: 'campaign' } },
                                    );
                                    setImages((current) => [...current, response.data.url]);
                                } catch (e) {
                                    setUploadError(extractApiErrorMessage(e, 'Photo upload failed.'));
                                } finally {
                                    setUploading(false);
                                    element.value = '';
                                }
                            }}
                        />
                    </label>
                )}
            </fieldset>
            {uploading && <p role="status">Uploading photo...</p>}
            {uploadError && <p role="alert">{uploadError}</p>}
            <div className="campaign-actions">
                <button className="job-action" disabled={saving || uploading}>
                    {saving ? 'Saving...' : 'Save campaign'}
                </button>
                <button
                    type="button"
                    className={button}
                    disabled={saving || uploading}
                    onClick={() => setDiscard(true)}
                >
                    Close editor
                </button>
            </div>
            {discard && (
                <div className="campaign-confirmation" role="group" aria-label="Discard campaign edits">
                    <p>Discard these unsaved edits?</p>
                    <div className="campaign-actions mt-3">
                        <button type="button" className={button} onClick={() => setDiscard(false)}>
                            Keep editing
                        </button>
                        <button type="button" className={button} onClick={onCancel}>
                            Discard edits
                        </button>
                    </div>
                </div>
            )}
        </form>
    );
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
    const [title, setTitle] = useState(''),
        [body, setBody] = useState(''),
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
                        <button type="button" className={button} onClick={onCancel}>
                            Discard update
                        </button>
                    </div>
                )}
            </form>
        </section>
    );
}
