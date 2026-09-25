import type { MapFilters } from './MapFilterSidebar';

export function TrainingPriceFields({ filters, onChange }: { filters: MapFilters; onChange: (filters: MapFilters) => void }) {
    const fields = filters.clubs;
    const set = (key: string, value: string) => onChange({ ...filters, clubs: { ...fields, [key]: value } });
    const invalid = fields.trainingMinPrice && fields.trainingMaxPrice && Number(fields.trainingMinPrice) > Number(fields.trainingMaxPrice);
    return <fieldset className="atlas-price-fields">
        <legend className="map-simple-label">Price</legend>
        <p>Club training fees</p>
        <div className="atlas-price-grid">
            <label>Currency<select aria-label="Training currency" value={fields.trainingCurrency || 'GEL'} onChange={e => set('trainingCurrency', e.target.value)} className="atlas-filter-select">{['GEL', 'EUR', 'USD', 'GBP'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Billing period<select aria-label="Training billing period" value={fields.trainingPeriod || 'MONTH'} onChange={e => set('trainingPeriod', e.target.value)} className="atlas-filter-select">{[['MONTH', 'Per month'], ['SESSION', 'Per session'], ['TERM', 'Per term'], ['YEAR', 'Per year'], ['ONE_OFF', 'One-off']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Minimum<input aria-label="Minimum training price" type="number" min="0" step="0.01" placeholder="From" value={fields.trainingMinPrice || ''} onChange={e => set('trainingMinPrice', e.target.value)} className="atlas-filter-select" /></label>
            <label>Maximum<input aria-label="Maximum training price" type="number" min="0" step="0.01" placeholder="To" value={fields.trainingMaxPrice || ''} onChange={e => set('trainingMaxPrice', e.target.value)} className="atlas-filter-select" /></label>
        </div>
        {invalid ? <p role="alert">Maximum must be at least the minimum.</p> : <p className="atlas-price-help">Matches a published programme. Free training counts as 0. Unlisted prices are excluded when a range is set.</p>}
    </fieldset>;
}
