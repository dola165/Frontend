import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccountDangerTab } from './AccountDangerTab';
import { btnSecondaryClass } from './accountModel';
import { useAccountCopy } from './accountCopy';

/** An unfinished required profile step must not trap someone who wants to leave. */
export function AccountExitOption() {
    const copy = useAccountCopy();
    const [params] = useSearchParams();
    const [open, setOpen] = useState(() => params.get('accountClosure') === 'review');
    const [busy, setBusy] = useState(false);
    return <div className="mt-5 grid gap-3">
        <button type="button" className={`${btnSecondaryClass} min-h-11 w-fit`} disabled={busy} onClick={() => setOpen(value => !value)}>
            {open ? copy('Keep account', 'ანგარიშის შენარჩუნება') : copy('Review account closure', 'ანგარიშის დახურვის განხილვა')}
        </button>
        {open && <AccountDangerTab onBusyChange={setBusy} />}
    </div>;
}
