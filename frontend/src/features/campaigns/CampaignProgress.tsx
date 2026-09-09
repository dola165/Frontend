import { campaignMoney, type Campaign } from './api';
export const CampaignProgress = ({
    campaign,
    compact = false,
}: {
    campaign: Campaign;
    compact?: boolean;
}) => {
    const hasReport = campaign.reportedAmount !== null;
    const percent =
        campaign.goalAmount && hasReport
            ? Math.min(100, Math.max(0, Math.round((campaign.reportedAmount! / campaign.goalAmount) * 100)))
            : null;
    return (
        <div className="campaign-progress">
            {campaign.goalAmount !== null && (
                <p>
                    <strong>{campaignMoney(campaign.goalAmount, campaign.currency)}</strong> goal
                </p>
            )}
            {percent !== null && <progress max={100} value={percent} aria-label="Club-reported progress" />}
            <p className="store-hint">
                {hasReport
                    ? `${campaignMoney(campaign.reportedAmount!, campaign.currency)} reported by the club`
                    : 'No funds reported yet.'}
            </p>
            {!compact && (
                <p className="store-hint">
                    Club-reported funds are not verified by GrassKickZ. Online contributions through
                    GrassKickZ are not available yet.
                </p>
            )}
        </div>
    );
};
