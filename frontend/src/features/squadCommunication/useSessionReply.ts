import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { extractApiErrorMessage } from '../../utils/apiError';
import { getAuthSessionId, subscribeAuthSession } from '../../utils/authStorage';
import * as api from './api';
import { acknowledgeReply, beginReply, readUncertainReply, replyScope, requireReplyScope, ReplyRecoveryError, type UncertainReply } from './availabilityRecovery';
import { useJourneyCopy } from './journeyCopy';

type Person = api.SquadSession['attendance'][number];

/**
 * A family's "coming / can't come" for one session, outside the session dialog (Parent Hub's next-up card).
 * Same safeguards as the dialog: the command is kept before it is sent, an unconfirmed one blocks that player's
 * buttons until it is retried, and the server still checks who may answer.
 */
export function useSessionReply(squadId: number | undefined, session: api.SquadSession | undefined, onSaved: () => void) {
    const copy = useJourneyCopy();
    const authSessionId = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    const [pending, setPending] = useState(new Map<number, UncertainReply>());
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
    const saving = useRef(false);
    useEffect(() => {
        const scope = replyScope(), found = new Map<number, UncertainReply>();
        if (scope && squadId && session) for (const person of session.attendance) {
            try { const command = readUncertainReply(scope, squadId, session.id, person.id); if (command) found.set(person.id, command); }
            catch (e) { setError(extractApiErrorMessage(e, copy('The earlier reply could not be recovered.', 'წინა პასუხი ვერ აღდგა.'))); }
        }
        setPending(found);
    }, [authSessionId, squadId, session, copy]);
    const send = async (command: UncertainReply) => {
        requireReplyScope(command);
        await api.attendance(command.squadId, command.occurrenceId, command.playerId, command.response, command.revision, command.requestId, command.sessionId, command.reason);
        acknowledgeReply(command);
        setPending(previous => { const next = new Map(previous); if (next.get(command.playerId)?.requestId === command.requestId) next.delete(command.playerId); return next; });
    };
    const run = async (action: () => Promise<unknown>) => {
        if (saving.current) return; saving.current = true; setBusy(true); setError(''); setSaved(false);
        try { await action(); setSaved(true); onSaved(); }
        catch (e) { setError(e instanceof ReplyRecoveryError ? e.message : extractApiErrorMessage(e, copy('Your answer could not be saved.', 'პასუხი ვერ შეინახა.'))); }
        finally { saving.current = false; setBusy(false); }
    };
    const reply = (person: Person, response: string, reason?: string) => void run(async () => {
        const scope = replyScope();
        if (!scope || !squadId || !session) throw new ReplyRecoveryError(copy('Reopen the session in your current account before replying.', 'პასუხისთვის სესია ხელახლა გახსენით.'));
        const command = beginReply(scope, squadId, session.id, person.id, response, session.revision, reason);
        setPending(previous => new Map(previous).set(person.id, command));
        await send(command);
    });
    const retry = (playerId: number) => { const command = pending.get(playerId); if (command) void run(() => send(command)); };
    return { reply, retry, pending, busy, error, saved };
}
