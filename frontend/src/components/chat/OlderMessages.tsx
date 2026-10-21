import { useMessageCopy } from './messageCopy';

export function OlderMessages({ available, loading, error, onLoad }: {
    available: boolean; loading: boolean; error: string | null; onLoad: () => Promise<void>;
}) {
    const copy = useMessageCopy();
    if (!available && !error) return null;
    return <div className="shrink-0 text-center text-xs py-2">
        {error && <p role="alert" className="mb-2 text-[color:var(--color-warning)]">{copy(error)}</p>}
        {available && <button type="button" disabled={loading} onClick={() => void onLoad()}
            className="rounded px-3 py-2 text-[color:var(--color-accent)] focus-visible:outline-2 disabled:opacity-50 app-text-action">
            {copy(loading ? 'Loading older messages…' : 'Load older messages')}
        </button>}
    </div>;
}
