import { API_ORIGIN } from '../api/axiosConfig';

export const resolveMediaUrl = (value?: string | null) => {
    if (!value) return undefined;

    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
        return undefined;
    }

    if (
        trimmed.startsWith('http://')
        || trimmed.startsWith('https://')
        || trimmed.startsWith('data:')
        || trimmed.startsWith('blob:')
    ) {
        return trimmed;
    }

    const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return new URL(normalizedPath, API_ORIGIN).toString();
};
