import { promptEmailConfirmation } from '../components/auth/emailConfirmationPrompt';
import { ct, useCommerceCopy } from '../features/store/copy';
import { CreateLink } from '../features/pages/create/CreateLink';
import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, HeartHandshake } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { MediaImage } from '../components/ui/MediaImage';
import { Button, ButtonLink, EmptyNote, Field, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import { CAMPAIGN_CATEGORIES, campaignMoney, changeCampaignState, createCampaign, CURRENCIES, editCampaign, fetchManagedCampaign, type Campaign, type CampaignInput } from '../features/campaigns/api';
import { stockCover } from '../features/campaigns/stockCovers';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { isLeadershipRole } from '../features/clubs/domain';
import { PhotoField } from '../features/clubWorkspace/commerce/PhotoField';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import { extractApiErrorMessage } from '../utils/apiError';
import { assertCurrentAuthSession, getAuthSessionId, isCurrentAuthSession } from '../utils/authStorage';
import { useOwnedDraft } from '../utils/ownedDraft';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';

interface Draft { category: string; goal: string; currency: string; title: string; summary: string; useOfFunds: string; image: string; images?: string[]; donateUrl: string; /** The club it is written for. */ clubId: number | null;
    saved?: { id: number; version: number; input: CampaignInput; reviewRequired?: boolean };
    /** Retain the exact request until its outcome is known, including across reloads. */ createAttempt?: { key: string; input: CampaignInput };
}
const empty: Draft = { category: '', goal: '', currency: 'GEL', title: '', summary: '', useOfFunds: '', image: '', donateUrl: '', clubId: null };
const GOALS = [1000, 3000, 5000, 10000, 25000];
const isGoFundMe = (value: string) => /^https:\/\/(www\.)?gofundme\.com\/[^\s]+$/i.test(value.trim());
/** Compare the creation fields after the backend's trim/null normalization, excluding receipt metadata. */
const creationDetails = (value: CampaignInput) => JSON.stringify({
    ...Object.fromEntries((['title', 'summary', 'description', 'beneficiary', 'useOfFunds', 'category', 'currency', 'reportedNote'] as const).map(field => [field, value[field]?.trim() ?? ''])),
    goalAmount: value.goalAmount ?? null, reportedAmount: value.reportedAmount ?? null,
    startsOn: value.startsOn || null, endsOn: value.endsOn || null, images: value.images ?? [],
});

/**
 * Starting a fundraiser in three screens, as GoFundMe keeps it: what for and how much; the title and the story;
 * where donations go (the club's GoFundMe page). The club is the person's own; payments stay with GoFundMe.
 */
export const StartFundraiserPage = () => {
    useCommerceCopy();
    const navigate = useNavigate();
    const { status, user } = useAuth();
    const [params, setParams] = useSearchParams();
    const step = Math.min(3, Math.max(1, Number(params.get('step')) || 1));
    // The draft is the signed-in person's, for the club they run it for; another account or club starts afresh.
    const owned = useOwnedDraft<Draft>('fundraiser', empty);
    const draft = owned.draft;
    const [saving, setSaving] = useState(false);
    const pending = useRef(false);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false), [uploadError, setUploadError] = useState('');
    const membership = useWorldData(status === 'authenticated' ? `my-club:${user?.id ?? ''}` : null, () => fetchMyClubMembershipContext());
    const club = membership.data;
    const clubId = club?.clubId ?? null;
    const otherClub = draft.clubId != null && !!club && draft.clubId !== clubId;
    const allowed = status === 'authenticated' && !membership.loading && !membership.error && !otherClub && !!clubId && isLeadershipRole(club?.myRole);
    const change = (patch: Partial<Draft>) => owned.change({ ...patch, ...(draft.clubId == null && allowed ? { clubId } : {}) });
    const go = (next: number) => setParams(current => { const copy = new URLSearchParams(current); if (next > 1) copy.set('step', String(next)); else copy.delete('step'); return copy; });
    const goalNumber = Number(draft.goal);
    const stepOneDone = CAMPAIGN_CATEGORIES.some(category => category.value === draft.category) && /^\d+(?:\.\d{1,2})?$/.test(draft.goal) && goalNumber > 0 && goalNumber <= 9999999999.99;
    const photos = draft.images ?? [];
    const stepTwoDone = draft.title.trim().length >= 4 && draft.title.trim().length <= 120 && draft.summary.trim().length >= 10 && draft.summary.trim().length <= 240 && !!draft.useOfFunds.trim() && !draft.image && !uploading && !uploadError;
    const cover = photos[0] ? resolveMediaUrl(photos[0]) : draft.category ? stockCover(draft.category) : undefined;
    const publish = async () => {
        if (!clubId || !allowed || pending.current || draft.saved?.reviewRequired || !stepOneDone || !stepTwoDone) return;
        pending.current = true;
        setSaving(true); setError('');
        const session = getAuthSessionId();
        const input: CampaignInput = { title: draft.title.trim(), summary: draft.summary.trim(), description: draft.summary.trim(), beneficiary: club?.clubName ?? '', useOfFunds: draft.useOfFunds.trim(), category: draft.category, currency: draft.currency, goalAmount: goalNumber, reportedAmount: null, reportedNote: '', startsOn: null, endsOn: null, images: photos, donateUrl: isGoFundMe(draft.donateUrl) ? draft.donateUrl.trim() : null };
        let creating = !draft.saved;
        const remember = (campaign: Campaign, savedInput: CampaignInput, reviewRequired = false) => owned.change({ clubId, saved: { id: campaign.id, version: campaign.version, input: savedInput, ...(reviewRequired ? { reviewRequired } : {}) }, createAttempt: undefined });
        const done = (campaign: Campaign) => { owned.clear(); toast.success(ct("Your fundraiser is live"), { description: campaign.title }); navigate(`/campaigns/${campaign.id}`, { replace: true }); };
        try {
            const attempt = draft.createAttempt ?? { key: crypto.randomUUID(), input };
            if (creating && !draft.createAttempt) owned.change({ clubId, createAttempt: attempt });
            let saved = draft.saved ? await fetchManagedCampaign(clubId, draft.saved.id) : await createCampaign(clubId, attempt.input, attempt.key);
            assertCurrentAuthSession(session);
            creating = false;
            const savedInput = draft.saved?.input ?? attempt.input;
            const changed = creationDetails(input) !== creationDetails(savedInput)
                || (input.donateUrl?.trim() || null) !== (savedInput.donateUrl?.trim() || null);
            if (!draft.saved) {
                // A replay returns the CURRENT record, which another manager may already have edited.
                // Real backend responses do not yet expose the optional prototype giving-link field.
                const diverged = creationDetails(saved) !== creationDetails(savedInput)
                    || ('donateUrl' in saved && (saved.donateUrl?.trim() || null) !== (savedInput.donateUrl?.trim() || null));
                if (diverged) { remember(saved, savedInput, true); return; }
                // Successful live replay completes immediately: a queued draft write would outlive clear().
                if (saved.status !== 'PUBLISHED' || changed) remember(saved, savedInput);
            }
            if (saved.status === 'PUBLISHED') {
                if (changed) { setError(ct("This fundraiser is already live. Open the saved fundraiser to review it; your new answers are still here.")); return; }
                done(saved); return;
            }
            if (saved.status !== 'DRAFT' || (draft.saved && saved.version !== draft.saved.version)) { setError(ct("This fundraiser changed elsewhere. Open the saved fundraiser to review it; your answers are still here.")); return; }
            if (changed) {
                saved = await editCampaign(clubId, saved.id, { ...input, version: saved.version });
                assertCurrentAuthSession(session);
                remember(saved, input);
            }
            const published = await changeCampaignState(clubId, saved, 'PUBLISHED');
            assertCurrentAuthSession(session);
            done(published);
        } catch (failure) {
            if (!isCurrentAuthSession(session)) return;
            // Validation rejection proves no draft was created; network/5xx uncertainty must reuse the same request.
            const code = (failure as { response?: { status?: number } })?.response?.status;
            if (creating && (code === 400 || code === 422)) owned.change({ createAttempt: undefined });
            if (!promptEmailConfirmation(failure)) setError(extractApiErrorMessage(failure, ct("Could not publish. Your answers and any saved draft are kept. Retry to check and publish the same fundraiser.")));
        }
        finally { pending.current = false; setSaving(false); }
    };
    const steps = <div className="gk-fund-start__steps" aria-label={ct("Step {v0} of 3", { v0: step })}>{[1, 2, 3].map(n => <span key={n} data-done={n <= step || undefined} />)}</div>;
    const body = status === 'bootstrapping' || membership.loading ? <><Skeleton height={34} width={320} /><Skeleton height={120} /></>
        : status !== 'authenticated' ? <EmptyNote title={ct("Sign in to start a fundraiser")} action={<ButtonLink to="/login?next=%2Fcampaigns%2Fnew">{ct("Sign in")}</ButtonLink>} />
        : membership.error ? <EmptyNote title={ct("Your club could not be checked")} action={<Button onClick={membership.retry}>{ct("Retry club check")}</Button>}>{ct("Your fundraiser answers and saved draft are kept.")}</EmptyNote>
        : otherClub ? <EmptyNote title={ct("This draft belongs to another club")} action={<Button onClick={membership.retry}>{ct("Retry club check")}</Button>}>{ct("Your answers are kept. Return with staff access to that club to continue.")}</EmptyNote>
        : !clubId ? <EmptyNote title={ct("You need a club to start a fundraiser")} action={<><ButtonLink variant="primary" to="/world/clubs">{ct("Find a club")}</ButtonLink><CreateLink kind="CLUB" from="fundraising">{ct("Start your club")}</CreateLink></>}>{ct("A fundraiser is run by a club for its players and families. Personal fundraisers come later.")}</EmptyNote>
        : !allowed ? <EmptyNote title={ct("Only {v0}’s staff can start a fundraiser", { v0: club?.clubName ?? 'the club' })} action={<ButtonLink to={`/clubs/${clubId}`}>{ct("Club page")}</ButtonLink>}>{ct("Ask a coach, an admin or the owner to start it.")}</EmptyNote>
        : step === 1 ? <>
            {steps}
            <div><h1>{ct("What are you raising money for?")}</h1><p className="gk-fund-start__lead">{ct("Pick the closest match. Supporters find fundraisers by it.")}</p></div>
            <div className="gk-fund-start__club"><Crest src={undefined} name={club?.clubName ?? ct("Club")} size={40} /><div><strong>{club?.clubName}</strong><small>{ct("Runs this fundraiser · donations go to the club")}</small></div></div>
            <div className="gk-fund-start__tiles" role="group" aria-label={ct("Category")}>
                {CAMPAIGN_CATEGORIES.map(category => <button key={category.value} type="button" className="gk-fund-start__tile" aria-pressed={draft.category === category.value} onClick={() => change({ category: category.value })}><category.icon aria-hidden="true" /><strong>{ct(category.label)}</strong><small>{ct(category.line)}</small></button>)}
            </div>
            <Field label={ct("How much do you need?")} htmlFor="fund-goal" hint={ct("You can raise more than the goal.")}>
                <div className="gk-fund-start__goal">
                    <input id="fund-goal" className="gk-input" type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" placeholder={ct("5000")} value={draft.goal} onChange={event => change({ goal: event.target.value })} />
                    <select className="gk-input" aria-label={ct("Currency")} value={draft.currency} onChange={event => change({ currency: event.target.value })}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select>
                </div>
            </Field>
            <div className="gk-fund-start__chips">{GOALS.map(goal => <button key={goal} type="button" className="gk-chip" aria-pressed={goalNumber === goal} onClick={() => change({ goal: String(goal) })}>{campaignMoney(goal, draft.currency)}</button>)}</div>
            <div className="gk-fund-start__foot"><ButtonLink variant="ghost" to="/campaigns"><ArrowLeft aria-hidden="true" />{ct("Fundraising")}</ButtonLink><Button variant="primary" disabled={!stepOneDone} onClick={() => go(2)}>{ct("Continue")}</Button></div>
        </>
        : step === 2 ? <>
            {steps}
            <div><h1>{ct("Tell supporters what it is")}</h1><p className="gk-fund-start__lead">{ct("A clear title and two or three sentences. You can add updates later.")}</p></div>
            <Field label={ct("Title")} htmlFor="fund-title"><input id="fund-title" className="gk-input" autoFocus maxLength={120} placeholder={ct("For example: New floodlights for Pitch 3")} value={draft.title} onChange={event => change({ title: event.target.value })} /></Field>
            <Field label={ct("Your story")} htmlFor="fund-summary" hint={`${draft.summary.length}/240`}><textarea id="fund-summary" className="gk-input" maxLength={240} placeholder={ct("What you need, who it helps, and what changes when it is funded.")} value={draft.summary} onChange={event => change({ summary: event.target.value })} /></Field>
            <Field label={ct("Where the money goes")} htmlFor="fund-use" hint={ct("Required when you set a goal")}><input id="fund-use" className="gk-input" required maxLength={2000} placeholder={ct("For example: six LED masts and installation")} value={draft.useOfFunds} onChange={event => change({ useOfFunds: event.target.value })} /></Field>
            {draft.image && <p className="gk-notice">{ct('Your old photo link is kept. Upload that photo or remove the link before continuing.')} <span>{draft.image}</span> <Button size="sm" onClick={() => change({ image: '' })}>{ct('Remove old photo link')}</Button></p>}
            <PhotoField noun="campaign" context="CAMPAIGN" images={photos} setImages={next => change({ images: typeof next === 'function' ? next(photos) : next, image: '' })} uploading={uploading} setUploading={setUploading} setUploadError={setUploadError} hint={ct('Upload your own photos. The first photo is the cover.')} />
            {uploading && <p role="status">{ct('Uploading photo…')}</p>}
            {uploadError && <p role="alert">{uploadError}</p>}
            {cover && <div className="gk-fund-start__preview"><span className="gk-fund__pic"><MediaImage src={cover} alt="" /></span><div><strong>{draft.title.trim() || ct("Your title")}</strong><p className="gk-muted">{draft.summary.trim() || ct("Your story shows here.")}</p></div></div>}
            <div className="gk-fund-start__foot"><Button variant="ghost" onClick={() => go(1)}><ArrowLeft aria-hidden="true" />{ct("Back")}</Button><Button variant="primary" disabled={!stepTwoDone} onClick={() => go(3)}>{ct("Continue")}</Button></div>
        </>
        : <>
            {steps}
            <div><h1>{ct("Where do donations go?")}</h1><p className="gk-fund-start__lead">{ct("GoFundMe takes the payments, receipts and refunds. Paste your fundraiser’s GoFundMe link and supporters are sent there from this page.")}</p></div>
            <Field label={ct("GoFundMe link")} htmlFor="fund-donate" hint={draft.donateUrl && !isGoFundMe(draft.donateUrl) ? ct("That is not a gofundme.com link.") : ct("Optional for now: without it, supporters are asked to contact the club.")}>
                <input id="fund-donate" className="gk-input" type="url" placeholder={ct("https://www.gofundme.com/f/…")} value={draft.donateUrl} onChange={event => change({ donateUrl: event.target.value })} />
            </Field>
            <p className="gk-muted">{ct("No GoFundMe page yet? ")}<a className="gk-section__action" href="https://www.gofundme.com/create" target="_blank" rel="noopener noreferrer">{ct("Create one on gofundme.com")}<ExternalLink aria-hidden="true" size={12} style={{ marginLeft: 4, verticalAlign: '-1px' }} /></a>{ct(" with the same title and goal, then paste the link here. You can add it later too.")}</p>
            <div className="gk-fund-start__club"><HeartHandshake aria-hidden="true" style={{ color: 'var(--gk-accent)' }} /><div><strong>{draft.title.trim()}</strong><small>{campaignMoney(goalNumber, draft.currency)}{ct(" goal · ")}{ct(CAMPAIGN_CATEGORIES.find(c => c.value === draft.category)?.label)}{ct(" · run by ")}{club?.clubName}</small></div></div>
            {draft.saved && <p className="gk-notice" role={draft.saved.reviewRequired ? 'alert' : 'status'}>{draft.saved.reviewRequired ? ct("This fundraiser changed elsewhere. Open the saved fundraiser to review it; your answers are still here.") : ct("Your fundraiser draft is saved. Retry checks the same fundraiser. ")} <Link className="gk-section__action" to={`/campaigns/${draft.saved.id}/manage/edit?club=${draft.clubId}`}>{ct("Open saved fundraiser")}</Link></p>}
            {!draft.saved && draft.createAttempt && <p className="gk-notice" role="status">{ct("Checking whether your draft was saved. Retry keeps the same request.")}</p>}
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <div className="gk-fund-start__foot"><Button variant="ghost" disabled={saving} onClick={() => go(2)}><ArrowLeft aria-hidden="true" />{ct("Back")}</Button><Button variant="primary" disabled={saving || draft.saved?.reviewRequired || !stepOneDone || !stepTwoDone || (!!draft.donateUrl && !isGoFundMe(draft.donateUrl))} onClick={() => void publish()}>{saving ? ct("Publishing…") : ct("Publish fundraiser")}</Button></div>
        </>;
    return (
        <GkRoot className="gk-store gk-page" data-market="fundraising">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}><Link to="/campaigns">{ct("Fundraising")}</Link><span aria-hidden="true">/</span><span>{ct("Start a fundraiser")}</span></nav>
                <div className="gk-fund-start">{body}</div>
            </PageFrame>
        </GkRoot>
    );
};
