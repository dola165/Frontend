import { useId, useState, type FormEvent } from 'react';
import { Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import { extractApiErrorMessage } from '../../../utils/apiError';
import { useCopy } from '../../../locales/useCopy';
import { mySquadsEn } from '../../../locales/mySquadsDesign';
import { put, root, type OperationRecord } from '../../clubOperations/api';
import { useRecordCreation } from '../../clubOperations/useRecordCreation';
import type { MatchCard } from './squadApi';
import type { CoachData } from './CoachWorkspace';

/**
 * The match card's checklist: the club's preparation record for this match (referee, pitch, first-aider and what to
 * bring, one per line), the same record Club office's preparation tool kept. Whoever prepares matches edits it here.
 */
export function MatchChecklistDialog({ card, data, opponent, onClose, onSaved }: { card: MatchCard; data: CoachData; opponent: string; onClose: () => void; onSaved: () => void }) {
    const copy = useCopy('mySquads', mySquadsEn);
    const id = useId();
    const prep = card.preparation, match = card.match!;
    const [referees, setReferees] = useState(prep?.referees ?? ''), [pitch, setPitch] = useState(prep?.pitch ?? match.location_name ?? '');
    const [medical, setMedical] = useState(prep?.medical ?? ''), [bring, setBring] = useState((prep?.bring ?? []).join('\n'));
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const creation = useRecordCreation({ clubId: data.clubId, actorId: data.boot?.actorId ?? data.roles.actorId }, 'MATCH_PREPARATION');
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError('');
        const body = {
            kind: 'MATCH_PREPARATION', title: `${copy('checklist')} · ${card.squadName}`.slice(0, 160), squadId: card.squadId, subjectUserId: null, assignedUserId: null,
            eventId: match.event_id, sessionId: null, relatedRecordId: null, dueOn: null, revision: prep?.revision ?? null,
            data: { referees: referees.trim(), pitch: pitch.trim(), medical: medical.trim(), bring: bring.trim(), checkedOn: new Date().toISOString().slice(0, 10) },
        };
        try {
            if (prep) await put<OperationRecord>(`${root(data.clubId)}/records/${prep.recordId}`, body);
            else await creation.create(body);
            onSaved();
        } catch (failure) { setError(extractApiErrorMessage(failure, copy('checklistFailed'))); }
        finally { setBusy(false); }
    };
    return <Dialog open size="md" title={copy('checklist')} description={`${card.squadName} · ${copy('versus', { team: opponent })}`} onClose={onClose}
        footer={<><Button onClick={onClose}>{copy('cancel')}</Button><Button variant="primary" type="submit" form={id} disabled={busy}>{copy('save')}</Button></>}>
        <form id={id} className="gk-stack" onSubmit={event => void submit(event)}>
            <Field label={copy('stepReferee')} htmlFor={`${id}-referee`}><input id={`${id}-referee`} className="gk-input" required value={referees} onChange={e => setReferees(e.target.value)} placeholder={copy('refereeHint')} /></Field>
            <Field label={copy('stepPitch')} htmlFor={`${id}-pitch`}><input id={`${id}-pitch`} className="gk-input" required value={pitch} onChange={e => setPitch(e.target.value)} /></Field>
            <Field label={copy('stepFirstAid')} htmlFor={`${id}-medical`}><input id={`${id}-medical`} className="gk-input" required value={medical} onChange={e => setMedical(e.target.value)} placeholder={copy('firstAidHint')} /></Field>
            <Field label={copy('bring')} hint={copy('bringHint')} htmlFor={`${id}-bring`}><textarea id={`${id}-bring`} className="gk-input" rows={4} value={bring} onChange={e => setBring(e.target.value)} /></Field>
            {(error || creation.message) && <p className="gk-notice gk-notice--danger" role="alert">{error || creation.message}</p>}
        </form>
    </Dialog>;
}
