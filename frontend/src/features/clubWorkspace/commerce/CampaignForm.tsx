import { ct, useCommerceCopy } from '../../store/copy';
import { useState } from 'react';
import { Flag } from 'lucide-react';
import { MediaImage } from '../../../components/ui/MediaImage';
import { useCommerceDraftState } from '../../../components/workspace/commerceDraftState';
import { Badge, Field } from '../../../design/primitives';
import { CAMPAIGN_CATEGORIES, CURRENCIES, campaignDate, campaignMoney, campaignPhase, type Campaign, type CampaignInput } from '../../campaigns/api';
import { resolveMediaUrl } from '../../../utils/resolveMediaUrl';
import { CommerceEditor, EditorChecklist, EditorDiscardPrompt, EditorPreview, EditorSection } from './CommerceEditor';
import { campaignCategory } from './labels';
import { PhotoField } from './PhotoField';

const initialValues = (campaign: Campaign | null) => [campaign?.title ?? '', campaign?.summary ?? '', campaign?.description ?? '', campaign?.beneficiary ?? '', campaign?.useOfFunds ?? '',
    campaign?.category ?? 'COMMUNITY', campaign?.currency ?? 'GEL', campaign?.goalAmount?.toString() ?? '', campaign?.reportedAmount?.toString() ?? '', campaign?.reportedNote ?? '',
    campaign?.startsOn ?? '', campaign?.endsOn ?? '', campaign?.images ?? []];

/** Writing or editing a campaign on one page: the story, the goal and timing, reported funds and photos. */
export const CampaignForm = ({ campaign, saving, error, onCancel, onSubmit, backLabel = ct("Back to campaigns") }: {
    campaign: Campaign | null; saving: boolean; error: string; onCancel: () => void; onSubmit: (input: CampaignInput) => Promise<void>; backLabel?: string;
}) => {
    useCommerceCopy();
    const [title, setTitle] = useCommerceDraftState('form:title', campaign?.title ?? '');
    const [summary, setSummary] = useCommerceDraftState('form:summary', campaign?.summary ?? '');
    const [description, setDescription] = useCommerceDraftState('form:description', campaign?.description ?? '');
    const [beneficiary, setBeneficiary] = useCommerceDraftState('form:beneficiary', campaign?.beneficiary ?? '');
    const [useOfFunds, setUseOfFunds] = useCommerceDraftState('form:useOfFunds', campaign?.useOfFunds ?? '');
    const [category, setCategory] = useCommerceDraftState('form:category', campaign?.category ?? 'COMMUNITY');
    const [currency, setCurrency] = useCommerceDraftState('form:currency', campaign?.currency ?? 'GEL');
    const [goal, setGoal] = useCommerceDraftState('form:goal', campaign?.goalAmount?.toString() ?? '');
    const [reported, setReported] = useCommerceDraftState('form:reported', campaign?.reportedAmount?.toString() ?? '');
    const [note, setNote] = useCommerceDraftState('form:note', campaign?.reportedNote ?? '');
    const [start, setStart] = useCommerceDraftState('form:start', campaign?.startsOn ?? '');
    const [end, setEnd] = useCommerceDraftState('form:end', campaign?.endsOn ?? '');
    const [images, setImages] = useCommerceDraftState('form:images', campaign?.images ?? []);
    const [uploading, setUploading] = useCommerceDraftState('form:uploading', false);
    const [uploadError, setUploadError] = useCommerceDraftState('form:uploadError', '');
    const [discard, setDiscard] = useState(false);
    const draft = !campaign || campaign.status === 'DRAFT';
    const dirty = JSON.stringify([title, summary, description, beneficiary, useOfFunds, category, currency, goal, reported, note, start, end, images]) !== JSON.stringify(initialValues(campaign));
    return <CommerceEditor title={campaign ? ct("Edit campaign") : ct("Create a campaign")} formLabel={ct("Campaign editor")} backLabel={backLabel} saveLabel={ct("Save campaign")}
        description={ct("Say what the project makes possible, who it helps and how support will be used. A title is enough to save a draft.")}
        saving={saving} disabled={saving || uploading}
        footerNote={draft ? ct("Your campaign stays a draft until you publish it from the campaign list.") : ct("Saving updates this campaign. Its publication status stays the same.")}
        onRequestClose={() => { if (dirty) setDiscard(true); else onCancel(); }}
        onSubmit={event => {
            event.preventDefault();
            if (saving || uploading) return;
            void onSubmit({
                version: campaign?.version, title: title.trim(), summary, description, beneficiary, useOfFunds, category, currency,
                goalAmount: goal === '' ? null : Number(goal), reportedAmount: reported === '' ? null : Number(reported), reportedNote: note,
                startsOn: start || null, endsOn: end || null, images,
            });
        }}
        feedback={(error || uploading || uploadError) && <>
            {error && <div className="gk-notice gk-notice--danger"><span className="cm-notice__text"><span role="alert">{error}</span><span>{ct("Your edits are kept. If another manager changed this campaign, copy your edits before reopening its latest version.")}</span></span></div>}
            {uploading && <p className="gk-notice" role="status">{ct("Uploading photo…")}</p>}
            {uploadError && <p className="gk-notice gk-notice--danger" role="alert">{uploadError}</p>}
        </>}
        confirmation={discard && <EditorDiscardPrompt label={ct("Discard campaign edits")} disabled={saving || uploading} onKeepEditing={() => setDiscard(false)} onDiscard={onCancel} />}
        preview={<>
            <EditorPreview label={ct("Campaign preview")} media={images[0] ? <MediaImage src={resolveMediaUrl(images[0])} alt="Campaign cover preview" /> : <span className="cm-preview__empty"><Flag aria-hidden="true" />{ct("No cover photo yet")}</span>}
                footnote={draft ? ct("Draft: only your club’s managers can see it.") : ct("Currently {v0}. Changes appear after you save.", { v0: campaignPhase(campaign.phase).toLowerCase() })}>
                <p className="cm-preview__tags"><Badge>{campaignCategory(category) ?? ct("Community projects")}</Badge></p>
                <h3>{title.trim() || ct("Your next club project")}</h3>
                <p className="cm-preview__text">{summary.trim() || ct("A short summary helps people see why this project matters.")}</p>
                {beneficiary.trim() && <p className="cm-hint">{ct("For ")}{beneficiary}</p>}
                <p className="cm-preview__price">{goal && Number(goal) > 0 ? ct("{v0} goal", { v0: campaignMoney(Number(goal), currency) }) : ct("No funding target")}</p>
                {(start || end) && <p className="cm-hint">{start ? ct("Starts {v0}", { v0: campaignDate(start) }) : ct("No start date")}{end ? ct(" · Ends {v0}", { v0: campaignDate(end) }) : ''}</p>}
            </EditorPreview>
            <EditorChecklist items={[
                { label: ct("A campaign title"), complete: !!title.trim() },
                { label: ct("A short summary"), complete: !!summary.trim() },
                { label: ct("The purpose of the campaign"), complete: !!description.trim() },
                { label: ct("Who will benefit"), complete: !!beneficiary.trim() },
                ...(goal ? [{ label: ct("How the funding goal will be used"), complete: !!useOfFunds.trim() }] : []),
            ]}>{ct("A title is enough to save a draft. Complete these before publishing.")}</EditorChecklist>
        </>}>
        <EditorSection title={ct("The story")} description={ct("Make the purpose clear at a glance, then explain why it matters.")}>
            <Field label={ct("Campaign title")} htmlFor="campaign-title"><input id="campaign-title" className="gk-input" autoFocus required maxLength={120} placeholder={ct("For example: A new pitch for our youth teams")} value={title} onChange={event => setTitle(event.target.value)} /></Field>
            <Field label={ct("Short summary")} htmlFor="campaign-summary" hint={`One or two sentences · ${summary.length}/240`}><textarea id="campaign-summary" className="gk-input" rows={2} maxLength={240} value={summary} onChange={event => setSummary(event.target.value)} /></Field>
            <Field label={ct("Campaign purpose")} htmlFor="campaign-purpose" hint={`The need, your plan and the difference it makes · ${description.length}/5000`}><textarea id="campaign-purpose" className="gk-input" rows={4} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} /></Field>
            <div className="cm-pair">
                <Field label={ct("Who benefits")} htmlFor="campaign-beneficiary"><input id="campaign-beneficiary" className="gk-input" maxLength={240} placeholder={ct("For example: our U14 girls team")} value={beneficiary} onChange={event => setBeneficiary(event.target.value)} /></Field>
                <Field label={ct("Category")} htmlFor="campaign-category"><select id="campaign-category" className="gk-input" value={category} onChange={event => setCategory(event.target.value)}>{CAMPAIGN_CATEGORIES.map(item => <option key={item.value} value={item.value}>{ct(item.label)}</option>)}</select></Field>
            </div>
        </EditorSection>
        <EditorSection title={ct("Goal and timing")} description={ct("Set a target only if the project needs one.")}>
            <div className="cm-pair">
                <Field label={ct("Funding goal")} htmlFor="campaign-goal" hint={ct("Optional. Leave empty for no target.")}><input id="campaign-goal" className="gk-input" type="number" min="0.01" max="9999999999.99" step="0.01" value={goal} onChange={event => setGoal(event.target.value)} /></Field>
                <Field label={ct("Currency")} htmlFor="campaign-currency"><select id="campaign-currency" className="gk-input" value={currency} onChange={event => setCurrency(event.target.value)}>{CURRENCIES.map(value => <option key={value}>{value}</option>)}</select></Field>
            </div>
            <Field label={ct("How funds will be used")} htmlFor="campaign-funds" hint={ct("Needed before a campaign with a goal can be published.")}><textarea id="campaign-funds" className="gk-input" rows={3} maxLength={2000} placeholder={ct("For example: kit for 24 players and tournament travel.")} value={useOfFunds} onChange={event => setUseOfFunds(event.target.value)} /></Field>
            <div className="cm-pair">
                <Field label={ct("Start date")} htmlFor="campaign-start" hint={ct("Optional")}><input id="campaign-start" className="gk-input" type="date" value={start} onChange={event => setStart(event.target.value)} /></Field>
                <Field label={ct("End date")} htmlFor="campaign-end" hint={ct("Optional")}><input id="campaign-end" className="gk-input" type="date" min={start || undefined} value={end} onChange={event => setEnd(event.target.value)} /></Field>
            </div>
            <details className="cm-disclosure" open={reported !== '' || undefined}>
                <summary>{ct("Report funds received outside GrassKickZ")}</summary>
                <div className="cm-disclosure__body">
                    <p className="cm-hint">{ct("Only enter funds your club has actually received. They are labelled as club-reported and are not verified by GrassKickZ.")}</p>
                    <Field label={ct("Club-reported amount")} htmlFor="campaign-reported"><input id="campaign-reported" className="gk-input" type="number" min="0" max="9999999999.99" step="0.01" placeholder={ct("0.00")} value={reported} onChange={event => setReported(event.target.value)} /></Field>
                    <Field label={ct("Explanation of reported funds")} htmlFor="campaign-note" hint={reported !== '' ? ct("Required when you report an amount.") : undefined}><textarea id="campaign-note" className="gk-input" required={reported !== ''} rows={3} maxLength={1000} placeholder={ct("Where the funds came from, and when they were received.")} value={note} onChange={event => setNote(event.target.value)} /></Field>
                </div>
            </details>
        </EditorSection>
        <EditorSection title={ct("Photos")} description={ct("Show the people, place or project. The first photo is the cover.")}>
            <PhotoField noun="campaign" context="campaign" images={images} setImages={setImages} uploading={uploading} setUploading={setUploading} setUploadError={setUploadError} hint={ct("Choose photos that help people understand the project.")} />
        </EditorSection>
    </CommerceEditor>;
};
