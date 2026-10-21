export interface DeploymentUrls {
    apiBaseUrl: string;
    serviceBaseUrl: string;
    mediaBaseUrl: string;
}

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

const withoutTrailingSlash = (path: string) => path.length > 1 ? path.replace(/\/+$/, '') : path;

/**
 * Resolve deployment configuration once. The API, uploaded media and WebSocket
 * endpoints are siblings beneath the same service base. A terminal `/api`
 * segment is the API namespace and is removed when deriving that base.
 */
export const resolveDeploymentUrls = (
    configuredApiBase: string | undefined,
    browserOrigin: string,
): DeploymentUrls => {
    const configured = configuredApiBase?.trim() || '/api';
    const origin = new URL(browserOrigin);
    if (!HTTP_PROTOCOLS.has(origin.protocol)) {
        throw new Error(`Unsupported browser protocol: ${origin.protocol}`);
    }

    const apiUrl = new URL(configured, `${origin.origin}/`);
    if (!HTTP_PROTOCOLS.has(apiUrl.protocol)) {
        throw new Error(`VITE_API_BASE_URL must use http or https, received ${apiUrl.protocol}`);
    }
    apiUrl.search = '';
    apiUrl.hash = '';
    apiUrl.pathname = withoutTrailingSlash(apiUrl.pathname || '/');

    const serviceUrl = new URL(apiUrl.toString());
    serviceUrl.pathname = apiUrl.pathname.replace(/\/api$/i, '') || '/';
    serviceUrl.pathname = serviceUrl.pathname === '/'
        ? '/'
        : `${withoutTrailingSlash(serviceUrl.pathname)}/`;

    return {
        apiBaseUrl: apiUrl.toString().replace(/\/$/, ''),
        serviceBaseUrl: serviceUrl.toString(),
        mediaBaseUrl: serviceUrl.toString(),
    };
};

export const buildServiceUrl = (serviceBaseUrl: string, path: string): URL =>
    new URL(path.replace(/^\/+/, ''), serviceBaseUrl);

export const buildWebSocketUrlFromBase = (serviceBaseUrl: string, path: string): string => {
    const url = buildServiceUrl(serviceBaseUrl, path);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
};
