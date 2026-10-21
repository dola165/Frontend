/** Without a photo, initials sit on one of six soft colours picked from the name, so people and clubs are easy to tell apart. */
export const avatarHue = (name?: string | null) => name ? [...name].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7) % 6 : undefined;
