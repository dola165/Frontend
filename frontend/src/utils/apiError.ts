export const extractApiErrorMessage = (error: unknown, fallback = 'Something went wrong.') => {
    const maybeError = error as {
        response?: {
            data?: unknown;
        };
    };

    const payload = maybeError.response?.data;
    if (typeof payload === 'string' && payload.trim()) {
        return payload;
    }

    if (payload && typeof payload === 'object') {
        const errorValue = (payload as Record<string, unknown>).error;
        if (typeof errorValue === 'string' && errorValue.trim()) {
            return errorValue;
        }

        const firstMessage = Object.values(payload as Record<string, unknown>)
            .find((value) => typeof value === 'string' && value.trim());
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
    };

    const payload = maybeError.response?.data;
    if (payload && typeof payload === 'object') {
        const codeValue = (payload as Record<string, unknown>).code;
        if (typeof codeValue === 'string' && codeValue.trim()) {
            return codeValue;
        }
    }

    return null;
};
