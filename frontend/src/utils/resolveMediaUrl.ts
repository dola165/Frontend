import { DEPLOYMENT_URLS } from '../api/axiosConfig';
import { buildServiceUrl } from '../api/deploymentUrls';

export const resolveMediaUrlFromBase = (value: string | null | undefined, mediaBaseUrl: string) => {
    if (!value) return undefined;

    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
        return undefined;
    }

    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
    }

    try {
        const absolute = new URL(trimmed);
        return absolute.protocol === 'http:' || absolute.protocol === 'https:'
            ? absolute.toString()
            : undefined;
    } catch {
        try {
            return buildServiceUrl(mediaBaseUrl, trimmed).toString();
        } catch {
            return undefined;
        }
    }
};

export const resolveMediaUrl = (value?: string | null) =>
    resolveMediaUrlFromBase(value, DEPLOYMENT_URLS.mediaBaseUrl);
