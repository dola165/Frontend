import { useMatchCopy } from '../copy';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Field } from '../../../design/primitives';
import { ClubRefereeChoices } from '../ClubRefereeChoices';
import { label, post, type Match, type Referee } from '../api';
import { useAction, useLoad } from '../hooks';

/**
 * Invites a referee or assistant from the club's referees or the directory. The referee checks their
 * availability and accepts; fees are agreed directly (no online payment).
 */
export function RefereeInvite({ match: m, reload }: { match: Match; reload: () => void }) {
    const t = useMatchCopy();
    const [q, setQ] = useState(''), [volunteer, setVolunteer] = useState(false), [availableOnly, setAvailableOnly] = useState(false), [page, setPage] = useState(0);
    const { data, error: searchError, reload: retrySearch } = useLoad<{ items: Referee[]; total: number }>(
        `/referees?${new URLSearchParams({ q, page: String(page), ...(volunteer ? { volunteer: 'true' } : {}), ...(availableOnly ? { from: m.starts_at_iso, to: m.ends_at_iso } : {}) })}`);
    const [ref, setRef] = useState(''), [duty, setDuty] = useState('REFEREE'), [fee, setFee] = useState('0'), [currency, setCurrency] = useState('GEL');
    const { busy, run, feedback } = useAction(reload);
    const [clubReferee, setClubReferee] = useState<Referee | null>(null);
    const selected = clubReferee?.user_id === Number(ref) ? clubReferee : data?.items.find(item => item.user_id === Number(ref));
    const acceptsTerms = selected && (volunteer ? selected.accepts_volunteer : selected.accepts_paid);
    const blocked = !acceptsTerms || (Boolean(searchError) && !clubReferee);
    return (
        <details className="gk-match-disclosure gk-mx">
            <summary>{t("Invite a referee or assistant")}</summary>
            <div className="gk-mx">{feedback}</div>
            <form className="gk-match-form" onSubmit={event => {
                event.preventDefault();
                if (blocked) return;
                void run(() => post(`/match-exchange/${m.event_id}/referees`, { refereeId: Number(ref), duty, volunteer, fee: volunteer ? 0 : Number(fee), currency, revision: m.revision }), t("Invitation sent — awaiting referee acceptance"));
            }}>
                <ClubRefereeChoices squadId={m.referee_responsibility === 'OPPONENT' ? m.target_squad_id : m.squad_id} volunteer={volunteer} selectedId={Number(ref)}
                    onSelect={r => { setClubReferee(r); setRef(String(r.user_id)); setFee(String(r.fee)); setCurrency(r.currency); }} />
                <div className="gk-match-form__pair">
                    <Field label={t("Find a referee")} htmlFor="invite-search">
                        <input id="invite-search" className="gk-input" type="search" value={q} placeholder={t("Name or service area")} onChange={event => { setQ(event.target.value); setRef(''); setPage(0); }} />
                    </Field>
                    <Field label={t("Referee")} htmlFor="invite-referee">
                        <select id="invite-referee" className="gk-input" required value={ref} onChange={event => {
                            setRef(event.target.value);
                            const r = data?.items.find(item => item.user_id === Number(event.target.value));
                            if (r) { setFee(String(r.fee)); setCurrency(r.currency); }
                        }}>
                            <option value="">{t("Choose a referee")}</option>
                            {clubReferee && !data?.items.some(r => r.user_id === clubReferee.user_id) && <option value={clubReferee.user_id}>{clubReferee.full_name} · {t('Club referee')}</option>}
                            {data?.items.map(r => {
                                const fits = volunteer ? r.accepts_volunteer : r.accepts_paid;
                                return <option key={r.user_id} value={r.user_id} disabled={!fits}>{r.full_name} · {r.service_area}{fits ? '' : ` · ${t('Does not accept these terms')}`}</option>;
                            })}
                        </select>
                    </Field>
                </div>
                <label className="gk-match-check"><input type="checkbox" checked={availableOnly} onChange={event => { setAvailableOnly(event.target.checked); setRef(''); setPage(0); }} />{t("Only referees with availability covering this match")}</label>
                {searchError ? <p className="gk-notice gk-notice--danger" role="alert">{t(searchError)} <Button size="sm" onClick={retrySearch}>{t("Retry referee search")}</Button></p>
                    : !data ? <p className="gk-field__hint" role="status">{t("Loading referees…")}</p>
                        : !data.items.length ? <p className="gk-field__hint" role="status">{t("No referees match this search. Try another name or remove the availability filter. A referee can add availability before accepting your invitation.")}</p> : null}
                {data && data.total > 24 && <div className="gk-match-actions" aria-label={t("Referee search pages")}>
                    <Button size="sm" disabled={!page} onClick={() => { setPage(value => value - 1); setRef(''); }}>{t("Previous referees")}</Button>
                    <span className="gk-field__hint">{t('Page {page} of {pages}', { page: page + 1, pages: Math.ceil(data.total / 24) })}</span>
                    <Button size="sm" disabled={(page + 1) * 24 >= data.total} onClick={() => { setPage(value => value + 1); setRef(''); }}>{t("Next referees")}</Button>
                </div>}
                {selected && <Link className="gk-match-link" to={`/profile/${selected.user_id}`} target="_blank" rel="noopener noreferrer">{t("Review referee profile (opens a new tab)")}</Link>}
                <div className="gk-match-form__pair">
                    <Field label={t("Duty")} htmlFor="invite-duty">
                        <select id="invite-duty" className="gk-input" value={duty} onChange={event => setDuty(event.target.value)}>
                            {['REFEREE', 'ASSISTANT_1', 'ASSISTANT_2'].map(value => <option key={value} value={value}>{t(label(value))}</option>)}
                        </select>
                    </Field>
                    <label className="gk-match-check gk-match-check--field"><input type="checkbox" checked={volunteer} onChange={event => { setVolunteer(event.target.checked); setRef(''); setPage(0); }} />{t("Volunteer invitation")}</label>
                </div>
                {!volunteer && <div className="gk-match-form__pair">
                    <Field label={t("Offered fee")} htmlFor="invite-fee">
                        <input id="invite-fee" className="gk-input" required min={0} max={1000000} type="number" step="0.01" value={fee} onChange={event => setFee(event.target.value)} />
                    </Field>
                    <Field label={t("Currency")} htmlFor="invite-currency">
                        <select id="invite-currency" className="gk-input" value={currency} onChange={event => setCurrency(event.target.value)}>{['GEL', 'EUR', 'GBP', 'USD'].map(c => <option key={c}>{c}</option>)}</select>
                    </Field>
                </div>}
                <p className="gk-field__hint">{t('Fees are agreed directly; online payment is not active. The referee checks their availability before accepting.')}</p>
                <div className="gk-match-actions"><Button variant="primary" type="submit" disabled={busy || blocked}>{t("Send invitation")}</Button></div>
            </form>
        </details>
    );
}
