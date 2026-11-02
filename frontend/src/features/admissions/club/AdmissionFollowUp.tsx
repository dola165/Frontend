import type { OpenWorkspace } from '../../clubOperations/workspaceStructure';
import { loadHandoff, type HandoffOverview, type HandoffScope, type HandoffTarget } from '../../clubOperations/admissionHandoff/api';
import { useAdmissionHandoff } from '../../clubOperations/admissionHandoff/useAdmissionHandoff';
import { AdmissionPanel } from './ui';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import { useEffect, useId, useRef, useState } from 'react';
import { officeToolPath } from '../../clubOffice/officeLinks';
import { assertCurrentAuthSession } from '../../../utils/authStorage';
import './admission-follow-up.css';

export function AdmissionFollowUp({ scope, onOpen }: { scope: HandoffScope; onOpen: OpenWorkspace }) {
    const copy = useJourneyCopy();
    const state = useAdmissionHandoff<HandoffOverview>(scope);
    return <AdmissionPanel title={copy('Optional fee and kit follow-up', 'საწევროსა და ეკიპირების საკითხები (არასავალდებულო)')}>
        <p>{copy('No action may be needed. Free places, waivers, external arrangements and bringing your own kit remain valid.', 'შეიძლება მოქმედება საჭირო არ იყოს. უფასო მონაწილეობა, შეღავათები, სხვა შეთანხმებები და საკუთარი ეკიპირება კვლავ დასაშვებია.')}</p>
        {state.loading ? <p role="status">{copy('Checking current placement and authority…', 'მიმდინარე ჩარიცხვა და უფლებამოსილება მოწმდება…')}</p> : state.error ? <div role="alert">{state.error} <button type="button" className="admission-secondary" onClick={state.refresh}>{copy('Try again', 'ხელახლა ცდა')}</button></div>
            : <div className="admission-follow-up__actions">{state.data?.actions.map(action => <div key={action.target}>
                <button type="button" className="admission-secondary" disabled={!action.canStart} onClick={() => onOpen(action.target === 'FINANCE' ? 'finance' : 'equipment', {
                    admissionCase: String(scope.caseId), admissionVersion: String(scope.caseVersion),
                })}>{action.target === 'FINANCE' ? copy('Record agreed fee', 'შეთანხმებული საწევროს აღრიცხვა') : copy('Issue kit', 'ეკიპირების გაცემა')}</button>
                {!action.canStart && <p>{action.receivers.length ? <>{copy('Currently eligible:', 'ამჟამად უფლებამოსილი:')} {action.receivers.map(person => person.name).join(', ')}. {copy('The colleague must open this follow-up with their own current target authority.', 'კოლეგამ ეს საკითხი შესაბამისი მიმდინარე უფლებამოსილებით უნდა გახსნას.')}</> : copy('No eligible receiver currently has the required target authority.', 'ამჟამად შესაბამისი უფლებამოსილების მქონე მიმღები არ არის.')}</p>}
                {action.receivers.length > 0 && <FollowUpLink key={`${scope.sessionId}:${scope.caseId}:${scope.caseVersion}:${action.target}`} scope={scope} target={action.target} onUnavailable={state.refresh} />}
            </div>)}</div>}
        <p>{copy('Opening this follow-up records no fee, payment, permission or kit issue.', 'ამ საკითხის გახსნა საწევროს, გადახდას, თანხმობას ან ეკიპირების გაცემას არ აღრიცხავს.')}</p>
    </AdmissionPanel>;
}

/** LinkShare also offers QR, printing and WhatsApp; this bounded action only copies a safe URL. */
function FollowUpLink({ scope, target, onUnavailable }: { scope: HandoffScope; target: HandoffTarget; onUnavailable: () => void }) {
    const copy = useJourneyCopy(), id = useId();
    const pending = useRef<AbortController | null>(null);
    useEffect(() => () => pending.current?.abort(), []);
    const [state, setState] = useState<'idle' | 'checking' | 'copied' | 'failed'>('idle');
    const url = new URL(officeToolPath(scope.clubId, target === 'FINANCE' ? 'finance' : 'equipment', {
        admissionCase: String(scope.caseId), admissionVersion: String(scope.caseVersion),
    }), window.location.origin).toString();
    const copyLink = async () => {
        if (pending.current) return;
        const controller = new AbortController(); pending.current = controller;
        setState('checking');
        try {
            const current = await loadHandoff<HandoffOverview>(scope, controller.signal);
            if (controller.signal.aborted) return;
            if (!current.actions.some(action => action.target === target && action.receivers.length > 0)) throw new Error('Unavailable');
            assertCurrentAuthSession(scope.sessionId);
        } catch { if (!controller.signal.aborted) { setState('idle'); onUnavailable(); } pending.current = null; return; }
        try { await navigator.clipboard.writeText(url); if (!controller.signal.aborted) setState('copied'); }
        catch { if (!controller.signal.aborted) setState('failed'); }
        finally { pending.current = null; }
    };
    return <div className="admission-follow-up__copy">
        <button type="button" className="admission-secondary" disabled={state === 'checking'} onClick={() => void copyLink()}>{target === 'FINANCE'
            ? copy('Copy fee follow-up link', 'საწევროს საკითხის ბმულის კოპირება')
            : copy('Copy kit follow-up link', 'ეკიპირების საკითხის ბმულის კოპირება')}</button>
        {state === 'checking' && <p role="status">{copy('Checking current authority…', 'მიმდინარე უფლებამოსილება მოწმდება…')}</p>}
        {(state === 'copied' || state === 'failed') && <><label htmlFor={id}>{target === 'FINANCE' ? copy('Fee follow-up link', 'საწევროს საკითხის ბმული') : copy('Kit follow-up link', 'ეკიპირების საკითხის ბმული')}</label>
            <input id={id} className="gk-input" readOnly value={url} onFocus={event => event.target.select()} />
            <p role={state === 'failed' ? 'alert' : 'status'}>{state === 'failed'
                ? copy('Copying did not work. Select the link in the box and copy it.', 'კოპირება ვერ მოხერხდა. მონიშნეთ ბმული ველში და დააკოპირეთ.')
                : copy('Link copied. This does not mean it was received, read or completed.', 'ბმული დაკოპირდა. ეს მიღებას, წაკითხვას ან დასრულებას არ ნიშნავს.')}</p></>}
    </div>;
}
