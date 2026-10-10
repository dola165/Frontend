import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Field, List, ListRow, Panel, Section, type BadgeTone } from '../../../design/primitives';
import { Crest } from '../../world/Crest';
import { post, type Match, type Squad } from '../api';
import { useAction } from '../hooks';
import { ChoiceChips } from '../../../design/ChoiceChips';

const PROPOSAL: Record<string, { label: string; tone: BadgeTone }> = {
    PENDING: { label: 'Waiting for a decision', tone: 'warning' }, ACCEPTED: { label: 'Accepted', tone: 'accent' },
    DECLINED: { label: 'Declined', tone: 'neutral' }, WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' },
};

/** A club invited ours: choose the squad that accepts, or decline. Nothing is agreed until accepted. */
export function InvitationResponse({ match: m, squads, reload }: { match: Match; squads: Squad[]; reload: () => void }) {
    const available = squads.filter(s => s.club_id === m.requested_club_id && (!m.requested_squad_id || s.id === m.requested_squad_id));
    const [chosen, setChosen] = useState<number | null>(m.requested_squad_id ?? (available.length === 1 ? available[0].id : null));
    const { run, busy, feedback } = useAction(reload);
    return (
        <Panel className="gk-match-callout" as="section">
            <div className="gk-match-callout__body">
                <h2 className="gk-match-callout__title">{m.club_name} invited your club to play</h2>
                <p className="gk-muted">Check the kick-off, ground and referee below. Accepting puts the match in your squad’s schedule and opens a conversation between both coaching teams.</p>
                {available.length > 1 ? <div className="gk-field"><span className="gk-field__label" id="respond-squad">Your squad</span>
                    <ChoiceChips labelledBy="respond-squad" value={chosen} onChange={setChosen} choices={available.map(s => ({ value: s.id, label: s.name }))} /></div>
                    : available.length === 1 ? <p><span className="gk-faint">Your squad</span> <strong>{available[0].name}</strong>{m.requested_squad_id ? ' (requested by the host)' : ''}</p>
                        : <p className="gk-notice gk-notice--warning">None of the squads you manage can accept this invitation. Ask your club’s leadership.</p>}
                <div className="gk-mx">{feedback}</div>
                <div className="gk-match-actions">
                    <Button variant="primary" disabled={busy || !chosen} onClick={() => void run(() => post(`/match-arrangements/${m.event_id}/response`, { action: 'ACCEPT', squadId: chosen, revision: m.revision }), 'Invitation accepted')}>Accept invitation</Button>
                    <Button disabled={busy} onClick={() => void run(() => post(`/match-arrangements/${m.event_id}/response`, { action: 'DECLINE', revision: m.revision }), 'Invitation declined')}>Decline</Button>
                </div>
            </div>
        </Panel>
    );
}

/** Squads that offered to play: the host accepts one (the rest are declined) or declines each. */
export function ProposalList({ match: m, active, reload }: { match: Match; active: boolean; reload: () => void }) {
    const { run, busy, feedback } = useAction(reload);
    const proposals = m.proposals ?? [];
    if (!proposals.length) return null;
    const pending = proposals.filter(p => p.status === 'PENDING').length;
    return (
        <Section title={m.can_manage ? 'Proposals' : 'Your proposals'} id="proposals" hint={m.can_manage && pending ? `${pending} waiting for you` : undefined}>
            <Panel flush>
                <List label={m.can_manage ? 'Proposals' : 'Your proposals'}>
                    {proposals.map(p => {
                        const state = PROPOSAL[p.status] ?? { label: p.status, tone: 'neutral' as BadgeTone };
                        const decide = p.status === 'PENDING' && active;
                        return <ListRow key={p.id} lead={<Crest name={p.club_name} size={40} />}
                            title={<><Link className="gk-match-link" to={`/clubs/${p.club_id}`}>{p.club_name}</Link> · {p.squad_name}</>}
                            meta={p.note || 'No message'}
                            trail={decide ? (m.can_manage
                                ? <><Button size="sm" variant={pending === 1 ? 'primary' : 'secondary'} disabled={busy} onClick={() => void run(() => post(`/match-exchange/${m.event_id}/proposals/${p.id}/decision`, { action: 'ACCEPT', revision: m.revision }), `${p.club_name} accepted. Other proposals were declined.`)}>Accept</Button>
                                    <Button size="sm" disabled={busy} onClick={() => void run(() => post(`/match-exchange/${m.event_id}/proposals/${p.id}/decision`, { action: 'DECLINE', revision: m.revision }), 'Proposal declined')}>Decline</Button></>
                                : <Button size="sm" disabled={busy} onClick={() => void run(() => post(`/match-exchange/${m.event_id}/proposals/${p.id}/decision`, { action: 'WITHDRAW', revision: m.revision }), 'Proposal withdrawn')}>Withdraw</Button>)
                                : <Badge tone={state.tone}>{state.label}</Badge>} />;
                    })}
                </List>
            </Panel>
            <div className="gk-mx gk-match-feedback">{feedback}</div>
        </Section>
    );
}

/** Offer one of our squads for an open match, with a note for the host coach. */
export function ProposeForm({ match: m, squads, reload }: { match: Match; squads: Squad[]; reload: () => void }) {
    const [squad, setSquad] = useState(squads.length === 1 ? String(squads[0].id) : '');
    const [note, setNote] = useState('');
    const { run, busy, feedback } = useAction(reload);
    return (
        <Section title="Propose to play" id="match-proposal">
            <Panel padded>
                <form className="gk-match-form" onSubmit={event => { event.preventDefault(); void run(() => post(`/match-exchange/${m.event_id}/proposals`, { squadId: Number(squad), note, revision: m.revision }), 'Proposal sent to the hosting squad'); }}>
                    <Field label="Your squad" htmlFor="propose-squad">
                        <select id="propose-squad" className="gk-input" required value={squad} onChange={event => setSquad(event.target.value)}>
                            <option value="">Choose a squad</option>
                            {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Message to the coach" htmlFor="propose-note" hint="Introduce your squad and confirm the time and format work for you.">
                        <textarea id="propose-note" className="gk-input" rows={3} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} />
                    </Field>
                    <div className="gk-mx">{feedback}</div>
                    <div className="gk-match-actions"><Button variant="primary" type="submit" disabled={busy || !squad}>Send proposal</Button></div>
                </form>
            </Panel>
        </Section>
    );
}
