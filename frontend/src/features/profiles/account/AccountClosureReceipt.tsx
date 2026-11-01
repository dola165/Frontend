import type { ClosureReceipt } from './accountClosureApi';
import { useAccountCopy } from './accountCopy';

export function AccountClosureReceipt({ receipt }: { receipt: ClosureReceipt }) {
    const copy = useAccountCopy();
    if (receipt?.outcome !== 'CLOSED' || !receipt.requestId || !Number.isFinite(Date.parse(receipt.closedAt))) return null;
    return <div role="status" className="mb-5 rounded-xl border border-[var(--color-border)] p-4 text-sm leading-6">
        <p className="font-semibold">{copy('Your account is closed.', 'თქვენი ანგარიში დახურულია.')}</p>
        <p>{copy('Every session has ended. This account cannot sign in or be recovered. Shared records remain as described before closure.', 'ყველა სესია დასრულდა. ამ ანგარიშით შესვლა ან მისი აღდგენა შეუძლებელია. საერთო ჩანაწერები რჩება დახურვამდე აღწერილი წესით.')}</p>
        <p className="mt-2 break-all">{copy('Receipt', 'ქვითარი')}: {receipt.requestId} · <time dateTime={receipt.closedAt}>{new Date(receipt.closedAt).toLocaleString()}</time></p>
    </div>;
}
