import { Button, EmptyNote, Panel } from '../../design/primitives';
import { type Prospect } from './api';
import type { useScoutingAction } from './useScouting';
import { ScoutingLink } from './ScoutingLink';

const words: Record<string, string> = { WATCH: 'Added to watchlist', OBSERVE: 'Observation recorded', FOLLOW_UP: 'Follow up recommended',
    NO_FURTHER_ACTION: 'No further action', REOPEN: 'Continued with a reason', CONTACT_OPENED: 'Conversation opened' };
export interface Draft { id: number | null; action: string; note: string; source: string; date: string }
export function ScoutingRecord({ record, action, draft, setDraft, requestClose, familyPath }: {
    record: Prospect; action: ReturnType<typeof useScoutingAction>;
    draft: Draft; setDraft: (value: Draft) => void; requestClose: (then?: unknown) => void;
    familyPath?: string;
}) {
    const fields = draft.id === record.id ? draft : { id: record.id, action: 'OBSERVE', note: '', source: '', date: '' };
    const { action: actionName, note, source, date } = fields;
    const edit = (value: Partial<Draft>) => setDraft({ ...fields, ...value });
    const available = record.actions.filter(a => a !== 'CONTACT');
    const selected = available.includes(actionName) ? actionName : available[0] ?? '';
    const Editor = record.status === 'CLOSED' ? 'details' : 'div';
    const submit = () => {
        const input = { requestId: crypto.randomUUID(), revision: record.revision, action: selected, note,
            ...(selected === 'OBSERVE' ? { source, observedOn: date } : {}) };
        action.run({ kind: 'COMMAND', id: record.id, command: input });
    };
    const contact = () => {
        const input = { requestId: crypto.randomUUID(), revision: record.revision, action: 'CONTACT' };
        action.run({ kind: 'CONTACT', id: record.id, command: input });
    };
    if (record.restricted) return <EmptyNote title="Retained record · current access unavailable">The original record is kept. A changed job, publication or family relationship does not create new permission to read it.</EmptyNote>;
    return <div className="scouting-record">
        <Panel padded title={record.name}>
            <p>{record.outcome ? words[record.outcome] ?? record.outcome : 'No outcome recorded'}</p>
            <p className="scouting-hint">{record.source === 'PUBLIC_ADULT' ? 'Public adult player' : 'Family application'} · {record.sourceStatus.replaceAll('_', ' ').toLowerCase()}</p>
            <div className="scouting-actions">
                {record.source === 'PUBLIC_ADULT' && <ScoutingLink to={`/profile/${record.personId}`}>Public profile</ScoutingLink>}
                {record.actions.includes('CONTACT') && <Button disabled={action.busy || action.uncertain} onClick={() => requestClose(contact)}>Open adult conversation</Button>}
            </div>
            {record.source === 'FAMILY_APPLICATION' && <>
                <p>Contact only through the current family's application. Scouting does not open a child's direct messages.</p>
                {record.status === 'WATCHING' && familyPath && <ScoutingLink to={familyPath}>Open family application</ScoutingLink>}
            </>}
        </Panel>
        <Panel padded title="Football observations">
            {!record.observations.length ? <p>No observation recorded. Ability and suitability are unknown.</p> : <ol className="scouting-history">
                {record.observations.map(o => <li key={o.id}><strong>{o.source} · {o.observedOn}</strong><p>{o.summary}</p></li>)}
            </ol>}
        </Panel>
        {available.length > 0 && <Panel padded title={record.status === 'CLOSED' ? 'Optional continuation' : 'Record what happened'}>
            <Editor>
            {record.status === 'CLOSED' && <summary>Continue with a reason</summary>}
            <form onSubmit={e => { e.preventDefault(); submit(); }}>
                <fieldset disabled={action.busy || action.uncertain}>
                    <label>Action<select aria-label="Action" value={selected} onChange={e => edit({ action: e.target.value })}>
                        {available.map(a => <option key={a} value={a}>{a === 'OBSERVE' ? 'Add football observation' : a === 'REOPEN' ? 'Continue this record' : words[a] ?? a}</option>)}
                    </select></label>
                    {selected === 'OBSERVE' && <div className="scouting-fields">
                        <label>Observed on<input type="date" required value={date} onChange={e => edit({ date: e.target.value })} /></label>
                        <label>Match, session or source<input required maxLength={300} value={source} onChange={e => edit({ source: e.target.value })} /></label>
                    </div>}
                    <label>{selected === 'OBSERVE' ? 'Football observation' : 'Reason for this decision'}<textarea aria-label={selected === 'OBSERVE' ? 'Football observation' : 'Reason for this decision'} required maxLength={2000} rows={4} value={note} onChange={e => edit({ note: e.target.value })} /></label>
                    <p className="scouting-hint">Keep this to football observations and reasons. Clinical, welfare and private family notes belong in their restricted tools.</p>
                    <Button type="submit" variant="primary">{action.busy ? 'Saving…' : 'Save to record'}</Button>
                </fieldset>
            </form>
            </Editor>
        </Panel>}
        <details><summary>Record history</summary><ol className="scouting-history">{record.history.map(h => <li key={h.id}>
            <strong>{words[h.action] ?? h.action}</strong><span>{h.actor} · {h.recordedAt}</span>{h.note && <p>{h.note}</p>}
        </li>)}</ol></details>
    </div>;
}
