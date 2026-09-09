import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HeartHandshake, Building2 } from 'lucide-react';
import {
    fetchCampaign,
    campaignCategory,
    campaignDate,
    campaignPhase,
    type Campaign,
} from '../features/campaigns/api';
import { CampaignProgress } from '../features/campaigns/CampaignProgress';
import { resolveMediaUrl } from '../utils/resolveMediaUrl';
import '../features/store/store.css';
import '../features/campaigns/campaigns.css';
export const CampaignDetailPage = () => {
    const { id } = useParams();
    return <CampaignDetail key={id} id={Number(id)} />;
};
function CampaignDetail({ id }: { id: number }) {
    const [campaign, setCampaign] = useState<Campaign | null>(null),
        [error, setError] = useState(''),
        [loading, setLoading] = useState(true),
        [reload, setReload] = useState(0),
        [photo, setPhoto] = useState(0),
        [feedback, setFeedback] = useState(''),
        [showLink, setShowLink] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        // Reset stale content when synchronizing with another request.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        setError('');
        setCampaign(null);
        void fetchCampaign(id, controller.signal)
            .then((data) => {
                if (active) {
                    setCampaign(data);
                    setPhoto(0);
                }
            })
            .catch(() => {
                if (active) setError('This campaign is unavailable or could not be loaded.');
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [id, reload]);
    const link = `${window.location.origin}/campaigns/${id}`;
    return (
        <main className="store-page campaigns-page">
            <nav className="store-breadcrumb store-detail-top" aria-label="Breadcrumb">
                <Link to="/campaigns">All campaigns</Link>
                {campaign && (
                    <Link to={`/clubs/${campaign.clubId}/campaigns`}>{campaign.clubName} campaigns</Link>
                )}
            </nav>
            {loading ? (
                <p role="status">Loading campaign...</p>
            ) : error ? (
                <div className="store-empty" role="alert">
                    {error}
                    <button onClick={() => setReload((n) => n + 1)}>Retry</button>
                </div>
            ) : (
                campaign && (
                    <div className="campaign-detail-grid">
                        <article className="campaign-detail-body">
                            <header>
                                <p className="store-eyebrow">{campaignCategory(campaign.category)}</p>
                                <h1>{campaign.title}</h1>
                                <p className="store-subtitle">{campaign.summary}</p>
                                <span className="campaign-phase mt-4">{campaignPhase(campaign.phase)}</span>
                            </header>
                            <Link className="store-seller" to={`/clubs/${campaign.clubId}/campaigns`}>
                                <Building2 size={28} />
                                <span>
                                    <small>Organised by</small>
                                    <strong>{campaign.clubName}</strong>
                                </span>
                            </Link>
                            <div className="campaign-gallery">
                                <div className="store-main-photo">
                                    {campaign.images[photo] ? (
                                        <img
                                            src={resolveMediaUrl(campaign.images[photo])}
                                            alt={`${campaign.title} — photo ${photo + 1}`}
                                        />
                                    ) : (
                                        <HeartHandshake size={60} />
                                    )}
                                </div>
                                {campaign.images.length > 1 && (
                                    <div className="store-thumbnails">
                                        {campaign.images.map((url, index) => (
                                            <button
                                                key={index}
                                                aria-label={`View photo ${index + 1}`}
                                                aria-pressed={photo === index}
                                                onClick={() => setPhoto(index)}
                                            >
                                                <img src={resolveMediaUrl(url)} alt="" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <section>
                                <h2>What this campaign makes possible</h2>
                                <p className="store-description">{campaign.description}</p>
                            </section>
                            <section>
                                <h2>Who benefits</h2>
                                <p className="store-description">{campaign.beneficiary}</p>
                            </section>
                            {campaign.useOfFunds && (
                                <section>
                                    <h2>How funds will be used</h2>
                                    <p className="store-description">{campaign.useOfFunds}</p>
                                </section>
                            )}
                            <section>
                                <h2>Campaign updates</h2>
                                {campaign.updates.length ? (
                                    campaign.updates.map((update) => (
                                        <article key={update.id} className="campaign-update">
                                            <p className="store-hint">{campaignDate(update.createdAt)}</p>
                                            <h3>{update.title}</h3>
                                            <p className="store-description">{update.body}</p>
                                        </article>
                                    ))
                                ) : (
                                    <p className="store-subtitle">The club has not posted an update yet.</p>
                                )}
                            </section>
                        </article>
                        <aside className="campaign-support" aria-label="Support this campaign">
                            <div>
                                <h2>Support this campaign</h2>
                                <CampaignProgress campaign={campaign} />
                            </div>
                            {campaign.reportedAmount !== null && (
                                <div>
                                    <p className="store-hint">
                                        Club report
                                        {campaign.reportedAt ? ` · ${campaignDate(campaign.reportedAt)}` : ''}
                                    </p>
                                    <p className="store-description">{campaign.reportedNote}</p>
                                </div>
                            )}
                            {(campaign.startsOn || campaign.endsOn) && (
                                <p className="store-hint">
                                    {campaign.startsOn
                                        ? `Starts ${campaignDate(campaign.startsOn)}`
                                        : 'No fixed start date'}
                                    {campaign.endsOn
                                        ? ` · Ends ${campaignDate(campaign.endsOn)}`
                                        : ' · No fixed end date'}
                                </p>
                            )}
                            {campaign.phase !== 'ACTIVE' && (
                                <p className="store-subtitle">
                                    This campaign is {campaignPhase(campaign.phase).toLowerCase()}. Contact
                                    the club for its latest plans.
                                </p>
                            )}
                            <button className="job-action" disabled>
                                Online contributions unavailable
                            </button>
                            <Link className="store-cart-link" to={`/clubs/${campaign.clubId}?tab=contact`}>
                                Contact the club
                            </Link>
                            <p className="store-hint">
                                Mention “{campaign.title}” when asking how you can help.
                            </p>
                            <button
                                className="store-cart-link"
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(link);
                                        setFeedback('Campaign link copied.');
                                        setShowLink(false);
                                    } catch {
                                        setShowLink(true);
                                        setFeedback('Copy the link below to share this campaign.');
                                    }
                                }}
                            >
                                Copy campaign link
                            </button>
                            {showLink && (
                                <label className="store-field">
                                    Campaign link
                                    <input readOnly value={link} onFocus={(e) => e.target.select()} />
                                </label>
                            )}
                            {feedback && (
                                <p role="status" className="store-feedback">
                                    {feedback}
                                </p>
                            )}
                        </aside>
                    </div>
                )
            )}
        </main>
    );
}
