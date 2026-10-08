const AUTH_FLOW_STORAGE_KEY = 'grasskickz.auth-flow.v1';

const AUTH_FLOW_ROUTES = new Set([
    '/login',
    '/signup',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/oauth2/callback',
    '/onboarding',
    '/dob',
    '/set-password',
]);

export const isAuthFlowRoute = (pathname: string) => AUTH_FLOW_ROUTES.has(pathname.toLowerCase());

export interface AuthFlowState {
    nextPath?: string;
    email?: string;
    newAccount?: boolean;
    awaitingVerification?: boolean;
}

export interface AuthDestinationUser {
    role?: string;
    profileComplete?: boolean;
    onboardingRequired?: boolean;
    mustChangePassword?: boolean;
}

let memoryFlow: AuthFlowState = {};

export const sanitizeAuthRedirect = (value?: string | null) => {
    if (typeof value !== 'string' || !value || value.length > 2000) return null;

    const trimmed = value.trim();
    if (!trimmed.startsWith('/')
        || trimmed.startsWith('//')
        || trimmed.includes('\\')
        // Redirects containing control characters must be rejected.
        // eslint-disable-next-line no-control-regex
        || /[\u0000-\u001f\u007f]/.test(trimmed)) {
        return null;
    }

    try {
        const url = new URL(trimmed, 'https://grasskickz.invalid');
        const decoded = decodeURIComponent(url.pathname);
        // Normalize dot segments before excluding auth loops. Encoded path
        // separators are ambiguous between the browser, router and server.
        // eslint-disable-next-line no-control-regex
        if (url.origin !== 'https://grasskickz.invalid' || decoded.startsWith('//') || /%2f|%5c/i.test(url.pathname) || /[\u0000-\u001f\u007f\\]/.test(decoded)) return null;
        const pathname = decoded.toLowerCase().replace(/\/+$/, '') || '/';
        if (AUTH_FLOW_ROUTES.has(pathname)) return null;
        return `${url.pathname}${url.search}${url.hash}`;
    } catch { return null; }
};

export const isSensitiveAuthDestination = (value?: string | null) => {
    const destination = sanitizeAuthRedirect(value);
    if (!destination) return false;
    const url = new URL(destination, 'https://grasskickz.invalid');
    const pathname = decodeURIComponent(url.pathname).toLowerCase();
    return pathname.startsWith('/consent') || pathname.startsWith('/join-squad') || Boolean(url.hash)
        || [...url.searchParams.keys()].some(key => key.toLowerCase() === 'token');
};

export const getAuthFlow = (): AuthFlowState => {
    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(AUTH_FLOW_STORAGE_KEY) ?? '{}') as AuthFlowState;
        return {
            nextPath: sanitizeAuthRedirect(parsed.nextPath) ?? undefined,
            email: typeof parsed.email === 'string' ? parsed.email : undefined,
            newAccount: parsed.newAccount === true,
            awaitingVerification: parsed.awaitingVerification === true,
        };
    } catch {
        return memoryFlow;
    }
};

export const rememberAuthFlow = (updates: AuthFlowState) => {
    const next: AuthFlowState = { ...getAuthFlow(), ...updates };
    if (updates.nextPath !== undefined) {
        next.nextPath = sanitizeAuthRedirect(updates.nextPath) ?? undefined;
    }
    memoryFlow = next;
    try { window.sessionStorage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep this navigation usable when storage is unavailable. */ }
    return next;
};

export const clearAuthFlow = () => {
    memoryFlow = {};
    try { window.sessionStorage.removeItem(AUTH_FLOW_STORAGE_KEY); } catch { /* Storage may be disabled. */ }
};

export const rememberAuthDestination = (value?: string | null) => {
    const destination = sanitizeAuthRedirect(value);
    if (destination) rememberAuthFlow({ nextPath: destination });
    return destination;
};

const buildAuthPath = (route: '/login' | '/signup', destination?: string | null) => {
    const safeDestination = rememberAuthDestination(destination);
    if (!safeDestination || isSensitiveAuthDestination(safeDestination)) return route;
    return `${route}?next=${encodeURIComponent(safeDestination)}`;
};

export const buildLoginRedirectPath = (pathname: string, search = '', hash = '') => (
    buildAuthPath('/login', `${pathname}${search}${hash}`)
);

export const buildLoginPath = (destination?: string | null) => buildAuthPath('/login', destination);
export const buildSignupPath = (destination?: string | null) => buildAuthPath('/signup', destination);

export const resolvePostAuthRedirect = (value: string | null | undefined, fallback = '/home') => {
    const fromQuery = sanitizeAuthRedirect(value);
    return fromQuery ?? getAuthFlow().nextPath ?? fallback;
};

export const publicContinuationPath = (value?: string | null) => {
    const destination = sanitizeAuthRedirect(value);
    return destination && !isSensitiveAuthDestination(destination) ? destination : undefined;
};

export const requiredAccountStep = (user?: AuthDestinationUser | null) => {
    if (user?.mustChangePassword) return '/set-password';
    if (user?.onboardingRequired || user?.profileComplete === false) return '/onboarding';
    return null;
};

export const firstUseDestination = (role?: string) => {
    return `/roles?setup=1${role ? `&role=${encodeURIComponent(role)}` : ''}`;
};

export const completedAuthDestination = (
    user: AuthDestinationUser,
    requestedDestination?: string | null,
    firstUse = false,
) => sanitizeAuthRedirect(requestedDestination)
    ?? (firstUse ? firstUseDestination(user.role) : '/home');
