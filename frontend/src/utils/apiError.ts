export const extractApiErrorMessage = (error: unknown, fallback = 'Something went wrong.') => {
    const maybeError = error as {
        response?: {
            status?: number;
            data?: unknown;
            headers?: Record<string, string>;
        };
    } | null | undefined;

    if (maybeError?.response?.status === 429) {
        return 'Too many attempts. Please wait a moment and try again.';
    }

    const payload = maybeError?.response?.data;
    if (typeof payload === 'string' && payload.trim()) {
        return payload;
    }

    if (payload && typeof payload === 'object') {
        const fields = payload as Record<string, unknown>;
        if (fields.code === 'provider_link_required') {
            return 'Sign in using your existing method, then open Account → Linked Accounts to connect Google.';
        }
        // RFC Problem Details usually begins with `type: "about:blank"`.
        // Prefer its explanation, then the application's existing message shapes.
        for (const key of ['detail', 'message', 'error', 'title']) {
            const value = fields[key];
            if (typeof value === 'string' && value.trim()) return value;
        }

        // Bean validation responses use field names as keys. Preserve that fallback
        // while excluding machine metadata that is not a useful explanation.
        const metadata = new Set(['type', 'instance', 'code', 'path', 'timestamp', 'status']);
        const firstMessage = Object.entries(fields)
            .find(([key, value]) => !metadata.has(key) && typeof value === 'string' && value.trim())?.[1];
        if (typeof firstMessage === 'string') {
            return firstMessage;
        }
    }

    return fallback;
};

export const extractApiErrorCode = (error: unknown) => {
    const maybeError = error as {
        response?: {
            data?: unknown;
        };
    } | null | undefined;

    const payload = maybeError?.response?.data;
    if (payload && typeof payload === 'object') {
        const codeValue = (payload as Record<string, unknown>).code;
        if (typeof codeValue === 'string' && codeValue.trim()) {
            return codeValue;
        }
    }

    return null;
};
