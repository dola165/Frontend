export type CallUpPlayer = { id: number; name: string; selected: boolean; response: string; revision: number; canRespond: boolean; waiting?: boolean };
export type CallUpTeam = { squadId: number; squadName: string; canManage: boolean; players: CallUpPlayer[] };

/** A called-up player is expected unless they or their family said they can't come (owner, 29 October 2026). */
export const notComing = (player: Pick<CallUpPlayer, 'response'>) => player.response === 'NOT_GOING';

/** "13 expected · 1 not coming", the words the next-match card and Parent Hub use too. */
export function expectedLine(called: Pick<CallUpPlayer, 'response'>[], copy: (en: string, ka: string) => string) {
    const out = called.filter(notComing).length, expected = called.length - out;
    return [copy(`${expected} expected`, `${expected} მოსალოდნელი`), out ? copy(`${out} not coming`, `${out} ვერ მოდის`) : null].filter(Boolean).join(' · ');
}
