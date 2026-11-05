import { useId, useState, useSyncExternalStore } from 'react';
import { Button, Field, Panel } from '../../../design/primitives';
import { getAuthSessionId, subscribeAuthSession } from '../../../utils/authStorage';
import { useClubEditorClose } from '../useClubEditorClose';
import { RecordChoicePicker } from '../records/RecordChoicePicker';
import { label } from '../api';
import type { HandoffContext, HandoffScope, HandoffTarget } from './api';
import { useAdmissionHandoff } from './useAdmissionHandoff';
import { useAdmissionHandoffCreation } from './useAdmissionHandoffCreation';
import { useJourneyCopy } from '../../squadCommunication/journeyCopy';
import './admission-handoff.css';

type Props = { scope: HandoffScope; target: HandoffTarget; onClose: () => void; onOpenRecord: (id: number) => void };

/** MAIN mounts this bounded starting point in the existing finance/equipment route. */
export function AdmissionHandoffStart(props: Props) {
    const copy = useJourneyCopy();
    const session = useSyncExternalStore(subscribeAuthSession, getAuthSessionId);
    if (session !== props.scope.sessionId) return <p role="alert">{copy('Your account changed. Reopen this follow-up from your current workspace.', 'ანგარიში შეიცვალა. საკითხი თქვენი მიმდინარე სამუშაო სივრციდან ხელახლა გახსენით.')}</p>;
    return <Start key={JSON.stringify([props.scope, props.target])} {...props} />;
}

function Start({ scope, target, onClose, onOpenRecord }: Props) {
    const copy = useJourneyCopy();
    const formId = useId();
    const state = useAdmissionHandoff<HandoffContext>(scope, target);
    const creation = useAdmissionHandoffCreation(scope, target);
    const [amount, setAmount] = useState(''), [currency, setCurrency] = useState(''), [period, setPeriod] = useState('');
    const [asset, setAsset] = useState(''), [quantity, setQuantity] = useState(''), [condition, setCondition] = useState('');
    const [saved, setSaved] = useState<number>(), [error, setError] = useState(false);
    const dirty = Boolean(amount || currency || period || asset || quantity || condition);
    const { requestClose, confirmation } = useClubEditorClose(dirty && !saved, creation.busy, onClose);
    const context = state.data, finance = target === 'FINANCE';
    const title = finance ? copy('Record agreed fee', 'შეთანხმებული საწევროს აღრიცხვა') : copy('Issue kit', 'ეკიპირების გაცემა');
    const submit = async () => {
        if (!context || state.loading || saved) return;
        setError(false);
        try {
            const result = await creation.create({ kind: finance ? 'INSTALMENT' : 'EQUIPMENT_ISSUE',
                title: finance ? 'Agreed membership fee' : 'Kit issue', squadId: context.squadId, subjectUserId: context.playerId,
                relatedRecordId: finance ? null : Number(asset), assignedUserId: null, eventId: null, sessionId: null, dueOn: null, revision: null,
                data: finance ? { amount, currency, period } : { quantity, conditionOut: condition } });
            if (result) setSaved(result.recordId);
        } catch { setError(true); state.refresh(); }
    };
    return <section className="admission-handoff" aria-label={title}>
        <h2>{title}</h2>
        <p>{copy('This follow-up is optional. Free places, waivers, external arrangements and your own kit remain valid.', 'ეს საკითხი არასავალდებულოა. უფასო მონაწილეობა, შეღავათები, სხვა შეთანხმებები და საკუთარი ეკიპირება კვლავ დასაშვებია.')}</p>
        {state.loading && <p role="status">{copy('Checking current placement and authority…', 'მიმდინარე ჩარიცხვა და უფლებამოსილება მოწმდება…')}</p>}
        {state.error && <div role="alert">{state.error} <Button onClick={state.refresh}>{copy('Try again', 'ხელახლა ცდა')}</Button></div>}
        {error && <p role="alert">{copy('This save was not confirmed. Check current authority and existing records before retrying the same request.', 'შენახვა არ დადასტურდა. იმავე მოთხოვნის გამეორებამდე მიმდინარე უფლებამოსილება და არსებული ჩანაწერები გადაამოწმეთ.')}</p>}
        {creation.blocked && <p role="alert">{copy('A previous save is unresolved and its details were cleared on reload. Review existing records before creating another.', 'წინა შენახვის შედეგი უცნობია; გადატვირთვამ დეტალები გაასუფთავა. ახლის შექმნამდე არსებული ჩანაწერები გადაამოწმეთ.')}</p>}
        {creation.uncertain && <p role="status">{copy('Keep this page open. Retry uses the original details and request identity.', 'გვერდი ღიად დატოვეთ. გამეორება თავდაპირველ დეტალებსა და მოთხოვნის იდენტიფიკატორს იყენებს.')}</p>}
        {saved && <p role="status">{copy('Record saved', 'ჩანაწერი შენახულია')} · #{saved}. {finance ? copy('No payment was recorded or transferred.', 'გადახდა არ აღრიცხულა და თანხა არ გადარიცხულა.') : copy('The canonical kit issue is recorded.', 'ეკიპირების გაცემა ძირითად ჩანაწერში აღრიცხულია.')}</p>}
        {context && <>
            <Panel><h3>{context.playerName}</h3><p>{context.squadName} · {copy('Agreed start:', 'შეთანხმებული დასაწყისი:')} {context.startDate}{context.endDate ? ` · ${copy('End:', 'დასასრული:')} ${context.endDate}` : ''}</p>
                {finance && <><h3>{copy('Accepted fee terms', 'მიღებული საწევრო პირობები')}</h3>{context.charges.length ? <ul>{context.charges.map((charge, index) => <li key={index}>{charge.label}: {charge.amount} {charge.currency} · {charge.frequency}</li>)}</ul>
                    : <p>{context.feesKnown ? copy('No fee is listed in the accepted terms. No fee record may be needed.', 'მიღებულ პირობებში საწევრო მითითებული არ არის. საწევროს ჩანაწერი შეიძლება საჭირო არ იყოს.') : copy('A fee is not confirmed in the accepted terms. Review the actual agreement before recording anything.', 'მიღებულ პირობებში საწევრო დადასტურებული არ არის. აღრიცხვამდე რეალური შეთანხმება გადაამოწმეთ.')}</p>}</>}
                <h3>{copy('Existing records for this player and squad', 'მოთამაშისა და გუნდის არსებული ჩანაწერები')}</h3><p>{copy('These retain their own status; they do not mark this follow-up complete.', 'ამ ჩანაწერებს საკუთარი სტატუსი აქვთ; ისინი ამ საკითხს დასრულებულად არ ნიშნავენ.')}</p>
                {context.records.length ? <div className="admission-handoff__records">{context.records.map(record => <Button key={record.id} onClick={() => requestClose(() => onOpenRecord(record.id))}>#{record.id} · {label(record.status)}</Button>)}</div> : <p>{copy('No matching records are shown.', 'შესაბამისი ჩანაწერები ნაჩვენები არ არის.')}</p>}
            </Panel>
            {!saved && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
                <fieldset disabled={creation.busy || creation.uncertain || creation.blocked || state.loading}>
                    {finance ? <>
                        <Field label={copy('Agreed amount', 'შეთანხმებული თანხა')} htmlFor={`${formId}-amount`}><input id={`${formId}-amount`} required className="gk-input" type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></Field>
                        <Field label={copy('Currency', 'ვალუტა')} htmlFor={`${formId}-currency`}><input id={`${formId}-currency`} required className="gk-input" minLength={3} maxLength={3} pattern="[A-Z]{3}" value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} /></Field>
                        <Field label={copy('Membership period', 'საწევროს პერიოდი')} htmlFor={`${formId}-period`}><input id={`${formId}-period`} required className="gk-input" maxLength={160} value={period} onChange={event => setPeriod(event.target.value)} /></Field>
                    </> : <>
                        <RecordChoicePicker club={scope.clubId} forKind="EQUIPMENT_ISSUE" target="ASSET" squad={String(context.squadId)} value={asset} onChange={setAsset} required label={copy('Kit or equipment', 'ეკიპირება ან ინვენტარი')} />
                        <Field label={copy('Quantity', 'რაოდენობა')} htmlFor={`${formId}-quantity`}><input id={`${formId}-quantity`} required className="gk-input" type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></Field>
                        <Field label={copy('Actual condition on issue', 'რეალური მდგომარეობა გაცემისას')} htmlFor={`${formId}-condition`}><input id={`${formId}-condition`} required className="gk-input" maxLength={2000} value={condition} onChange={event => setCondition(event.target.value)} /></Field>
                    </>}
                </fieldset>
                <p>{finance ? copy('Save only an actually agreed fee. Receipts and waivers use the saved record’s existing money actions.', 'აღრიცხეთ მხოლოდ რეალურად შეთანხმებული საწევრო. გადახდისა და შეღავათის აღრიცხვა შენახული ჩანაწერის არსებული მოქმედებებით ხდება.') : copy('Save only after the actual kit is issued. Stock and returns use the existing equipment record.', 'შეინახეთ მხოლოდ ეკიპირების რეალური გაცემის შემდეგ. მარაგი და დაბრუნება არსებულ საინვენტარო ჩანაწერში აღირიცხება.')}</p>
                <Button type="submit" disabled={creation.busy || creation.blocked || state.loading}>{creation.busy ? copy('Saving…', 'ინახება…') : creation.uncertain ? copy('Retry same save', 'იმავე შენახვის გამეორება') : title}</Button>
            </form>}
        </>}
        <div className="admission-handoff__actions">{saved && <Button onClick={() => onOpenRecord(saved)}>{copy('Open saved record', 'შენახული ჩანაწერის გახსნა')}</Button>}<Button disabled={creation.busy} onClick={requestClose}>{saved ? copy('Close', 'დახურვა') : copy('Cancel', 'გაუქმება')}</Button></div>
        {confirmation}
    </section>;
}
