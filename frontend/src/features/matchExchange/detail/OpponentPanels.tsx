import { useMatchCopy } from '../copy';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Field, List, ListRow, Panel, Section, type BadgeTone } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { post, type Match, type Squad } from '../api';
import { useAction } from '../hooks';
import { answerInvitation } from './opponentActions';
import { ChoiceChips } from '../../../design/ChoiceChips';
import { useOfferDraft } from '../offerDraft';

const PROPOSAL: Record<string, { label: string; tone: BadgeTone }> = {
    PENDING: { label: 'Waiting for a decision', tone: 'warning' }, ACCEPTED: { label: 'Accepted', tone: 'accent' },
    DECLINED: { label: 'Declined', tone: 'neutral' }, WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

/** A club invited ours: choose the squad that accepts, or decline. Nothing is agreed until accepted. */
export function InvitationResponse({ match: m, squads, reload }: { match: Match; squads: Squad[]; reload: () => void }) {
    const t = useMatchCopy();
    const available = squads.filter(s => s.club_id === m.requested_club_id && (!m.requested_squad_id || s.id === m.requested_squad_id));
    const [chosen, setChosen] = useState<number | null>(m.requested_squad_id ?? (available.length === 1 ? available[0].id : null));
    const { run, busy, feedback } = useAction(reload);
    return (
        <Panel className="gk-match-callout" as="section">
            <div className="gk-match-callout__body">
                <h2 className="gk-match-callout__title">{t('{club} invited your club to play', { club: m.club_name })}</h2>
                <p className="gk-muted">{t("Check the kick-off, ground and referee below. Accepting puts the match in your squad’s schedule and opens a conversation between both coaching teams.")}</p>
                {available.length > 1 ? <div className="gk-field"><span className="gk-field__label" id="respond-squad">{t("Your squad")}</span>
                    <ChoiceChips labelledBy="respond-squad" value={chosen} onChange={setChosen} choices={available.map(s => ({ value: s.id, label: s.name }))} /></div>
                    : available.length === 1 ? <p><span className="gk-faint">{t("Your squad")}</span> <strong>{available[0].name}</strong>{m.requested_squad_id ? ` ${t('(requested by the host)')}` : ''}</p>
                        : <p className="gk-notice gk-notice--warning">{t("None of the squads you manage can accept this invitation. Ask your club’s leadership.")}</p>}
                <div className="gk-mx">{feedback}</div>
                <div className="gk-match-actions">
                    <Button variant="primary" disabled={busy || !chosen} onClick={() => void run(() => answerInvitation(m, { accept: true, squadId: chosen! }), t("Invitation accepted"))}>{t("Accept invitation")}</Button>
                    <Button disabled={busy} onClick={() => void run(() => answerInvitation(m, { accept: false }), t("Invitation declined"))}>{t("Decline")}</Button>
                </div>
            </div>
        </Panel>
    );
}

/** Squads that offered to play: the host accepts one (the rest are declined) or declines each. */
export function ProposalList({ match: m, active, reload }: { match: Match; active: boolean; reload: () => void }) {
    const t = useMatchCopy();
    const { run, busy, feedback } = useAction(reload);
    const proposals = m.proposals ?? [];
    if (!proposals.length) return null;
    const pending = proposals.filter(p => p.status === 'PENDING').length;
    return (
        <Section title={m.can_manage ? t("Proposals") : t("Your proposals")} id="proposals" hint={m.can_manage && pending ? t('{count} waiting for you', { count: pending }) : undefined}>
            <Panel flush>
                <List label={m.can_manage ? t("Proposals") : t("Your proposals")}>
                    {proposals.map(p => {
                        const state = PROPOSAL[p.status] ?? { label: p.status, tone: 'neutral' as BadgeTone };
                        const decide = p.status === 'PENDING' && active;
                        return <ListRow key={p.id} lead={<Crest name={p.club_name} size={40} />}
                            title={<><Link className="gk-match-link" to={`/clubs/${p.club_id}`}>{p.club_name}</Link> · {p.squad_name}</>}
                            meta={p.note || t("No message")}
                            trail={decide ? (m.can_manage
                                ? <><Button size="sm" variant={pending === 1 ? 'primary' : 'secondary'} disabled={busy} onClick={() => void run(() => post(`/match-exchange/${m.event_id}/proposals/${p.id}/decision`, { action: 'ACCEPT', revision: m.revision }), t('{club} accepted. Other proposals were declined.', { club: p.club_name }))}>{t('Accept')}</Button>
                                    <Button size="sm" disabled={busy} onClick={() => void run(() => post(`/match-exchange/${m.event_id}/proposals/${p.id}/decision`, { action: 'DECLINE', revision: m.revision }), t("Proposal declined"))}>{t("Decline")}</Button></>
                                : <Button size="sm" disabled={busy} onClick={() => void run(() => post(`/match-exchange/${m.event_id}/proposals/${p.id}/decision`, { action: 'WITHDRAW', revision: m.revision }), t("Proposal withdrawn"))}>{t("Withdraw")}</Button>)
                                : <Badge tone={state.tone}>{t(state.label)}</Badge>} />;
                    })}
                </List>
            </Panel>
            <div className="gk-mx gk-match-feedback">{feedback}</div>
        </Section>
    );
}

/** Offer one of our squads for an open match, with a note for the host coach. */
export function ProposeForm({ match: m, squads, reload }: { match: Match; squads: Squad[]; reload: () => void }) {
    const t = useMatchCopy();
    const draft = useOfferDraft(m, squads, squads.length === 1 ? squads[0].id : undefined, reload, reload);
    return (
        <Section title={t("Propose to play")} id="match-proposal">
            <Panel padded>
                <form className="gk-match-form" onSubmit={event => { event.preventDefault(); void draft.send(t("Proposal sent to the hosting squad"), t("Unable to save. Please try again.")); }}>
                    <Field label={t("Your squad")} htmlFor="propose-squad">
                        <select id="propose-squad" className="gk-input" required disabled={!draft.editable} value={draft.squad?.id ?? ''} onChange={event => draft.change({ squadId: event.target.value ? Number(event.target.value) : null })}>
                            <option value="">{t("Choose a squad")}</option>
                            {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </Field>
                    <Field label={t("Message to the coach")} htmlFor="propose-note" hint={t("Introduce your squad and confirm the time and format work for you.")}>
                        <textarea id="propose-note" className="gk-input" rows={3} maxLength={2000} disabled={!draft.editable} value={draft.note} onChange={event => draft.change({ note: event.target.value })} />
                    </Field>
                    <div className="gk-mx">
                        {draft.error && <p className="mx-error" role="alert">{t(draft.error)}</p>}
                        {draft.notice && <p className="mx-notice" role="status">{draft.notice}</p>}
                    </div>
                    {draft.edited && <p className="gk-faint">{t('Kept while you browse. Reloading clears this draft.')}</p>}
                    <div className="gk-match-actions">
                        <Button variant="primary" type="submit" disabled={!draft.editable || !draft.squad}>{t("Send proposal")}</Button>
                        {draft.edited && <Button variant="ghost" disabled={!draft.editable} onClick={draft.discard}>{t('Discard draft')}</Button>}
                    </div>
                </form>
            </Panel>
        </Section>
    );
}
