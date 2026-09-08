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

const hasSessionStorage = () => typeof window !== 'undefined' && Boolean(window.sessionStorage);

export const sanitizeAuthRedirect = (value?: string | null) => {
    if (!value) return null;

    const trimmed = value.trim();
    if (!trimmed.startsWith('/')
        || trimmed.startsWith('//')
        || trimmed.includes('\\')
        || /[\u0000-\u001f\u007f]/.test(trimmed)) {
        return null;
    }

    const pathname = trimmed.split(/[?#]/, 1)[0].toLowerCase();
    if (AUTH_FLOW_ROUTES.has(pathname)) return null;
    return trimmed;
};

export const isSensitiveAuthDestination = (value?: string | null) => {
    const destination = sanitizeAuthRedirect(value);
    if (!destination) return false;
    const lower = destination.toLowerCase();
    return lower.startsWith('/consent') || /[?&]token=/.test(lower);
};

export const getAuthFlow = (): AuthFlowState => {
    if (!hasSessionStorage()) return {};
    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(AUTH_FLOW_STORAGE_KEY) ?? '{}') as AuthFlowState;
        return {
            nextPath: sanitizeAuthRedirect(parsed.nextPath) ?? undefined,
            email: typeof parsed.email === 'string' ? parsed.email : undefined,
            newAccount: parsed.newAccount === true,
            awaitingVerification: parsed.awaitingVerification === true,
        };
    } catch {
        return {};
    }
};

export const rememberAuthFlow = (updates: AuthFlowState) => {
    const next: AuthFlowState = { ...getAuthFlow(), ...updates };
    if (updates.nextPath !== undefined) {
        next.nextPath = sanitizeAuthRedirect(updates.nextPath) ?? undefined;
    }
    if (!hasSessionStorage()) return next;
    window.sessionStorage.setItem(AUTH_FLOW_STORAGE_KEY, JSON.stringify(next));
    return next;
};

export const clearAuthFlow = () => {
    if (hasSessionStorage()) window.sessionStorage.removeItem(AUTH_FLOW_STORAGE_KEY);
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

export const firstUseDestination = (role?: string) => role === 'ORGANIZER' ? '/my-club' : '/clubs';

export const completedAuthDestination = (
    user: AuthDestinationUser,
    requestedDestination?: string | null,
    firstUse = false,
) => sanitizeAuthRedirect(requestedDestination)
    ?? (firstUse ? firstUseDestination(user.role) : '/home');
