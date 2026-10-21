import { useMessageCopy } from './messageCopy';

export function PeopleSearchStatus({ loading, failed, onRetry }: { loading: boolean; failed: boolean; onRetry: () => void }) {
    const copy = useMessageCopy();
    if (failed) return <div role="alert" className="px-3 py-2 text-sm text-[color:var(--color-danger)]">
        {copy('Search failed. Try again.')} <button type="button" className="app-text-action" onClick={onRetry}>{copy('Try again')}</button>
    </div>;
    return loading ? <p role="status" className="px-3 py-2 text-sm text-[color:var(--color-secondary)]">{copy('Searching...')}</p> : null;
}
