export const sanitizeAuthRedirect = (value?: string | null) => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return null;
    }

    return trimmed;
};

export const buildLoginRedirectPath = (pathname: string, search = '', hash = '') => {
    const destination = sanitizeAuthRedirect(`${pathname}${search}${hash}`) ?? '/feed';
    return `/login?next=${encodeURIComponent(destination)}`;
};

export const resolvePostAuthRedirect = (value: string | null | undefined, fallback = '/feed') => (
    sanitizeAuthRedirect(value) ?? fallback
);
