import { useState } from 'react';
import { fetchCampaign, type Campaign } from '../campaigns/api';
import { PaymentPreview } from './PaymentPreview';
import { contributionMinorUnits } from './records';

export function CampaignPaymentPreview({ campaign }: { campaign: Campaign }) {
    const [amount, setAmount] = useState('25');
    const parsed = contributionMinorUnits(amount);
    return <div>
        <div className="payment-preview-amount"><label>Test contribution amount ({campaign.currency})<input inputMode="decimal" value={amount} maxLength={7} aria-invalid={parsed === null} aria-describedby="contribution-amount-help" onChange={event => setAmount(event.target.value)} /></label><p id="contribution-amount-help" className="store-hint">Enter 1–1,000 {campaign.currency}, with up to two decimal places.</p></div>
        <PaymentPreview disabled={parsed === null} payment={{ kind: 'contribution', sourceId: campaign.id, clubName: campaign.clubName,
            title: campaign.title, currency: campaign.currency, amount: parsed ?? 0, lines: [],
        }} validate={async () => {
            let latest: Campaign;
            try { latest = await fetchCampaign(campaign.id); }
            catch { throw new Error('This campaign could not be checked. Please try again.'); }
            if (latest.phase !== 'ACTIVE' || latest.status !== 'PUBLISHED') throw new Error('This campaign is no longer accepting support. Refresh the page for its latest status.');
            if (latest.currency !== campaign.currency || latest.clubId !== campaign.clubId || latest.title !== campaign.title) throw new Error('Campaign details changed. Refresh the page before trying a contribution.');
        }} />
    </div>;
}
