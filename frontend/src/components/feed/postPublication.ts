import { useState } from 'react';
import { apiClient, type AuthSessionRequestConfig } from '../../api/axiosConfig';
import { getStoredUserId } from '../../utils/authStorage';

type PagePost = { content: string; clubId: null; organizationId: number; isPublic: boolean; mediaIds: number[] };
type Attempt = { key: string; body: PagePost };

/** Organization creation keeps its original author, caption and uploaded photo IDs through a lost reply/reload. */
export function useOrganizationPostPublication(organizationId?: number) {
    const scope = `gk-organization-post:${getStoredUserId() ?? 'guest'}:${organizationId ?? 'none'}`;
    const read = (): Attempt | null => {
        if (!organizationId) return null;
        const raw = sessionStorage.getItem(scope);
        if (!raw) return null;
        const saved = JSON.parse(raw) as Attempt;
        if (!saved.key || saved.body?.organizationId !== organizationId || saved.body.clubId !== null || !Array.isArray(saved.body.mediaIds))
            throw new Error('The original post recovery record is unavailable.');
        return saved;
    };
    const load = () => { try { return read(); } catch { return null; } };
    const [state, setState] = useState(() => ({ scope, attempt: load() }));
    if (state.scope !== scope) setState({ scope, attempt: load() });
    const attempt = state.scope === scope ? state.attempt : null;
    const publish = async (body: PagePost, config: AuthSessionRequestConfig) => {
        if (!organizationId || body.organizationId !== organizationId || body.clubId !== null) throw new Error('Choose one organization author.');
        const original = read() ?? { key: crypto.randomUUID(), body: JSON.parse(JSON.stringify(body)) as PagePost };
        // A blocked/corrupt store refuses dispatch; never fall back to an unkeyed creation.
        sessionStorage.setItem(scope, JSON.stringify(original));setState({ scope, attempt: original });
        const response = await apiClient.post<{ postId?: number }>('/posts', original.body, { ...config, headers: { 'Idempotency-Key': original.key } });
        const postId = response.data?.postId;
        if (typeof postId !== 'number' || !Number.isSafeInteger(postId) || postId <= 0) throw new Error('The published post could not be confirmed.');
        return postId;
    };
    const complete = () => { sessionStorage.removeItem(scope);setState({ scope, attempt: null }); };
    return { attempt, publish, complete };
}
