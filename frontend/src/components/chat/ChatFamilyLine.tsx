import { useState } from 'react';
import { Bell, BellOff, Users } from 'lucide-react';
import { chatApi, type ChatFamily } from '../../api/chat';
import { AddMyParentButton } from '../auth/AddMyParentButton';
import { extractApiErrorMessage } from '../../utils/apiError';
import { useMessageCopy } from './messageCopy';
import './chat-family.css';

const list = (names: string[]) => [...new Set(names)].join(', ');

/** One quiet line under the chat's header: who of the family is here too, and what it means for this reader. */
export function ChatFamilyLine({ family, currentUserId, conversationId, onChanged }: {
    family: ChatFamily; currentUserId: number; conversationId: number; onChanged: () => void;
}) {
    const copy = useMessageCopy();
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const others = family.parents.filter(parent => parent.userId !== currentUserId);
    const mine = family.parents.filter(parent => parent.userId === currentUserId);
    const mute = async () => {
        setBusy(true); setError('');
        try { await chatApi.setMuted(conversationId, !family.muted); onChanged(); }
        catch (cause) { setError(extractApiErrorMessage(cause, copy('That didn’t save. Try again.', 'ვერ შეინახა. სცადეთ ხელახლა.'))); }
        finally { setBusy(false); }
    };
    if (family.awaitingParent) return <aside className="chat-family" data-state="waiting">
        <Users aria-hidden="true" />
        {family.youAreThePlayer
            ? <div className="chat-family__ask"><p>{copy('Add your parent: the club will reply when a parent is in this chat.', 'დაამატეთ მშობელი: კლუბი გიპასუხებთ, როცა მშობელი ამ ჩატში იქნება.')}</p><AddMyParentButton /></div>
            : <p>{copy(`You can reply when ${family.playerName}’s parent is in this chat.`, `პასუხს შეძლებთ, როცა მშობელი (${family.playerName}) ამ ჩატში იქნება.`)}</p>}
    </aside>;
    if (!family.parents.length) return null;
    return <aside className="chat-family">
        <Users aria-hidden="true" />
        <p>{family.parentHeld && mine.length
            ? copy(`You’re in this chat as ${list(mine.map(parent => parent.childName))}’s parent.`, `ამ ჩატში ხართ, როგორც მშობელი (${list(mine.map(parent => parent.childName))}).`)
            : others.length === 1
                ? copy(`${others[0].displayName} is in this chat too.`, `ამ ჩატში ასევე არის: ${others[0].displayName}.`)
                : copy(`${list(others.map(parent => parent.displayName))} are in this chat too.`, `ამ ჩატში ასევე არიან: ${list(others.map(parent => parent.displayName))}.`)}</p>
        {family.parentHeld && <button type="button" className="chat-family__mute" disabled={busy} aria-pressed={family.muted} onClick={() => void mute()}>
            {family.muted ? <BellOff aria-hidden="true" /> : <Bell aria-hidden="true" />}{family.muted ? copy('Muted', 'ხმა გამორთულია') : copy('Mute', 'ხმის გამორთვა')}
        </button>}
        {error && <p role="alert">{error}</p>}
    </aside>;
}
