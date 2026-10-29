import { ct, useCommerceCopy } from '../features/store/copy';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ExternalLink, HeartHandshake, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { getOpportunityReturnTarget } from '../components/discovery/opportunityReturnContext';
import { MediaImage } from '../components/ui/MediaImage';
import { Button, ButtonLink, EmptyNote, GkRoot, PageFrame, Skeleton } from '../design/primitives';
import { campaignCategory, campaignDate, campaignPhase, fetchCampaign, type Campaign } from '../features/campaigns/api';
import { Progress } from '../features/campaigns/FundraiserCard';
import { FundraiserProjectLink } from '../features/projects/FundraiserProjectLink';
import { clubFundraisingPath } from '../features/campaigns/query';
import { Crest } from '../features/world/Crest';
import { useWorldData } from '../features/world/useWorldData';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';

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
    const cover = campaign.images?.[0];
    return (
        <div className="gk-fund-page">
            <header className="gk-fund-story gk-fund-page__head">
                <h1>{campaign.title}</h1>
                <div className="gk-fund-cover">{cover ? <MediaImage src={resolveMediaUrl(cover)} alt="" /> : <HeartHandshake size={48} aria-hidden="true" />}</div>
                <Link className="gk-fund-organiser" to={clubFundraisingPath(campaign.clubId)} style={{ borderTop: 0, paddingTop: 0 }}>
                    <Crest src={campaign.clubLogoUrl} name={campaign.clubName} size={40} />
                    <span className="gk-fund-organiser__text"><small>{ct("Run by")}</small><strong>{campaign.clubName}</strong><small>{[campaign.city, campaignCategory(campaign.category), !open ? campaignPhase(campaign.phase) : null].filter(Boolean).join(' · ')}</small></span>
                    <ChevronRight size={16} aria-hidden="true" style={{ marginLeft: 'auto', color: 'var(--gk-text-3)' }} />
                </Link>
            </header>
            <article className="gk-fund-story gk-fund-page__body">
                <p className="gk-fund-story__text">{campaign.description || campaign.summary}</p>
                {campaign.useOfFunds && <section><h2>{ct("Where the money goes")}</h2><p className="gk-fund-story__text">{campaign.useOfFunds}</p></section>}
                {campaign.updates.length > 0 && <section><h2>{ct("Updates")}</h2>{campaign.updates.map(update => <div key={update.id} className="gk-fund-update"><strong>{update.title}</strong><time dateTime={update.createdAt}>{campaignDate(update.createdAt)}</time><p>{update.body}</p></div>)}</section>}
            </article>
            <aside className="gk-fund-give" aria-label={ct("Give")}>
                <Progress campaign={campaign} large />
                {open && campaign.donateUrl
                    ? <a className="gk-btn gk-btn--primary" href={campaign.donateUrl} target="_blank" rel="noopener noreferrer"><HeartHandshake aria-hidden="true" />{ct("Donate on GoFundMe")}<ExternalLink aria-hidden="true" size={14} /></a>
                    : open ? <ButtonLink variant="primary" to={`/clubs/${campaign.clubId}?tab=contact`}>{ct("Ask the club how to give")}</ButtonLink>
                    : <Button variant="primary" disabled>{campaignPhase(campaign.phase)}</Button>}
                <Button onClick={() => void share(campaign)}><Share2 aria-hidden="true" />{ct("Share")}</Button>
                {campaign.donateUrl && open && <p className="gk-fund-give__where"><img src="/brand/grasskickz-mark.svg" alt="" />{ct("Payments, receipts and refunds are handled by GoFundMe.")}</p>}
                {campaign.reportedAmount != null && <p className="gk-fund-give__note">{campaign.reportedAt ? ct("The amount raised is reported by {v0} (last on {v1}) and is not checked by GrassKickZ.", { v0: campaign.clubName, v1: campaignDate(campaign.reportedAt) }) : ct("The amount raised is reported by {v0} and is not checked by GrassKickZ.", { v0: campaign.clubName })}</p>}
                <Link className="gk-fund-organiser" to={`/clubs/${campaign.clubId}`}>
                    <Crest src={campaign.clubLogoUrl} name={campaign.clubName} size={36} />
                    <span className="gk-fund-organiser__text"><small>{ct("Organiser")}</small><strong>{campaign.clubName}</strong><small>{campaign.beneficiary ? ct("For {v0}", { v0: campaign.beneficiary }) : ct("Club page")}</small></span>
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
    const campaignId = Number(id);
    const valid = Number.isSafeInteger(campaignId) && campaignId > 0;
    const campaign = useWorldData(valid ? `fundraiser:${campaignId}` : null, signal => fetchCampaign(campaignId, signal), ct("This fundraiser is unavailable or could not be loaded."));
    const back = getOpportunityReturnTarget('campaigns', location.state, campaign.data?.clubId);
    const data = campaign.data;
    return (
        <GkRoot className="gk-store gk-page" data-market="fundraising">
            <PageFrame>
                <nav className="gk-store-crumbs" aria-label={ct("Breadcrumb")}>
                    <Link to="/campaigns">{ct("Fundraising")}</Link>
                    {data && <><span aria-hidden="true">/</span><Link to={clubFundraisingPath(data.clubId)}>{data.clubName}</Link><span aria-hidden="true">/</span><span>{data.title}</span></>}
                </nav>
                <div className="gk-store-club__actions" style={{ paddingTop: 12 }}>
                    <ButtonLink variant="ghost" size="sm" to={`${back.pathname}${back.search}`}><ArrowLeft aria-hidden="true" />{ct("Back to fundraisers")}</ButtonLink>
                    {data && <FundraiserProjectLink campaign={data} />}
                </div>
                {!valid || campaign.error ? <div className="gk-store-results__empty"><EmptyNote title={ct("This fundraiser is unavailable")} action={valid ? <Button size="sm" onClick={campaign.retry}>{ct("Retry")}</Button> : undefined}>{campaign.error || ct("The link does not point to a fundraiser.")}</EmptyNote></div>
                    : campaign.loading || !data ? <div className="gk-fund-page" aria-busy="true"><div className="gk-fund-story"><Skeleton height={34} width={420} /><Skeleton height={420} /></div><Skeleton height={260} /></div>
                    : <Fundraiser key={data.id} campaign={data} />}
            </PageFrame>
        </GkRoot>
    );
};
