import { useMatchCopy } from '../copy';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, EmptyNote, Field, List, ListRow, Skeleton } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { post, type Match } from '../api';
import { useAction, useLoad } from '../hooks';

type OfficialRequest = { status: string; volunteer: boolean; fee: number; currency: string; applications?: { referee_id: number; full_name: string; status: string }[] };

/**
 * An open referee request: eligible referees offer to officiate and the arranging team selects one,
 * which confirms the appointment at the published terms. While a request is open its offers stay in view.
 */
export function RefereeRequest({ match: m, reload }: { match: Match; reload: () => void }) {
    const t = useMatchCopy();
    const { data, error, reload: refresh } = useLoad<OfficialRequest | null>(`/match-arrangements/${m.event_id}/official-request`);
    const [volunteer, setVolunteer] = useState(true), [fee, setFee] = useState('0'), [currency, setCurrency] = useState('GEL');
    const { run, busy, feedback } = useAction(() => { refresh(); reload(); });
    const occupied = m.appointments?.some(a => a.duty === 'REFEREE' && ['INVITED', 'ACCEPTED'].includes(a.status));
    const offers = data?.applications?.filter(a => ['PENDING', 'APPLIED'].includes(a.status)) ?? [];

    if (error) return <div className="gk-match-request"><EmptyNote title={t('The referee request could not load')} action={<Button size="sm" onClick={refresh}>{t('Try again')}</Button>}>{t(error)}</EmptyNote></div>;
    if (data === undefined) return <div className="gk-match-request" role="status" aria-label={t('Loading the referee request')}><Skeleton height={48} /></div>;

    if (data?.status === 'OPEN') return (
        <div className="gk-match-request">
            <div className="gk-match-request__head">
                <span><strong>{t("Open referee request")}</strong> <span className="gk-faint">· {data.volunteer ? t("Volunteer") : t('{fee} {currency}, agreed directly', { fee: data.fee, currency: data.currency })}</span></span>
                <Badge tone={offers.length ? 'warning' : 'info'}>{offers.length ? (offers.length === 1 ? t('1 offer to review') : t('{count} offers to review', { count: offers.length })) : t("Waiting for offers")}</Badge>
            </div>
            {offers.length ? <List label={t("Referee offers")}>{offers.map(offer => (
                <ListRow key={offer.referee_id} lead={<Crest name={offer.full_name} size={36} round />} title={<Link className="gk-match-link" to={`/profile/${offer.referee_id}`}>{offer.full_name}</Link>}
                    meta={t("Offered to referee on these terms")}
                    trail={<Button size="sm" variant="primary" disabled={busy} onClick={() => void run(() => post(`/match-arrangements/${m.event_id}/official-request/select`, { refereeId: offer.referee_id, revision: m.revision }), t("Referee appointed"))}>{t("Select and appoint")}</Button>} />
            ))}</List> : <EmptyNote title={t("No offers yet")}>{t("Referees who can make it offer here; you choose before anyone is appointed.")}</EmptyNote>}
            <div className="gk-match-actions"><Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => post(`/match-arrangements/${m.event_id}/official-request/close`, { revision: m.revision }), t("Request closed"))}>{t("Close request")}</Button></div>
            <div className="gk-mx">{feedback}</div>
        </div>
    );
    if (occupied) return null;
    return (
        <details className="gk-match-disclosure">
            <summary>{t("Publish an open referee request")}</summary>
            <form className="gk-match-form" onSubmit={event => { event.preventDefault(); void run(() => post(`/match-arrangements/${m.event_id}/official-request`, { volunteer, fee: volunteer ? 0 : Number(fee), currency, revision: m.revision }), t("Referee request published")); }}>
                <label className="gk-match-check"><input type="checkbox" checked={volunteer} onChange={event => setVolunteer(event.target.checked)} />{t("Volunteer appointment")}</label>
                {!volunteer && <div className="gk-match-form__pair">
                    <Field label={t('Fee')} htmlFor="request-fee"><input id="request-fee" className="gk-input" type="number" required min={0} max={1000000} value={fee} onChange={event => setFee(event.target.value)} /></Field>
                    <Field label={t("Currency")} htmlFor="request-currency"><input id="request-currency" className="gk-input" required maxLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} /></Field>
                </div>}
                <p className="gk-field__hint">{t("Referees can see the time and place and offer to officiate. Nobody is appointed until you select an offer.")}</p>
                <div className="gk-mx">{feedback}</div>
                <div className="gk-match-actions"><Button variant="primary" type="submit" disabled={busy}>{t("Publish request")}</Button></div>
            </form>
        </details>
    );
}
