import { useState } from 'react';
import { Button, Field } from '../../../design/primitives';
import { Dialog } from '../../../design/Dialog';
import type { TryoutDto } from '../../../api/tryouts';
import { useRecruitmentCopy } from '../../../locales/recruitmentDesign';

export interface TryoutPayload { title: string; tryoutDate: string; deadline?: string; position?: string; ageGroup?: string; description?: string }
const toLocalInput = (value: string | null | undefined) => value ? value.slice(0, 16) : '';

/**
 * Posting or editing a tryout session. Unchanged dates are sent back exactly as the server gave them,
 * so editing a title never shifts a session's time.
 */
export function TryoutForm({ tryout, saving, onCancel, onSubmit }: { tryout: TryoutDto | null; saving: boolean; onCancel: () => void; onSubmit: (payload: TryoutPayload) => Promise<void> }) {
    const r = useRecruitmentCopy();
    const [title, setTitle] = useState(tryout?.title ?? ''), [tryoutDate, setTryoutDate] = useState(toLocalInput(tryout?.tryoutDate)), [deadline, setDeadline] = useState(toLocalInput(tryout?.deadline));
    const [position, setPosition] = useState(tryout?.position ?? ''), [ageGroup, setAgeGroup] = useState(tryout?.ageGroup ?? ''), [description, setDescription] = useState(tryout?.description ?? '');
    const optional = <span className="rec-optional"> ({r('optional').toLowerCase()})</span>;
    const submit = () => {
        if (!title.trim() || saving) return;
        void onSubmit({
            title: title.trim(),
            tryoutDate: tryout && tryoutDate === toLocalInput(tryout.tryoutDate) ? tryout.tryoutDate : tryoutDate,
            deadline: tryout && deadline === toLocalInput(tryout.deadline) ? tryout.deadline || undefined : deadline || undefined,
            position: position.trim() || undefined, ageGroup: ageGroup.trim() || undefined, description: description.trim() || undefined,
        });
    };
    return <Dialog open size="md" title={r(tryout ? 'editTryout' : 'newTryout')} description={r('formIntro')} closeLabel={r('close')} onClose={onCancel}
        footer={<><Button variant="ghost" disabled={saving} onClick={onCancel}>{r('cancel')}</Button>
            <Button type="submit" form="tryout-form" variant="primary" disabled={saving || !title.trim()}>{r(saving ? 'saving' : 'saveTryout')}</Button></>}>
        <form id="tryout-form" className="rec-fields" onSubmit={event => { event.preventDefault(); submit(); }}>
            <div className="rec-wide"><Field label={r('title')} htmlFor="tryout-title"><input id="tryout-title" className="gk-input" value={title} onChange={event => setTitle(event.target.value)} required maxLength={120} disabled={saving} autoFocus /></Field></div>
            <Field label={r('date')} htmlFor="tryout-date"><input id="tryout-date" className="gk-input" type="datetime-local" value={tryoutDate} onChange={event => setTryoutDate(event.target.value)} required disabled={saving} /></Field>
            <Field label={<>{r('deadlineLabel')}{optional}</>} htmlFor="tryout-deadline"><input id="tryout-deadline" className="gk-input" type="datetime-local" value={deadline} onChange={event => setDeadline(event.target.value)} disabled={saving} /></Field>
            <Field label={<>{r('position')}{optional}</>} htmlFor="tryout-position"><input id="tryout-position" className="gk-input" value={position} onChange={event => setPosition(event.target.value)} maxLength={80} disabled={saving} placeholder={r('allPositions')} /></Field>
            <Field label={<>{r('ageGroup')}{optional}</>} htmlFor="tryout-age"><input id="tryout-age" className="gk-input" value={ageGroup} onChange={event => setAgeGroup(event.target.value)} maxLength={40} disabled={saving} placeholder={r('allAges')} /></Field>
            <div className="rec-wide"><Field label={<>{r('description')}{optional}</>} htmlFor="tryout-description"><textarea id="tryout-description" className="gk-input" value={description} onChange={event => setDescription(event.target.value)} rows={4} maxLength={2000} disabled={saving} placeholder={r('descriptionHint')} /></Field></div>
        </form>
    </Dialog>;
}
