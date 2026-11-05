import { ct, useCommerceCopy } from '../features/store/copy';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ExternalLink, HeartHandshake, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { getOpportunityReturnTarget } from '../components/discovery/opportunityReturnContext';
import { MediaImage } from '../components/ui/MediaImage';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import { useAuth } from '../context/AuthContext';
import { CampaignHistory } from '../features/campaigns/CampaignHistory';
import { campaignCategory, campaignDate, campaignPhase, fetchCampaign, organizerName, organizerPath, isPersonal, safeGivingUrl, type Campaign } from '../features/campaigns/api';
import { Progress } from '../features/campaigns/FundraiserCard';
import { FundraiserProjectLink } from '../features/projects/FundraiserProjectLink';
import { clubFundraisingPath } from '../features/campaigns/query';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';
import '../features/campaigns/fundraisingManagement.css';

const share = async (campaign: Campaign) => {
    const url = `${window.location.origin}/campaigns/${campaign.id}`;
    try {
        if (navigator.share) { await navigator.share({ title: campaign.title, text: campaign.summary, url }); return; }
        await navigator.clipboard.writeText(url);
        toast.success(ct("Link copied"), { description: url });
    } catch { toast.error(ct("Could not share this link"), { description: url }); }
};

/**
 * The fundraiser itself, as GoFundMe shows one: the story on the left, the giving card with the bar, Donate and Share
 * beside it. On a phone the giving card follows the title, cover and organiser, before the story and updates.
 */
function Fundraiser({ campaign }: { campaign: Campaign }) {
    useCommerceCopy();
    const open = campaign.phase === 'ACTIVE';
    const personal = isPersonal(campaign), name = organizerName(campaign), profile = organizerPath(campaign);
    const outside = safeGivingUrl(campaign.donateUrl);
    const contact = personal ? `/messages?chatWith=${campaign.publisher?.userId}` : `/clubs/${campaign.clubId}?tab=contact`;
    const cover = campaign.images?.[0];
    return (
        <div className="gk-fund-page">
            <header className="gk-fund-story gk-fund-page__head">
                <h1>{campaign.title}</h1>
                {(!personal || cover) && <div className="gk-fund-cover">{cover ? <MediaImage src={resolveMediaUrl(cover)} alt="" /> : <HeartHandshake size={48} aria-hidden="true" />}</div>}
                <Link className="gk-fund-organiser" to={personal ? profile : clubFundraisingPath(campaign.clubId!)} style={{ borderTop: 0, paddingTop: 0 }}>
                    <Crest round={personal} src={personal ? undefined : campaign.clubLogoUrl} name={name} size={40} />
                    <span className="gk-fund-organiser__text"><small>{ct("Run by")}</small><strong>{name}</strong><small>{[campaign.city, campaignCategory(campaign.category), !open ? campaignPhase(campaign.phase) : null].filter(Boolean).join(' · ')}</small></span>
                    <ChevronRight size={16} aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--gk-text-3)' }} />
                </Link>
            </header>
            <article className="gk-fund-story gk-fund-page__body">
                <p className="gk-fund-story__text">{campaign.description || campaign.summary}</p>
                {campaign.useOfFunds && <section><h2>{ct("Where the money goes")}</h2><p className="gk-fund-story__text">{campaign.useOfFunds}</p></section>}
                <section><h2>Beneficiary</h2><p>{campaign.beneficiary}</p>{personal && <p>Personal appeal by the adult beneficiary. Identity and totals are self-reported; no club endorsement is implied.</p>}</section>
                <CampaignHistory campaign={campaign} />
                {campaign.updates.length > 0 && <section><h2>{ct("Updates")}</h2>{campaign.updates.map(update => <div key={update.id} className="gk-fund-update"><strong>{update.title}</strong><time dateTime={update.createdAt}>{campaignDate(update.createdAt)}</time><p>{update.body}</p></div>)}</section>}
            </article>
            <aside className="gk-fund-give" aria-label={ct("Give")}>
                <Progress campaign={campaign} large />
                {open && outside && <a className="gk-btn gk-btn--primary" href={outside} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />{ct("View external fundraising page")}</a>}
                {open ? <ButtonLink variant={outside ? 'secondary' : 'primary'} to={contact}>{ct("Ask the organizer how to give")}</ButtonLink> : <Button variant="primary" disabled>{campaignPhase(campaign.phase)}</Button>}
                <Button onClick={() => void share(campaign)}><Share2 aria-hidden="true" />{ct("Share")}</Button>
                {open && <p className="gk-fund-give__where">Giving is arranged outside GrassKickZ. An external link has not been checked for organizer, beneficiary or country eligibility. Ask the organizer about payment, receipts, problems and any refunds.</p>}
                {campaign.reportedAmount != null && <p className="gk-fund-give__note">{campaign.reportedAt ? ct("The amount raised is reported by {v0} (last on {v1}) and is not checked by GrassKickZ.", { v0: name, v1: campaignDate(campaign.reportedAt) }) : ct("The amount raised is reported by {v0} and is not checked by GrassKickZ.", { v0: name })}</p>}
                <Link className="gk-fund-organiser" to={profile}>
                    <Crest round={personal} src={personal ? undefined : campaign.clubLogoUrl} name={name} size={36} />
                    <span className="gk-fund-organiser__text"><small>{ct("Organiser")}</small><strong>{name}</strong><small>{campaign.beneficiary ? ct("For {v0}", { v0: campaign.beneficiary }) : ct("Club page")}</small></span>
                    <ChevronRight size={16} aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--gk-text-3)' }} />
                </Link>
            </aside>
        </div>
    );
}

export const FundraiserPage = () => {
    useCommerceCopy();
    const { id } = useParams();
    const location = useLocation();
    const { user } = useAuth();
    const campaignId = Number(id);
    const valid = Number.isSafeInteger(campaignId) && campaignId > 0;
    const campaign = useWorldData(valid ? `fundraiser:${campaignId}` : null, signal => fetchCampaign(campaignId, signal), ct("This fundraiser is unavailable or could not be loaded."));
    const back = getOpportunityReturnTarget('campaigns', location.state, campaign.data?.clubId ?? undefined);
    const data = campaign.data;
    return (
        <GkRoot className="gk-store gk-page" data-market="fundraising">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}>
                    <Link to="/campaigns">{ct("Fundraising")}</Link>
                    {data && <><span aria-hidden="true">/</span><Link to={organizerPath(data)}>{organizerName(data)}</Link><span aria-hidden="true">/</span><span>{data.title}</span></>}
                </nav>
                <div className="gk-store-club__actions" style={{ paddingTop: 12 }}>
                    <ButtonLink variant="ghost" size="sm" to={`${back.pathname}${back.search}`}><ArrowLeft aria-hidden="true" />{ct("Back to fundraisers")}</ButtonLink>
                    {data && !isPersonal(data) && <FundraiserProjectLink campaign={data} />}
                    {data && isPersonal(data) && data.publisher?.userId === user?.id && <ButtonLink to={`/campaigns?mine=${data.id}`}>Manage appeal</ButtonLink>}
                </div>
                {!valid || campaign.error ? <div className="gk-store-results__empty"><EmptyNote title={ct("This fundraiser is unavailable")} action={valid ? <Button size="sm" onClick={campaign.retry}>{ct("Retry")}</Button> : undefined}>{campaign.error || ct("The link does not point to a fundraiser.")}</EmptyNote></div>
                    : campaign.loading || !data ? <div className="gk-fund-page" aria-busy="true"><div className="gk-fund-story"><Skeleton height={34} width={420} /><Skeleton height={420} /></div><Skeleton height={260} /></div>
                    : <Fundraiser key={data.id} campaign={data} />}
            </PageFrame>
        </GkRoot>
    );
};
