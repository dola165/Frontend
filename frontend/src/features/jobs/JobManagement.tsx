import { useCommerceCopy, ct } from '../store/copy';
import { Button, Field } from '../../design/primitives';
import { CATEGORIES, HOURS, TERMS, directionOf, posterOf, type Job, type JobApplyMethod, type JobHours } from './api';
import { jt } from './managementCopy';
import { useJobManagement } from './useJobManagement';
import './JobManagement.css';

export function JobManagement({ job, userId, onSaved }: { job: Job; userId?: number; onSaved: () => void }) {
    useCommerceCopy();
    const state = useJobManagement(job, userId, onSaved);
    if (!job.canManage || !userId) return null;
    const draft = state.draft;
    const personal = posterOf(job).kind === 'PERSON';
    const targetNeeded = draft?.applyMethod === 'EMAIL' || draft?.applyMethod === 'LINK';
    const valid = !!draft && draft.title.trim().length >= 4 && draft.description.trim().length >= 10 &&
        (!targetNeeded || (draft.applyMethod === 'EMAIL' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.applyTarget?.trim() ?? '') : /^https:\/\/\S+$/.test(draft.applyTarget?.trim() ?? '')));
    return <section className="gk-job-management" aria-label={ct('This is your listing')}>
        {state.pending ? <><p role="status">{jt('Your previous change needs checking before another change.')}</p><Button disabled={state.busy} onClick={() => void state.send(state.pending!.kind)}>{jt(state.busy ? 'Checking…' : 'Check previous change')}</Button></>
            : draft ? <form onSubmit={event => { event.preventDefault(); if (valid && !state.stale) void state.send('EDIT'); }}>
                <h3>{jt('Edit listing')}</h3>
                {job.status === 'CLOSED' && <p>{jt('Saving edits keeps this listing closed. Reopen it when you are ready.')}</p>}
                {state.stale && <div className="gk-notice" role="alert"><p>{jt('This listing changed. Review the latest version before saving your answers.')}</p><strong>{jt('Latest listing')}: {job.title}</strong><p>{job.description}</p><p>{jt('Your answers are kept below.')}</p><Button type="button" onClick={state.acceptLatest}>{jt('Use latest version')}</Button></div>}
                <fieldset disabled={state.busy}>
                    <Field label={ct('Title')} htmlFor={`job-edit-title-${job.id}`}><input id={`job-edit-title-${job.id}`} className="gk-input" maxLength={120} value={draft.title} onChange={e => state.change({ title: e.target.value })} /></Field>
                    <Field label={ct('About')} htmlFor={`job-edit-description-${job.id}`}><textarea id={`job-edit-description-${job.id}`} className="gk-input" maxLength={2000} value={draft.description} onChange={e => state.change({ description: e.target.value })} /></Field>
                    <Field label={jt('Line of work')} htmlFor={`job-edit-category-${job.id}`}><select id={`job-edit-category-${job.id}`} className="gk-input" value={draft.category} onChange={e => state.change({ category: e.target.value as typeof draft.category })}>{CATEGORIES.map(c => <option key={c.value} value={c.value}>{ct(c.label)}</option>)}</select></Field>
                    <Field label={ct('Terms')} htmlFor={`job-edit-terms-${job.id}`}><select id={`job-edit-terms-${job.id}`} className="gk-input" value={draft.engagementType} onChange={e => state.change({ engagementType: e.target.value as typeof draft.engagementType })}>{TERMS.map(t => <option key={t.value} value={t.value}>{ct(t.label)}</option>)}</select></Field>
                    <Field label={ct('Hours')} htmlFor={`job-edit-hours-${job.id}`}><select id={`job-edit-hours-${job.id}`} className="gk-input" value={draft.hours ?? ''} onChange={e => state.change({ hours: e.target.value as JobHours || null })}><option value="">{ct('Not set')}</option>{HOURS.map(h => <option key={h.value} value={h.value}>{ct(h.label)}</option>)}</select></Field>
                    <Field label={ct('Pay')} htmlFor={`job-edit-pay-${job.id}`}><input id={`job-edit-pay-${job.id}`} className="gk-input" maxLength={120} value={draft.pay} onChange={e => state.change({ pay: e.target.value })} /></Field>
                    <Field label={ct('Where')} htmlFor={`job-edit-city-${job.id}`}><input id={`job-edit-city-${job.id}`} className="gk-input" maxLength={120} value={draft.city} onChange={e => state.change({ city: e.target.value })} /></Field>
                    <Field label={directionOf(job) === 'OFFERING' ? jt('Stated licence') : ct('Licence needed')} htmlFor={`job-edit-licence-${job.id}`}><input id={`job-edit-licence-${job.id}`} className="gk-input" maxLength={120} value={draft.licence ?? ''} onChange={e => state.change({ licence: e.target.value })} /></Field>
                    <Field label={jt('Contact method')} htmlFor={`job-edit-method-${job.id}`}><select id={`job-edit-method-${job.id}`} className="gk-input" value={draft.applyMethod} onChange={e => state.change({ applyMethod: e.target.value as JobApplyMethod, applyTarget: '' })}>{(['MESSAGE', 'EMAIL', 'LINK'] as const).map((value, i) => <option key={value} value={value}>{jt(['Message me in the app', 'Email', 'A link'][i])}</option>)}</select></Field>
                    {targetNeeded && <Field label={jt('Contact')} htmlFor={`job-edit-contact-${job.id}`}><input id={`job-edit-contact-${job.id}`} className="gk-input" maxLength={500} type={draft.applyMethod === 'EMAIL' ? 'email' : 'url'} value={draft.applyTarget ?? ''} onChange={e => state.change({ applyTarget: e.target.value })} /></Field>}
                </fieldset>
                <div className="gk-job-detail__actions"><Button type="submit" variant="primary" disabled={!valid || state.busy || !!state.stale}>{jt(state.busy ? 'Saving…' : 'Save changes')}</Button><Button type="button" disabled={state.busy} onClick={state.cancel}>{jt('Cancel editing')}</Button></div>
            </form> : <div className="gk-job-detail__actions">
                {personal && <Button onClick={state.start}>{jt('Edit listing')}</Button>}
                {job.status === 'OPEN' && <Button disabled={state.busy} onClick={() => void state.send('CLOSE')}>{ct('Close listing')}</Button>}
                {personal && job.status === 'CLOSED' && <Button disabled={state.busy} onClick={() => void state.send('REOPEN')}>{jt('Reopen listing')}</Button>}
            </div>}
        {personal && job.status === 'CLOSED' && !draft && <p className="gk-faint">{jt('Reopening needs an adult public profile.')}</p>}
        {state.error && <p role="alert">{state.error}</p>}
    </section>;
}
