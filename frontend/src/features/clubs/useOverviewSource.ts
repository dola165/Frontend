import { useEffect, useState } from 'react';
import { apiClient } from '../../api/axiosConfig';
import { useAuth } from '../../context/AuthContext';

/** Independent failures: a missing schedule must not hide programmes, people or posts. */
export function useOverviewSource<T>(url: string) {
    const { sessionId, status } = useAuth();
    const [attempt, setAttempt] = useState(0);
    const key = `${sessionId}:${status}:${url}:${attempt}`;
    const [result, setResult] = useState<{ key: string; data?: T; failed?: boolean }>();
    useEffect(() => {
        if (status === 'bootstrapping') return;
        const controller = new AbortController();
        void apiClient.get<T>(url, { signal: controller.signal }).then(r => {
            if (!controller.signal.aborted) setResult({ key, data: r.data });
        }).catch(() => { if (!controller.signal.aborted) setResult({ key, failed: true }); });
        return () => controller.abort();
    }, [key, url, status]);
    return { data: result?.key === key ? result.data : undefined, failed: result?.key === key && result.failed === true,
        loading: result?.key !== key, retry: () => setAttempt(n => n + 1) };
}
