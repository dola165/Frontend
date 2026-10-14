import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, HeartHandshake } from 'lucide-react';
import { toast } from 'sonner';
import { MediaImage } from '../components/ui/MediaImage';
import { Button, ButtonLink, EmptyNote, Field, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import { CAMPAIGN_CATEGORIES, campaignMoney, changeCampaignState, createCampaign, CURRENCIES } from '../features/campaigns/api';
import { fetchMyClubMembershipContext } from '../features/clubs/api';
import { canManageClubOperations } from '../features/clubs/domain';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import { extractApiErrorMessage } from '../utils/apiError';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';

interface Draft { category: string; goal: string; currency: string; title: string; summary: string; useOfFunds: string; image: string; donateUrl: string }
const DRAFT_KEY = 'gk.fundraiser.draft';
const empty: Draft = { category: '', goal: '', currency: 'GEL', title: '', summary: '', useOfFunds: '', image: '', donateUrl: '' };
const readDraft = (): Draft => { try { return { ...empty, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') }; } catch { return empty; } };
const GOALS = [1000, 3000, 5000, 10000, 25000];
/** A stock cover for each category, until the club adds its own photo (the sandbox draws pitch scenes). */
const stockCover = (category: string) => `/sandbox-media/photo/fundraiser-${category.toLowerCase() || 'other'}.svg`;
const isGoFundMe = (value: string) => /^https:\/\/(www\.)?gofundme\.com\/[^\s]+$/i.test(value.trim());

/**
 * Starting a fundraiser in three screens, as GoFundMe keeps it: what for and how much; the title and the story;
 * where donations go (the club's GoFundMe page). The club is the person's own; payments stay with GoFundMe.
 */
export const StartFundraiserPage = () => {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const step = Math.min(3, Math.max(1, Number(params.get('step')) || 1));
    const [draft, setDraft] = useState<Draft>(readDraft);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const membership = useWorldData('my-club', () => fetchMyClubMembershipContext());
    const club = membership.data;
    const clubId = club?.clubId ?? null;
    const allowed = !!clubId && canManageClubOperations(club?.myRole);
    const change = (patch: Partial<Draft>) => setDraft(current => { const next = { ...current, ...patch }; try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch { /* the draft lives in memory then */ } return next; });
    const go = (next: number) => setParams(current => { const copy = new URLSearchParams(current); if (next > 1) copy.set('step', String(next)); else copy.delete('step'); return copy; });
    const goalNumber = Number(draft.goal);
    const stepOneDone = !!draft.category && goalNumber > 0;
    const stepTwoDone = draft.title.trim().length >= 4 && draft.summary.trim().length >= 10;
    const cover = draft.image || (draft.category ? stockCover(draft.category) : '');
    const publish = async () => {
        if (!clubId || saving) return;
        setSaving(true); setError('');
        try {
            const created = await createCampaign(clubId, { title: draft.title.trim(), summary: draft.summary.trim(), description: draft.summary.trim(), beneficiary: club?.clubName ?? '', useOfFunds: draft.useOfFunds.trim(), category: draft.category, currency: draft.currency, goalAmount: goalNumber, reportedAmount: null, reportedNote: '', startsOn: null, endsOn: null, images: cover ? [cover] : [], donateUrl: isGoFundMe(draft.donateUrl) ? draft.donateUrl.trim() : null });
            const published = await changeCampaignState(clubId, created, 'PUBLISHED');
            try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
            toast.success('Your fundraiser is live', { description: published.title });
            navigate(`/campaigns/${published.id}`, { replace: true });
        } catch (failure) { setError(extractApiErrorMessage(failure, 'Could not publish. Your answers are still here.')); }
        finally { setSaving(false); }
    };
    const steps = <div className="gk-fund-start__steps" aria-label={`Step ${step} of 3`}>{[1, 2, 3].map(n => <span key={n} data-done={n <= step || undefined} />)}</div>;
    const body = membership.loading ? <><Skeleton height={34} width={320} /><Skeleton height={120} /></>
        : !clubId ? <EmptyNote title="You need a club to start a fundraiser" action={<><ButtonLink variant="primary" to="/world/clubs">Find a club</ButtonLink>{club?.canCreateClub && <ButtonLink to="/clubs/create">Create a club</ButtonLink>}</>}>A fundraiser is run by a club for its players and families. Personal fundraisers come later.</EmptyNote>
        : !allowed ? <EmptyNote title={`Only ${club?.clubName ?? 'the club'}’s staff can start a fundraiser`} action={<ButtonLink to={`/clubs/${clubId}`}>Club page</ButtonLink>}>Ask a coach, an admin or the owner to start it.</EmptyNote>
        : step === 1 ? <>
            {steps}
            <div><h1>What are you raising money for?</h1><p className="gk-fund-start__lead">Pick the closest match. Supporters find fundraisers by it.</p></div>
            <div className="gk-fund-start__club"><Crest src={undefined} name={club?.clubName ?? 'Club'} size={40} /><div><strong>{club?.clubName}</strong><small>Runs this fundraiser · donations go to the club</small></div></div>
            <div className="gk-fund-start__tiles" role="group" aria-label="Category">
                {CAMPAIGN_CATEGORIES.map(category => <button key={category.value} type="button" className="gk-fund-start__tile" aria-pressed={draft.category === category.value} onClick={() => change({ category: category.value })}><category.icon aria-hidden="true" /><strong>{category.label}</strong><small>{category.line}</small></button>)}
            </div>
            <Field label="How much do you need?" htmlFor="fund-goal" hint="You can raise more than the goal.">
                <div className="gk-fund-start__goal">
                    <input id="fund-goal" className="gk-input" type="number" inputMode="numeric" min="1" step="1" placeholder="5000" value={draft.goal} onChange={event => change({ goal: event.target.value })} />
                    <select className="gk-input" aria-label="Currency" value={draft.currency} onChange={event => change({ currency: event.target.value })}>{CURRENCIES.map(currency => <option key={currency}>{currency}</option>)}</select>
                </div>
            </Field>
            <div className="gk-fund-start__chips">{GOALS.map(goal => <button key={goal} type="button" className="gk-chip" aria-pressed={goalNumber === goal} onClick={() => change({ goal: String(goal) })}>{campaignMoney(goal, draft.currency)}</button>)}</div>
            <div className="gk-fund-start__foot"><ButtonLink variant="ghost" to="/campaigns"><ArrowLeft aria-hidden="true" />Fundraising</ButtonLink><Button variant="primary" disabled={!stepOneDone} onClick={() => go(2)}>Continue</Button></div>
        </>
        : step === 2 ? <>
            {steps}
            <div><h1>Tell supporters what it is</h1><p className="gk-fund-start__lead">A clear title and two or three sentences. You can add updates later.</p></div>
            <Field label="Title" htmlFor="fund-title"><input id="fund-title" className="gk-input" autoFocus maxLength={120} placeholder="For example: New floodlights for Pitch 3" value={draft.title} onChange={event => change({ title: event.target.value })} /></Field>
            <Field label="Your story" htmlFor="fund-summary" hint={`${draft.summary.length}/600`}><textarea id="fund-summary" className="gk-input" maxLength={600} placeholder="What you need, who it helps, and what changes when it is funded." value={draft.summary} onChange={event => change({ summary: event.target.value })} /></Field>
            <Field label="Where the money goes" htmlFor="fund-use" hint="Optional, in one line"><input id="fund-use" className="gk-input" maxLength={240} placeholder="For example: six LED masts and installation" value={draft.useOfFunds} onChange={event => change({ useOfFunds: event.target.value })} /></Field>
            <Field label="Cover photo" htmlFor="fund-image" hint="Optional: paste a link to a photo; without one we use a pitch picture for the category."><input id="fund-image" className="gk-input" type="url" placeholder="https://…" value={draft.image} onChange={event => change({ image: event.target.value })} /></Field>
            {cover && <div className="gk-fund-start__preview"><span className="gk-fund__pic"><MediaImage src={resolveMediaUrl(cover)} alt="" /></span><div><strong>{draft.title.trim() || 'Your title'}</strong><p className="gk-muted">{draft.summary.trim() || 'Your story shows here.'}</p></div></div>}
            <div className="gk-fund-start__foot"><Button variant="ghost" onClick={() => go(1)}><ArrowLeft aria-hidden="true" />Back</Button><Button variant="primary" disabled={!stepTwoDone} onClick={() => go(3)}>Continue</Button></div>
        </>
        : <>
            {steps}
            <div><h1>Where do donations go?</h1><p className="gk-fund-start__lead">GoFundMe takes the payments, receipts and refunds. Paste your fundraiser’s GoFundMe link and supporters are sent there from this page.</p></div>
            <Field label="GoFundMe link" htmlFor="fund-donate" hint={draft.donateUrl && !isGoFundMe(draft.donateUrl) ? 'That is not a gofundme.com link.' : 'Optional for now: without it, supporters are asked to contact the club.'}>
                <input id="fund-donate" className="gk-input" type="url" placeholder="https://www.gofundme.com/f/…" value={draft.donateUrl} onChange={event => change({ donateUrl: event.target.value })} />
            </Field>
            <p className="gk-muted">No GoFundMe page yet? <a className="gk-section__action" href="https://www.gofundme.com/create" target="_blank" rel="noopener noreferrer">Create one on gofundme.com<ExternalLink aria-hidden="true" size={12} style={{ marginLeft: 4, verticalAlign: '-1px' }} /></a> with the same title and goal, then paste the link here. You can add it later too.</p>
            <div className="gk-fund-start__club"><HeartHandshake aria-hidden="true" style={{ color: 'var(--gk-accent)' }} /><div><strong>{draft.title.trim()}</strong><small>{campaignMoney(goalNumber, draft.currency)} goal · {CAMPAIGN_CATEGORIES.find(c => c.value === draft.category)?.label} · run by {club?.clubName}</small></div></div>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
            <div className="gk-fund-start__foot"><Button variant="ghost" disabled={saving} onClick={() => go(2)}><ArrowLeft aria-hidden="true" />Back</Button><Button variant="primary" disabled={saving || !stepOneDone || !stepTwoDone || (!!draft.donateUrl && !isGoFundMe(draft.donateUrl))} onClick={() => void publish()}>{saving ? 'Publishing…' : 'Publish fundraiser'}</Button></div>
        </>;
    return (
        <GkRoot className="gk-store gk-page" data-market="fundraising">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label="Breadcrumb"><Link to="/campaigns">Fundraising</Link><span aria-hidden="true">/</span><span>Start a fundraiser</span></nav>
                <div className="gk-fund-start">{body}</div>
            </PageFrame>
        </GkRoot>
    );
};
