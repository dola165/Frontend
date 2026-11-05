const CODE = /^[A-Za-z0-9_-]{4,64}$/;
/**
 * Where a pasted coach's link or code leads: a squad join link (`/join/{code}`), a staff link (`/staff-invite/{code}`),
 * or a bare code (a squad's). Null when it is neither.
 */
export function joinTarget(text: string): string | null {
    const value = text.trim();
    const link = value.match(/\/(join|staff-invite)\/([A-Za-z0-9_-]{4,64})(?:[/?#]|$)/);
    if (link) return `/${link[1]}/${link[2]}`;
    return CODE.test(value) ? `/join/${value}` : null;
}
