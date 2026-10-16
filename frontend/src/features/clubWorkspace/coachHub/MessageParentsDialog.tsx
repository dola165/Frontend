import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Avatar, Button, EmptyNote, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { chatApi } from '../../../api/chat';
import { extractApiErrorMessage } from '../../../utils/apiError';
import type { CoachData } from './CoachWorkspace';
import './coach-hub.css';

interface Parent { id: number; name: string; squad: string }

/**
 * Writing to several parents at once: tap their faces, write, send. One group conversation is created with the
 * people chosen and the message is its first line; the chat opens on it. Faces are the squads' parents and
 * guardians, so nobody outside the squad can be picked by mistake.
 */
export function MessageParentsDialog({ data, onClose }: { data: CoachData; onClose: () => void }) {
    const navigate = useNavigate();
    const parents: Parent[] = [];
    for (const squad of data.squads ?? []) {
        if (!data.shown.includes(squad.id)) continue;
        for (const thread of squad.overview?.threads ?? []) if (!parents.some(parent => parent.id === thread.user_id)) parents.push({ id: thread.user_id, name: thread.full_name, squad: data.names.get(squad.id) ?? '' });
    }
    const [picked, setPicked] = useState<number[]>([]);
    const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const toggle = (id: number) => setPicked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    const chosen = parents.filter(parent => picked.includes(parent.id));

    const send = async () => {
        if (busy || !chosen.length || !text.trim()) return;
        setBusy(true); setError('');
        try {
            const name = chosen.length <= 3 ? chosen.map(parent => parent.name.split(' ')[0]).join(', ') : `${chosen.length} parents · ${chosen[0].squad}`;
            const conversation = (await chatApi.createConversation({ contextType: chosen.length === 1 ? 'DIRECT' : 'GROUP', name, participantIds: picked })).data;
            await chatApi.sendMessage(conversation.id, text.trim(), crypto.randomUUID());
            navigate(`/messages?conversationId=${conversation.id}`);
        } catch (cause) { setError(extractApiErrorMessage(cause, 'The message could not be sent.')); setBusy(false); }
    };

    return <Dialog open size="md" title="Message parents" description={chosen.length ? `To ${chosen.map(parent => parent.name).join(', ')}` : 'Tap the parents you want to write to'} onClose={onClose}
        footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || !chosen.length || !text.trim()} onClick={() => void send()}><Send aria-hidden="true" />{busy ? 'Sending…' : chosen.length > 1 ? `Send to ${chosen.length}` : 'Send'}</Button></>}>
        <div className="gk-stack">
            {parents.length ? <ul className="ch-pick" aria-label="Parents and guardians">{parents.map(parent => <li key={parent.id}>
                <button type="button" className="ch-pick__person" aria-pressed={picked.includes(parent.id)} disabled={busy} onClick={() => toggle(parent.id)}>
                    <Avatar name={parent.name} size={44} /><strong>{parent.name}</strong><span>{parent.squad}</span>
                </button>
            </li>)}</ul> : <EmptyNote title="No parents linked yet">Parents and guardians appear here once they are linked to your players.</EmptyNote>}
            <Field label="Message" htmlFor="ch-parents-text">
                <textarea id="ch-parents-text" className="gk-input" rows={3} maxLength={2000} placeholder="Write once, everyone chosen gets it…" value={text} disabled={busy} onChange={event => setText(event.target.value)} />
            </Field>
            {error && <p className="gk-notice gk-notice--danger" role="alert">{error}</p>}
        </div>
    </Dialog>;
}
