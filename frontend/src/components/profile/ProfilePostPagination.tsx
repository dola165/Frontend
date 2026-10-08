export function ProfilePostPagination({ loading, error, retry, older, newer, hasOlder, hasNewer, page }: {
    loading: boolean; error: string; retry: () => void; older: () => void; newer: () => void; hasOlder: boolean; hasNewer: boolean; page: number;
}) {
    return <nav className="flex flex-wrap items-center justify-center gap-3 py-4" aria-label="Post pages">
        {error && <p role="alert" className="w-full text-center text-[color:var(--color-danger)]">{error} <button type="button" onClick={retry} className="app-text-action">Try again</button></p>}
        {loading && <p role="status">Loading posts…</p>}
        {(hasNewer || hasOlder) && <><button type="button" disabled={loading || !hasNewer} onClick={newer} className="rounded-lg border border-current px-4 py-2 disabled:opacity-40">Newer posts</button><span className="text-sm">Page {page}</span><button type="button" disabled={loading || !hasOlder} onClick={older} className="rounded-lg border border-current px-4 py-2 disabled:opacity-40">Older posts</button></>}
    </nav>;
}
