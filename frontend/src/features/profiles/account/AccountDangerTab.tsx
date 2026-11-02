import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useAccountCopy } from './accountCopy';
import { Field, Section } from './AccountFields';
import { btnSecondaryClass, inputClass, insetClass } from './accountModel';
import { useAccountClosure } from './useAccountClosure';

export const AccountDangerTab = ({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) => {
    const copy = useAccountCopy();
    const flow = useAccountClosure();
    useEffect(() => { onBusyChange?.(flow.closing); }, [flow.closing, onBusyChange]);
    return <Section title={copy('Close account', 'ანგარიშის დახურვა')}>
        {flow.loading && <p role="status">{copy('Checking your account and responsibilities…', 'ანგარიში და პასუხისმგებლობები მოწმდება…')}</p>}
        {flow.error && <p role="alert" className="mb-4 text-[var(--fc-state-danger)]">{flow.error}</p>}
        {flow.preview && <div className="grid gap-4">
            <ul className="max-w-prose list-disc space-y-3 pl-5 text-sm leading-6 text-[var(--fc-text-secondary)]">
                {flow.preview.consequences.map(text => <li key={text}>{text}</li>)}
            </ul>
            {flow.preview.blockers.length > 0 && <div className="grid gap-3">
                <h3 className="font-semibold">{copy('Resolve these responsibilities first', 'ჯერ მოაგვარეთ ეს პასუხისმგებლობები')}</h3>
                {flow.preview.blockers.map((blocker, index) => <article key={`${blocker.code}-${index}`} className={`${insetClass} p-4`}>
                    <p className="font-semibold break-words">{blocker.name}</p><p className="my-2 text-sm leading-6">{blocker.action}</p>
                    <Link to={blocker.recoveryPath} className={`${btnSecondaryClass} min-h-11`}>{copy('Review responsibility', 'პასუხისმგებლობის ნახვა')}</Link>
                </article>)}
            </div>}
            {!flow.preview.passwordRequired && <p className="text-sm leading-6">{copy('Your account uses a linked sign-in provider. Set a password using account recovery, sign in again, then return here. Your linked provider stays connected.', 'ანგარიში დაკავშირებულ პროვაიდერს იყენებს. აღდგენით შექმენით პაროლი, ხელახლა შედით და დაბრუნდით. პროვაიდერი დაკავშირებული დარჩება.')}</p>}
            {flow.preview.passwordRequired && flow.preview.blockers.length === 0 && <form className="grid max-w-xl gap-4" onSubmit={event => { event.preventDefault(); void flow.close(); }}>
                <Field label={copy('Current password', 'მიმდინარე პაროლი')}><input className={inputClass} type="password" autoComplete="current-password" maxLength={256} required value={flow.password} disabled={flow.closing} onChange={event => flow.setPassword(event.target.value)} /></Field>
                <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={flow.acknowledged} disabled={flow.closing} onChange={event => flow.setAcknowledged(event.target.checked)} />{copy('I reviewed what happens. Close my account; I can keep it by signing in again within 30 days.', 'გავეცანი, რა მოხდება. დახურეთ ჩემი ანგარიში; 30 დღის განმავლობაში ხელახლა შესვლით შევძლებ მის შენარჩუნებას.')}</label>
                <button className={`${btnSecondaryClass} min-h-11 w-fit justify-center text-[var(--fc-state-danger)]`} type="submit" disabled={flow.closing || !flow.acknowledged || !flow.password}>{flow.closing ? copy('Closing account…', 'ანგარიში იხურება…') : copy('Close account', 'ანგარიშის დახურვა')}</button>
            </form>}
        </div>}
        <div className="mt-4 flex flex-wrap gap-3">
            <button className={`${btnSecondaryClass} min-h-11`} disabled={flow.loading || flow.closing} onClick={() => void flow.load()}>{copy('Review again', 'ხელახლა შემოწმება')}</button>
            <Link className={`${btnSecondaryClass} min-h-11`} to="/forgot-password?next=%2Faccount%3Ftab%3Ddanger">{copy('Password recovery', 'პაროლის აღდგენა')}</Link>
        </div>
    </Section>;
};
