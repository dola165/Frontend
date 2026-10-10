import { Badge, ListRow } from '../../../design/primitives';
import { formats, type Referee } from '../../matchExchange/api';
import type { PersonSummary } from '../api';
import { useWorldCopy } from '../copy';
import { Crest } from '../Crest';
import { PersonRow } from '../rows';

export type PersonItem =
    | { kind: 'person'; person: PersonSummary }
    | { kind: 'referee'; referee: Referee };

/** A person, or a referee from the referee directory with their terms. */
export function PersonItemRow({ item }: { item: PersonItem }) {
    const t = useWorldCopy();
    if (item.kind === 'referee') {
        const r = item.referee;
        const terms = [r.accepts_paid && r.fee ? `${r.fee} ${r.currency}` : r.accepts_paid ? t('Paid') : null, r.accepts_volunteer ? t('Volunteer') : null].filter(Boolean).join(` ${t('or')} `);
        return (
            <ListRow to={`/referees/${r.user_id}`} lead={<Crest name={r.full_name} round size={40} />}
                title={r.full_name}
                meta={[r.qualifications, r.service_area && `${t('Covers {area}', { area: r.service_area })}${r.travel_km ? ` +${r.travel_km} km` : ''}`, r.formats && r.formats.split(',').map(code => t(formats[code.trim()] ?? code.trim())).join(', ')].filter(Boolean).join(' · ')}
                trail={<>{terms && <span className="gk-world-row-note">{terms}</span>}<Badge tone="info">{t('Referee')}</Badge></>} />
        );
    }
    return <PersonRow person={item.person} />;
}
