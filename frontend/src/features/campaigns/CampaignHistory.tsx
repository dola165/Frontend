import { campaignDate, campaignMoney, campaignPhase, type Campaign } from './api';

export function CampaignHistory({ campaign }: { campaign: Campaign }) {
    if (!campaign.history?.length) return null;
    return <section className="gk-appeal-history"><h2>Progress and history</h2><ol>{campaign.history.map(h => <li key={h.version}>
        <p><time dateTime={h.recordedAt}>{campaignDate(h.recordedAt)}</time> · {campaignPhase(h.status)} · version {h.version}</p>
        <p>{h.reportedAmount === null ? 'No amount reported' : `${campaignMoney(h.reportedAmount, h.currency)} reported`}{h.goalAmount !== null ? ` · target ${campaignMoney(h.goalAmount, h.currency)}` : ''}</p>
        {h.reportedAt && <p>{h.attribution} · <time dateTime={h.reportedAt}>{campaignDate(h.reportedAt)}</time></p>}
        {h.reportedNote && <p>{h.reportedNote}</p>}
    </li>)}</ol></section>;
}
