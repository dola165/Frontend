/** Navigation hints never grant read access; the selected event still comes from the authorized feed. */
export function sessionNavigation(params: URLSearchParams): { initialSessionId?: number; initialDate?: Date } {
    const rawId = params.get('sessionId') ?? '';
    const at = params.get('at') ?? '';
    const id = Number(rawId);
    if (params.get('tab') !== 'sessions' || !/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(id)
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(at) || !Number.isFinite(Date.parse(at))) return {};
    const date = new Date(at);
    if (date.toISOString().slice(0,19) !== at.slice(0,19)) return {};
    return { initialSessionId: id, initialDate: date };
}
