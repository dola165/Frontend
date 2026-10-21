import { useTranslation } from 'react-i18next';
import './competition-capacity.css';

/** A capacity meter, not registration urgency. Unknown caps stay as honest counts. */
export function CompetitionCapacity({ count, capacity, name }: { count: number; capacity?: number | null; name: string }) {
  const { i18n } = useTranslation();
  const ka = i18n.language.startsWith('ka');
  const total = Number.isFinite(count) ? Math.max(0, count) : 0;
  const cap = capacity != null && Number.isFinite(capacity) && capacity > 0 ? capacity : null;
  const label = cap ? `${total} / ${cap} ${ka ? 'მონაწილე' : 'entries'}` : `${total} ${ka ? 'მონაწილე' : total === 1 ? 'entry' : 'entries'}`;
  return <span className="mc-capacity">
    <span className="mc-capacity-label">{label}</span>
    {cap && <span className="mc-capacity-track" role="meter" aria-label={`${name}: ${ka ? 'მონაწილეები' : 'entry capacity'}`} aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.min(total, cap)} aria-valuetext={label}>
      <span className="mc-capacity-fill" style={{ width: `${Math.min(total / cap, 1) * 100}%` }} />
    </span>}
  </span>;
}
