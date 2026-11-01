import { formatDate } from '../../../utils/formatting';
import type { ClosureReceipt } from './accountClosureApi';
import { useAccountCopy } from './accountCopy';

/** After closing: what happened, and until when signing in again keeps the account. */
export function AccountClosureReceipt({ receipt }: { receipt: ClosureReceipt }) {
    const copy = useAccountCopy();
    if (receipt?.outcome !== 'CLOSED' || !receipt.requestId || !Number.isFinite(Date.parse(receipt.closedAt)) || !Number.isFinite(Date.parse(receipt.keepUntil))) return null;
    const until = formatDate(receipt.keepUntil, { day: 'numeric', month: 'long', year: 'numeric' });
    return <div role="status" className="mb-5 rounded-xl border border-[var(--color-border)] p-4 text-sm leading-6">
        <p className="font-semibold">{copy('Your account is closed.', 'თქვენი ანგარიში დახურულია.')}</p>
        <p>{copy(`Every device is signed out and nobody sees your profile. Changed your mind? Sign in before ${until} and choose Keep my account. After that it is erased.`, `ყველა მოწყობილობიდან გამოხვედით და თქვენს პროფილს ვერავინ ხედავს. გადაიფიქრეთ? შედით ${until}-მდე და აირჩიეთ „ანგარიშის შენარჩუნება“. ამის შემდეგ ანგარიში წაიშლება.`)}</p>
        <p className="mt-2 break-all text-[var(--fc-text-secondary)]">{copy('Receipt', 'ქვითარი')}: {receipt.requestId} · <time dateTime={receipt.closedAt}>{new Date(receipt.closedAt).toLocaleString()}</time></p>
    </div>;
}
