/**
 * What a step in the match drawer just did ("Invitation accepted."). The drawer reads the match again after it, which
 * replaces the step, so the sentence is kept here, read once by the drawer's action as it mounts again, then dropped.
 */
let notice: string | null = null;
export const noteDone = (text: string) => { notice = text; };
export const readNotice = () => notice;
export const clearNotice = () => { notice = null; };
